// Differential tests: this version against poker-rangeman 3.8.0 (the poker-rangeman-v3 dev dependency, which runs
// on poker-extval 5.2) on seeded random ranges, weights, boards and dead cards. Every public method of the
// RangeManager API must give the same result. Postflop equity is exact, so counts must match to rounding;
// preflop is Monte Carlo and is left to the unit tests.
import { RangeManager as V4 } from '../src/rangeManager.js';
import { RangeManager as V3 } from 'poker-rangeman-v3';

const RANKS = 'AKQJT98765432';
const SUITS = 'shdc';
const CARDS = [...RANKS].flatMap(r => [...SUITS].map(s => r + s));

function rng(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

// A random notation string: pairs, suited, offsuit, ranges, any-suit, wildcards, exact combos, some weighted
function randomNotation(random, parts = 5) {
  const rank = () => RANKS[Math.floor(random() * 13)];
  const tokens = [];
  for (let i = 0; i < parts; i++) {
    const a = Math.floor(random() * 12);
    const b = a + 1 + Math.floor(random() * (12 - a));
    const kind = Math.floor(random() * 8);
    let token;
    if (kind === 0) token = `${RANKS[a]}${RANKS[a]}${random() < 0.5 ? '+' : ''}`;
    else if (kind === 1) token = `${RANKS[a]}${RANKS[b]}s${random() < 0.4 ? '+' : ''}`;
    else if (kind === 2) token = `${RANKS[a]}${RANKS[b]}o${random() < 0.4 ? '+' : ''}`;
    else if (kind === 3) token = `${RANKS[a]}${RANKS[b]}`;
    else if (kind === 4) token = `${RANKS[a]}${RANKS[b]}${random() < 0.5 ? 's' : 'o'}`;
    else if (kind === 5) { const c = CARDS[Math.floor(random() * 52)]; let d = c; while (d === c) d = CARDS[Math.floor(random() * 52)]; token = c + d; }
    else if (kind === 6) token = `${rank()}x${rank()}${SUITS[Math.floor(random() * 4)]}`;
    else token = `${RANKS[a]}${RANKS[a]}-${RANKS[Math.min(12, a + 2)]}${RANKS[Math.min(12, a + 2)]}`;
    // Weights that are binary fractions add up exactly in floating point, so neither version's results carry
    // rounding noise and mathematically tied hands tie in both (with weights like 0.6, sums in a different order can
    // split such ties by noise, deciding cut-offs differently)
    if (random() < 0.3) token += `:${[0.25, 0.5, 0.75, 0.375][Math.floor(random() * 4)]}`;
    tokens.push(token);
  }
  return tokens.join(',');
}

function randomBoard(random, length) {
  const deck = [...CARDS];
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return { board: deck.slice(0, length), spare: deck.slice(length) };
}

// Runs both, compares results (or the error messages)
async function both(fn) {
  const run = async RM => { try { return { value: await fn(RM) }; } catch (error) { return { error: error.message }; } };
  return [await run(V3), await run(V4)];
}

// Deep equality with a relative tolerance for numbers (weighted sums can differ in the last bits)
function close(a, b, path = '') {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))) return null;
    return `${path}: ${a} vs ${b}`;
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return Object.is(a, b) ? null : `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: array mismatch`;
  const keysA = Object.keys(a), keysB = Object.keys(b);
  if (keysA.join('|') !== keysB.join('|')) return `${path}: keys ${keysA.slice(0, 8).join(',')} vs ${keysB.slice(0, 8).join(',')}`;
  for (const key of keysA) {
    const diff = close(a[key], b[key], `${path}.${key}`);
    if (diff) return diff;
  }
  return null;
}

// Draw flags poker-extval 6 added (evaluations, breakdowns and compare().flags gain them); 3.8.0 runs on poker-extval
// 5.2, which doesn't have them, so they're left out of the comparison. Everything else must match.
const EXTVAL6_FLAGS = new Set(['isNutFlushDraw', 'isNutBackdoorFlushDraw', 'isDoubleGutshot', 'isBackdoorStraightDraw', 'isBackdoorComboDraw']);
function withoutNewFlags(value) {
  if (Array.isArray(value)) return value.map(withoutNewFlags);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !EXTVAL6_FLAGS.has(key)).map(([key, v]) => [key, withoutNewFlags(v)]));
}

async function expectSame(label, fn) {
  const [v3, raw] = await both(fn);
  const v4 = withoutNewFlags(raw);
  const diff = close(v3, v4);
  if (diff) throw new Error(`${label}: ${diff}`);
}

const plain = r => ({ hands: r.toArray(), weights: r.weights(), notation: r.toNotation(), string: r.toString() });

