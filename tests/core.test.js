// The core API (src/core): checked against the RangeManager API, which tests/parity.test.js checks against 3.8.0.
import { Range, Board, ready, terminateWorkers, idOfHand, COMBO_COUNT, HAND_STRINGS } from '../src/core/index.js';
import { RangeManager } from '../src/rangeManager.js';

const OPENER = '66+,A9s+,KTs+,QTs+,JTs,T9s,ATo+,KJo+';
const DEFENDER = '22-88,A2s-A8s,K9s,Q9s+,J9s+,T8s+,97s+,87s,76s,A9o-AJo,KTo-KQo,QJo';
const FLOP = ['Ad', '7c', '6h'];
const TURN = [...FLOP, '2s'];
const RIVER = [...TURN, 'Kd'];

const sameSet = (range, rm) => {
  expect([...range.hands()].sort()).toEqual([...rm.toArray()].sort());
  const weights = rm.weights();
  for (const hand of range.hands()) expect(range.weightOf(hand)).toBeCloseTo(weights[hand], 12);
};

afterAll(() => terminateWorkers());

describe('Range', () => {
  it('parses every input form like RangeManager', () => {
    for (const input of [OPENER, DEFENDER, 'AA,KK:0.5,AhKh:0.25', 'KXs,5Xo', 'AxKh,Xh2c', 'JJ-99:0.25,AK-AT', ['AhKh', 'QsQh:0.5', ['JcJd', 0.25], { hand: 'Ts9s', weight: 0.4 }], { AhKh: 0.5, KsKd: 1 }]) {
      sameSet(Range.from(input), new RangeManager(input));
    }
    expect(() => Range.from('XsXh')).toThrow('Invalid wildcard hand: XsXh');
    expect(() => Range.from('')).toThrow('Input is required');
  });

  it('writes notation that parses back to the same range', () => {
    for (const input of [OPENER, 'AA,KK:0.5,AhKh:0.25,AKs:0.75', 'KXs,5Xo:0.3']) {
      const range = Range.from(input);
      expect(Range.from(range.toNotation()).weights).toEqual(range.weights);
    }
    expect(Range.from(OPENER).toNotation()).toBe(new RangeManager(OPENER).toNotation());
  });

  it('combines and filters like RangeManager', () => {
    const a = 'AA,KK:0.5,AKs,AKo:0.4,QQ-99', b = 'KK,AKs:0.25,99,AhKd';
    const r = Range.from(a), rm = new RangeManager(a);
    sameSet(r.include(b), rm.include(b));
    sameSet(r.exclude(b), rm.exclude(b));
    sameSet(r.intersect(b), rm.intersect(b));
    sameSet(r.scale(0.5), rm.scale(0.5));
    sameSet(r.setWeight('AKs', 0.3), rm.setWeight('AKs', 0.3));
    sameSet(r.withoutCards(['Ah', 'Kx']), rm.exclude(['Ah', 'Kx']));
    sameSet(r.withSuit('h'), rm.hasSuit('h'));
    sameSet(r.suitedOf('s'), rm.suitedOf('s'));
    sameSet(Range.from(a, { dead: ['As'] }), new RangeManager(a, ['As']));
    expect(r.size).toBe(rm.size());
    expect(r.weightedSize).toBeCloseTo(rm.weightedSize(), 12);
    expect(r.isWeighted).toBe(true);
  });
});

