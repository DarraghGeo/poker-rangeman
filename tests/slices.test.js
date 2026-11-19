// Slices of a range by equity in a matchup, and blocked shares (src/core/slices.js).
import { Range, ready, sliceByEquity, blockedShare, handEquitySync, idOfHand, COMBO_COUNT, HAND_STRINGS } from '../src/core/index.js';
import { loadBitVal } from '../src/core/load.js';

const OPENER = '66+,A9s+,KTs+,QTs+,JTs,T9s,ATo+,KJo+';
const DEFENDER = '22-88:0.6,A2s-A8s,K9s,Q9s+,J9s+:0.25,T8s+,97s+,87s,76s,A9o-AJo,KTo-KQo,QJo';
const TURN = ['Ad', '7c', '6h', '2s'];
const sum = v => v.reduce((a, b) => a + b, 0);

describe('sliceByEquity / Side#strongest', () => {
  it('takes exactly the share with ties split, ordered by equity in the matchup', async () => {
    await ready();
    const m = Range.from(OPENER).vsSync(DEFENDER, TURN);
    const v = m.villain;
    let dealable = 0;
    for (const id of v.range.ids) if (!Number.isNaN(v.equity[id])) dealable += v.range.weights[id];
    for (const share of [0.1, 0.25, 0.5, 0.63]) {
      const slice = v.strongest(share, { ties: 'split' });
      expect(sum(slice.weights)).toBeCloseTo(share * dealable, 9);
      // Every combo kept at full weight is at least as strong as every combo left out
      const kept = [...slice.ids].filter(id => slice.weights[id] === v.range.weights[id]);
      const dropped = [...v.range.ids].filter(id => !(slice.weights[id] > 0) && !Number.isNaN(v.equity[id]));
      const minKept = Math.min(...kept.map(id => v.equity[id])), maxDropped = Math.max(...dropped.map(id => v.equity[id]));
      expect(minKept).toBeGreaterThanOrEqual(maxDropped - 1e-12);
      // The weakest share is the mirror
      const low = v.weakest(share, { ties: 'split' });
      expect(sum(low.weights)).toBeCloseTo(share * dealable, 9);
    }
  });

  it('keeps the whole tied group by default, and splits it pro rata', () => {
    const weights = new Float64Array(COMBO_COUNT), equity = new Float64Array(COMBO_COUNT).fill(NaN);
    const [a, b, c, d] = [0, 1, 2, 3];
    weights[a] = 1; equity[a] = 0.9;
    weights[b] = 1; equity[b] = 0.5; weights[c] = 0.5; equity[c] = 0.5 + 1e-15; // tied (rounding noise)
    weights[d] = 1; equity[d] = 0.1;
    weights[4] = 1; // NaN equity: left out
    // total 3.5; 50% = 1.75 = a (1) + 0.75 of the tied group (1.5) -> factor 0.5
    const split = sliceByEquity(weights, equity, 0.5, { ties: 'split' });
    expect([split[a], split[b], split[c], split[d], split[4]]).toEqual([1, 0.5, 0.25, 0, 0]);
    const keep = sliceByEquity(weights, equity, 0.5);
    expect([keep[a], keep[b], keep[c], keep[d]]).toEqual([1, 1, 0.5, 0]);
    expect(sum(sliceByEquity(weights, equity, 0.5, { from: 'bottom', ties: 'split' }))).toBeCloseTo(1.75, 12);
    expect(() => sliceByEquity(weights, equity, 1.5)).toThrow('share');
  });

  it('feeds handEquitySync as the other side', async () => {
    await ready();
    const m = Range.from(OPENER).vsSync(DEFENDER, TURN);
    const top = m.villain.strongest(0.25, { ties: 'split' });
    const bitval = await loadBitVal();
    const hero = Range.from(OPENER);
    const result = handEquitySync(bitval, { heroIds: hero.ids, heroWeight: hero.weights, villainIds: top.ids, villainWeight: top.weights, board: TURN });
    const vsTop = Range.from(OPENER).vsSync(top, TURN);
    for (const id of hero.ids) expect(result.hero.win[id]).toBe(vsTop.hero.win[id]);
  });
});

describe('blockedShare', () => {
  it('is the share of the weights held by combos sharing a card', () => {
    const villain = Range.from(DEFENDER);
    const ids = Range.from(OPENER).ids;
    const shares = blockedShare(ids, villain.weights);
    const total = sum(villain.weights);
    ids.forEach((id, i) => {
      const [c1, c2] = [HAND_STRINGS[id].slice(0, 2), HAND_STRINGS[id].slice(2)];
      let blocked = 0;
      for (const v of villain.ids) if ([c1, c2].some(c => HAND_STRINGS[v].includes(c))) blocked += villain.weights[v];
      expect(shares[i]).toBeCloseTo(blocked / total, 12);
    });
  });

  it('is exactly 0 for a hand that blocks nothing, and works on any weight vector', () => {
    const villain = Range.from('AhQh:0.123456789,KhJd:0.987654321');
    const [none, some] = blockedShare([idOfHand('2c2d'), idOfHand('AhKh')], villain.weights);
    expect(none).toBe(0);
    expect(some).toBeCloseTo(1, 12); // AhKh blocks both villain combos
    expect(Array.from(blockedShare([idOfHand('AhKh')], new Float64Array(COMBO_COUNT)))).toEqual([0]);
  });
});