describe('parity with 3.8.0', () => {
  it('parses and writes notation the same way', async () => {
    const random = rng(1);
    for (let i = 0; i < 150; i++) {
      const notation = randomNotation(random, 1 + Math.floor(random() * 6));
      await expectSame(`parse ${notation}`, RM => plain(new RM(notation)));
    }
    for (const bad of ['', 'XX', 'AKx', 'A', 'AK:2', 'AhAh', 'ZZ', 'AK-QJ', 'KQs+,']) {
      await expectSame(`parse ${bad}`, RM => plain(new RM(bad)));
    }
    await expectSame('array input', RM => plain(new RM(['AhKh', 'QsQh:0.5', ['JcJd', 0.25], { hand: 'Ts9s', weight: 0.4 }])));
    await expectSame('object input', RM => plain(new RM({ AhKh: 0.5, KsKd: 1 })));
  });

  it('combines and filters ranges the same way', async () => {
    const random = rng(2);
    for (let i = 0; i < 60; i++) {
      const a = randomNotation(random, 4), b = randomNotation(random, 3);
      const dead = randomBoard(random, 2).board;
      await expectSame(`combine ${a} | ${b}`, RM => {
        const r = new RM(a);
        return {
          include: plain(r.include(b)), exclude: plain(r.exclude(b)), intersect: plain(r.intersect(b)),
          excludeCards: plain(r.exclude(dead)), scale: plain(r.scale(0.5)), setWeight: plain(r.setWeight(b, 0.3)),
          suit: plain(r.hasSuit('h')), suited: plain(r.suitedOf('s')), dead: plain(r.setDeadCards([dead[0], 'Xc'])),
          weightOf: r.weightOf(r.toArray()[0] || 'AhKh'), size: r.size(), weightedSize: r.weightedSize(), isWeighted: r.isWeighted(),
          withDead: plain(new RM(a, dead))
        };
      });
    }
  });

  it('evaluates hands on boards the same way', async () => {
    const random = rng(3);
    const criteria = [['Pair'], ['Top Pair', 'Overpair'], ['Flush Draw'], ['Middling Pair'], ['Two Pair', 'Set'],
      ['Open Ended Straight Draw', 'Inside Straight Draw'], ['Two Overcards'], ['High Card'], ['Straight', 'Flush'], ['Combo Draw']]
      .map(list => list.filter(c => c !== 'Set'));
    for (let i = 0; i < 40; i++) {
      const range = randomNotation(random, 6);
      const { board } = randomBoard(random, 3 + (i % 3));
      const crit = criteria[i % criteria.length];
      const options = [true, false, { strict: true, street: ['flop', 'turn', 'river'][i % 3] }, { excludeBoardPlays: true }][i % 4];
      await expectSame(`evaluate ${range} on ${board}`, async RM => {
        const r = new RM(range);
        const made = await r.makesHand(crit, board, options);
        const hits = await r.hitsHand(crit, board, options);
        const hitsBoth = await r.hitsHandBoth(crit, board, options);
        const hand = made.toArray()[0];
        return {
          made: plain(made), hits: plain(hits), hitsBoth: plain(hitsBoth),
          keyCards: made.getKeyCards(), kicker: plain(made.hasKicker(['Ax', 'Kx'])), key: plain(made.hasKeyCard([board[0]], false)),
          object: hand ? await r.getObject(hand, board, options) : null
        };
      });
    }
  });

  it('ranks and breaks down ranges the same way', async () => {
    const random = rng(4);
    for (let i = 0; i < 25; i++) {
      const range = randomNotation(random, 6);
      const { board } = randomBoard(random, 3 + (i % 3));
      await expectSame(`rank ${range} on ${board}`, async RM => {
        const r = new RM(range);
        const ranked = (await r.rankHands(board)).map(({ value, ...rest }) => rest); // value is new in this version
        return {
          ranked, strongest: plain(await r.strongest('30%', board)), weakest: plain(await r.weakest(0.2, board)),
          breakdown: await r.breakdown(board), classes: await r.handClasses(board, { highCards: i % 2 === 0 }),
          blockers: await r.blockers(board, ['Ah', 'Kd'])
        };
      });
    }
  });

  it('computes postflop equity the same way', async () => {
    const random = rng(5);
    for (let i = 0; i < 12; i++) {
      const hero = randomNotation(random, 3), villain = randomNotation(random, 3);
      const { board, spare } = randomBoard(random, 4 + (i % 2));
      const options = i % 3 === 0 ? { deadCards: [spare[0]] } : {};
      await expectSame(`equity ${hero} vs ${villain} on ${board}`, async RM => {
        const r = new RM(hero);
        return {
          total: await r.equity(villain, board, options),
          byHand: await r.equityByHand(villain, board, options),
          vsCards: await r.equity([spare[1], spare[2]], board)
        };
      });
    }
  });

  it('analyses range vs range the same way', async () => {
    const random = rng(6);
    for (let i = 0; i < 10; i++) {
      const hero = randomNotation(random, 4), villain = randomNotation(random, 4);
      const { board } = randomBoard(random, 3 + (i % 3));
      const bands = i % 4 === 3 ? 'quartiles' : undefined;
      // Some spots with an extra dead card (it leaves the deck; hero combos holding it stay in the range)
      const deadCards = i % 3 === 1 ? [randomBoard(random, 1).board[0]].filter(c => !board.includes(c)) : undefined;
      await expectSame(`analysis ${hero} vs ${villain} on ${board}${deadCards ? ` dead ${deadCards}` : ''}`, async RM => {
        const spot = await new RM(hero).against(villain, board, { ...(bands ? { bands } : {}), ...(deadCards ? { deadCards } : {}) });
        return {
          compare: await spot.compare(), buckets: await spot.buckets(), bands: spot.bandsByHand(),
          good: plain(spot.bucket('good', 'strong')), above: plain(spot.equityAbove('60%')), between: plain(spot.equityBetween(0.3, 0.7)),
          compareTo: await spot.compareTo('TT+,AK'), math: spot.bettingMath({ pot: 10, bet: 7 }),
          defend: plain(spot.defend({ pot: 10, bet: 7 })), defendMdf: plain(spot.defend({ pot: 10, bet: 7, by: 'mdf' })),
          // Bluffs tied exactly with another candidate (same band, blockers and equity) are interchangeable: 3.8
          // broke such ties by floating-point noise. Compare how many, their weight and their equities
          bluffs: (bluffs => ({
            size: bluffs.size(), weight: Math.round(bluffs.weightedSize() * 1e9) / 1e9,
            equities: bluffs.toArray().map(hand => Math.round(spot.handEquity[hand].equity * 1e9) / 1e9).sort((x, y) => x - y)
          }))(await spot.bluffCandidates({ pot: 10, bet: 7 })),
          filtered: await spot.bucket('good', 'weak').compare()
        };
      });
    }
  });
});