describe('Matchup', () => {
  it.each([['flop', FLOP], ['turn', TURN], ['river', RIVER]])('gives every combo the same equity as RangeManager on the %s', async (_, board) => {
    const spot = await new RangeManager(OPENER).against(DEFENDER, board);
    const villainByHand = await spot._villainEquityByHand();
    const m = await Range.from(OPENER).vs(DEFENDER, board, { workers: false });
    for (const [hand, result] of Object.entries(spot.handEquity)) {
      const id = idOfHand(hand);
      if (result.equity === null) expect(m.hero.equity[id]).toBeNaN();
      else { expect(m.hero.win[id]).toBe(result.win); expect(m.hero.tie[id]).toBe(result.tie); expect(m.hero.lose[id]).toBe(result.lose); }
    }
    for (const [hand, result] of Object.entries(villainByHand)) {
      if (result.equity === null) continue;
      expect(m.villain.equity[idOfHand(hand)]).toBeCloseTo(result.equity, 12);
    }
    expect(m.hero.total()).toEqual(await new RangeManager(OPENER).equity(DEFENDER, board));
  });

  it('weights both sides', async () => {
    const hero = 'AA,KK:0.5,AKs:0.25', villain = 'QQ+:0.6,AK:0.5,77';
    const m = await Range.from(hero).vs(villain, FLOP);
    expect(m.hero.total().equity).toBeCloseTo((await new RangeManager(hero).equity(villain, FLOP)).equity, 12);
    const byHand = await new RangeManager(hero).equityByHand(villain, FLOP);
    for (const [hand, result] of Object.entries(byHand)) {
      if (result.equity === null) expect(m.hero.equity[idOfHand(hand)]).toBeNaN();
      else expect(m.hero.equity[idOfHand(hand)]).toBeCloseTo(result.equity, 12);
    }
  });

  it('removes combos holding a dead card from both ranges', async () => {
    const m = await Range.from(OPENER).vs(DEFENDER, FLOP, { dead: ['Ks', '5x'] });
    const reference = await new RangeManager(OPENER, ['Ks', '5x']).equity(new RangeManager(DEFENDER, ['Ks', '5x']), FLOP, { deadCards: ['Ks', '5x'] });
    expect(m.hero.total()).toEqual(reference);
    expect(m.villain.range.has('Ks9s')).toBe(false);
  });

  it('filters by equity', async () => {
    const m = await Range.from(OPENER).vs(DEFENDER, FLOP);
    const spot = await new RangeManager(OPENER).getEquity(DEFENDER, FLOP);
    sameSet(m.hero.above(0.6), spot.equityAbove(0.6));
    sameSet(m.hero.below(0.4), spot.equityBelow(0.4));
    sameSet(m.hero.between(0.4, 0.7), spot.equityBetween(0.4, 0.7));
  });

  it('gives the same results with workers', async () => {
    const single = await Range.from(OPENER).vs(DEFENDER, FLOP, { workers: false });
    const pooled = await Range.from(OPENER).vs(DEFENDER, FLOP, { workers: 3 });
    expect(Array.from(pooled.hero.win)).toEqual(Array.from(single.hero.win));
    expect(Array.from(pooled.villain.lose)).toEqual(Array.from(single.villain.lose));
    expect(pooled.runouts).toBe(single.runouts);
    // Preflop samples are split across workers: the estimate is close, not identical
    const preflop = await Range.from('AA,KK').vs('QQ,AKs', [], { workers: 2, iterations: 20000, seed: 9 });
    expect(preflop.runouts).toBe(20000);
    expect(preflop.hero.total().equity).toBeCloseTo(0.79, 1);
  });

  it('runs synchronously after ready()', async () => {
    await ready();
    const m = Range.from('AA').vsSync('KK', RIVER);
    expect(m.hero.total().equity).toBe(1);
    expect(Board.fromSync(FLOP).matching(Range.from('AA,KK'), ['Three of a Kind']).size).toBe(3); // AA makes a set on an ace-high board
  });

  // Reports from the core's arrays: the same numbers as RangeManager (combo lists may be in a different order)
  // and sums in a different order, so numbers are compared to 1e-9
  const sorted = report => JSON.parse(JSON.stringify(report, (key, value) => (
    key === 'combos' && Array.isArray(value) ? [...value].sort() : typeof value === 'number' ? Math.round(value * 1e9) / 1e9 : value)));

  it.each([['flop', FLOP], ['turn', TURN], ['river', RIVER], ['paired turn', ['8c', '8d', '3h', 'Jd']]])('compare() and buckets() match RangeManager on the %s', async (_, board) => {
    const villain = '22-88:0.6,A2s-A8s,K9s,Q9s+,J9s+,T8s+,97s+,87s,76s,A9o-AJo,KTo-KQo,QJo';
    const spot = await new RangeManager(OPENER).against(villain, board);
    const m = await Range.from(OPENER).vs(villain, board, { workers: false });
    expect(sorted(m.compare())).toEqual(sorted(await spot.compare()));
    expect(sorted(m.buckets({ bands: 'quartiles' }))).toEqual(sorted(await (await new RangeManager(OPENER).against(villain, board, { bands: 'quartiles' })).buckets()));
    const b = await Board.from(board);
    expect(sorted(b.handClasses(Range.from(OPENER), { highCards: false }))).toEqual(sorted(await new RangeManager(OPENER).handClasses(board, { highCards: false })));
    expect(sorted(b.breakdown(Range.from(villain)))).toEqual(sorted(await new RangeManager(villain).breakdown(board)));
  });

  it('compareTo() matches RangeManager', async () => {
    const m = await Range.from(OPENER).vs(DEFENDER, TURN, { workers: false });
    const core = m.compareTo('77+,ATs+,KQs,AJo+');
    const compat = await (await new RangeManager(OPENER).against(DEFENDER, TURN)).compareTo('77+,ATs+,KQs,AJo+');
    expect(core.overlap).toBeCloseTo(compat.overlap, 12);
    expect(core.distance).toBeCloseTo(compat.distance, 12);
    expect(core.equity.reference).toBeCloseTo(compat.equity.reference, 12);
    expect(sorted(core.buckets)).toEqual(sorted(compat.buckets));
    expect(core.missing.hands().sort()).toEqual([...compat.missing].sort());
    expect(core.extra.hands().sort()).toEqual([...compat.extra].sort());
    expect(core.combos).toEqual(compat.combos);
  });

  it('ties mathematically equal hands exactly with fractional weights', async () => {
    // 5c5d and 5d5h are suit-isomorphic on this board against this villain: equal equity, to the last bit
    const m = await Range.from('55').vs('Tx2c,7x2s:0.6,KK-JJ:0.6,52o:0.6', ['Jd', '8s', '3c'], { workers: false });
    expect(m.hero.equity[idOfHand('5c5d')]).toBe(m.hero.equity[idOfHand('5d5h')]);
    const spot = await new RangeManager('55').getEquity('Tx2c,7x2s:0.6,KK-JJ:0.6,52o:0.6', ['Jd', '8s', '3c']);
    expect(spot.handEquity['5c5d'].equity).toBe(spot.handEquity['5d5h'].equity);
  });

  it('samples preflop reproducibly with a seed', async () => {
    const a = await Range.from('AA,KK').vs('QQ', [], { workers: false, iterations: 5000, seed: 4 });
    const b = await Range.from('AA,KK').vs('QQ', [], { workers: false, iterations: 5000, seed: 4 });
    expect(a.hero.total()).toEqual(b.hero.total());
  });
});

describe('Board', () => {
  it('matches criteria like makesHand', async () => {
    const wide = '22+,A2s+,K2s+,Q2s+,J4s+,T6s+,96s+,86s+,75s+,65s,54s,A2o+,K8o+,Q9o+,J9o+,T9o';
    for (const board of [FLOP, TURN, RIVER, ['Kh', '9h', '4c']]) {
      const b = await Board.from(board);
      for (const criteria of [['Pair'], ['Top Pair', 'Overpair'], ['Flush Draw'], ['Middling Pair'], ['Two Overcards', 'Straight']]) {
        sameSet(b.matching(Range.from(wide), criteria), await new RangeManager(wide).makesHand(criteria, board));
      }
    }
    expect(() => Board.fromSync(['Ah'])).toThrow('A board has 3 to 5 cards');
  });

  it("reads every flag in poker-extval's own bit layout", async () => {
    const { evaluateHand, FLAGS } = await import('poker-extval');
    for (const board of [['Kh', '9h', '4c'], ['As', 'Ks', '5d', '4c'], ['8c', '8d', '3h', 'Jh', '2s']]) {
      const b = await Board.from(board);
      let checked = 0;
      for (let id = 0; id < COMBO_COUNT; id += 7) {
        if (b.blocked[id]) continue;
        const hand = HAND_STRINGS[id];
        const cards = [hand.slice(0, 2), hand.slice(2)];
        const [evaluation] = Object.values(evaluateHand([...cards, ...board], { strict: true, holeCards: cards }));
        for (const flag of Object.keys(FLAGS)) expect([hand, flag, b.has(id, flag)]).toEqual([hand, flag, evaluation[flag]]);
        checked++;
      }
      expect(checked).toBeGreaterThan(150);
    }
  });

  it("splits tied groups like RangeManager with ties: 'split'", async () => {
    const weighted = '22+:0.5,A2s+,KTo+:0.75,QJs';
    for (const board of [['Kh', '9h', '4c'], ['As', 'Ks', 'Qs', 'Js', 'Ts']]) {
      const b = await Board.from(board);
      for (const share of [0.1, 0.25, 0.5]) {
        sameSet(b.strongest(Range.from(weighted), share, { ties: 'split' }), await new RangeManager(weighted).strongest(share, board, { ties: 'split' }));
        sameSet(b.weakest(Range.from(weighted), share, { ties: 'split' }), await new RangeManager(weighted).weakest(share, board, { ties: 'split' }));
      }
    }
    expect(() => (Board.fromSync(FLOP)).strongest(Range.from('AA'), 0.5, { ties: 'all' })).toThrow("ties must be 'keep' or 'split'");
  });

  it('ranks like strongest() and weakest()', async () => {
    const b = await Board.from(RIVER);
    const r = Range.from(OPENER);
    sameSet(b.strongest(r, 0.2), await new RangeManager(OPENER).strongest('20%', RIVER));
    sameSet(b.weakest(r, 0.3), await new RangeManager(OPENER).weakest(0.3, RIVER));
    const ranked = b.rank(r);
    expect(b.score[ranked[0]]).toBeGreaterThanOrEqual(b.score[ranked[ranked.length - 1]]);
    expect(ranked.every(id => id >= 0 && id < COMBO_COUNT)).toBe(true);
  });
});
