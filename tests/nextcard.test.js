// Equity per next card (byCard) and per runout (byRunout), from poker-bitvaljs 1.13's compareRangeHandsSync options.
import { Range, ready, idOfHand, cardIndex, cardString, HAND_STRINGS } from '../src/core/index.js';
import { loadBitVal } from '../src/core/load.js';

const HERO = '66+,A9s+,KTs+,QTs+,JTs,T9s,ATo+,KJo+';
const VILLAIN = '22-88:0.6,A2s-A8s,K9s,Q9s+,J9s+:0.25,T8s+,97s+,87s,76s,A9o-AJo,KTo-KQo,QJo';
const FLOP = ['Ad', '7c', '6h'];
const TURN = ['Ad', '7c', '6h', '2s'];
const entries = r => [...r.ids].map(id => (r.weights[id] === 1 ? HAND_STRINGS[id] : { hand: HAND_STRINGS[id], weight: r.weights[id] }));
const close = (a, b) => (Number.isNaN(a) ? Number.isNaN(b) : Math.abs(a - b) <= 1e-12);

let bv;
beforeAll(async () => { await ready(); bv = await loadBitVal(); });

describe('byCard', () => {
  it('re-indexes poker-bitvaljs rows by combo id, unchanged', () => {
    const hero = Range.from(HERO), villain = Range.from(VILLAIN);
    const m = hero.vsSync(villain, TURN, { byCard: true });
    const raw = bv.compareRangeHandsSync(entries(hero), entries(villain), TURN, [], 5, 1, true, { byCard: true });
    for (const [side, rows] of [[m.hero, raw.hero], [m.villain, raw.villain]]) {
      rows.hands.forEach((hand, i) => {
        const id = idOfHand(hand);
        for (let c = 0; c < 52; c++) {
          for (const k of ['win', 'tie', 'lose']) expect(close(side.byCard[k][id * 52 + c], rows.byCard[k][i * 52 + c])).toBe(true);
        }
      });
    }
  });

  it('turn: counts over the next cards sum to the totals; each card equals vsSync on the river', () => {
    const m = Range.from(HERO).vsSync(VILLAIN, TURN, { byCard: true });
    const h = m.hero;
    for (const id of h.range.ids) {
      if (Number.isNaN(h.equity[id])) continue;
      const s = { win: 0, tie: 0, lose: 0 };
      for (let c = 0; c < 52; c++) for (const k of Object.keys(s)) { const x = h.byCard[k][id * 52 + c]; if (!Number.isNaN(x)) s[k] += x; }
      for (const k of Object.keys(s)) expect(s[k]).toBeCloseTo(h[k][id], 6);
    }
    for (const card of ['Kd', '7h', '3c']) {
      const c = cardIndex(card);
      const river = Range.from(HERO).vsSync(VILLAIN, [...TURN, card]);
      for (const id of h.range.ids) {
        const a = h.byCard.equity[id * 52 + c], b = river.hero.equity[id];
        if (Number.isNaN(b)) expect(Number.isNaN(a)).toBe(true);
        else expect(a).toBeCloseTo(b, 12);
      }
    }
  });

  it('flop: each runout counts toward both its cards (rows sum to twice the totals)', () => {
    const m = Range.from(HERO).vsSync(VILLAIN, FLOP, { byCard: true });
    const id = idOfHand('KhKs');
    let w = 0;
    for (let c = 0; c < 52; c++) { const x = m.hero.byCard.win[id * 52 + c]; if (!Number.isNaN(x)) w += x; }
    expect(w).toBeCloseTo(2 * m.hero.win[id], 6);
  });

  it('NaN for board cards, own cards and combos not in the range', () => {
    const m = Range.from('KhKs,QQ').vsSync('AA,77', TURN, { byCard: true });
    const id = idOfHand('KhKs');
    for (const card of [...TURN, 'Kh', 'Ks']) expect(Number.isNaN(m.hero.byCard.equity[id * 52 + cardIndex(card)])).toBe(true);
    expect(Number.isNaN(m.hero.byCard.win[idOfHand('JcJd') * 52 + cardIndex('3c')])).toBe(true);
    expect(Number.isFinite(m.hero.byCard.equity[id * 52 + cardIndex('3c')])).toBe(true);
  });

  it('a hand blocked by every villain combo on a card meets nothing: 0/0/0 and NaN equity', () => {
    // Villain holds only Ah-combos: on the Ah river, hero's hands meet nothing
    const m = Range.from('KhKs').vsSync('AhQc,AhJc', TURN, { byCard: true });
    const at = idOfHand('KhKs') * 52 + cardIndex('Ah');
    expect([m.hero.byCard.win[at], m.hero.byCard.tie[at], m.hero.byCard.lose[at]]).toEqual([0, 0, 0]);
    expect(Number.isNaN(m.hero.byCard.equity[at])).toBe(true);
  });

  it('weights the other side (nine-decimal weights)', () => {
    const villain = 'QQ:0.123456789,JJ:0.987654321,AKs:0.333333333';
    const m = Range.from(HERO).vsSync(villain, TURN, { byCard: true });
    const c = cardIndex('9h');
    const river = Range.from(HERO).vsSync(villain, [...TURN, '9h']);
    for (const id of m.hero.range.ids) {
      const a = m.hero.byCard.equity[id * 52 + c], b = river.hero.equity[id];
      if (Number.isNaN(b)) expect(Number.isNaN(a)).toBe(true);
      else expect(a).toBeCloseTo(b, 12);
    }
  });

  it('async vs() gives the same rows', async () => {
    const a = await Range.from(HERO).vs(VILLAIN, TURN, { byCard: true });
    const b = Range.from(HERO).vsSync(VILLAIN, TURN, { byCard: true });
    for (let i = 0; i < a.hero.byCard.equity.length; i++) expect(close(a.hero.byCard.equity[i], b.hero.byCard.equity[i])).toBe(true);
  });
});

describe('byRunout', () => {
  it('flop: every turn + river pair; equities weighted by runout counts give the totals', () => {
    const hero = Range.from(HERO), villain = Range.from(VILLAIN);
    const m = hero.vsSync(villain, FLOP, { byRunout: true });
    expect(m.runoutSize).toBe(2);
    expect(m.runouts.length / 2).toBe(1176); // C(49, 2)
    const { equity, n, rowOf } = m.hero.byRunout;
    expect(n).toBe(1176);
    const raw = bv.compareRangeHandsSync(entries(hero), entries(villain), FLOP, [], 5, 1, true, { byRunout: true });
    raw.hero.hands.forEach((hand, i) => {
      const id = idOfHand(hand);
      const row = rowOf[id];
      expect(row).toBeGreaterThanOrEqual(0);
      let points = 0, total = 0;
      for (let k = 0; k < n; k++) {
        const w = raw.hero.byRunout.win[i * n + k], t = raw.hero.byRunout.tie[i * n + k], l = raw.hero.byRunout.lose[i * n + k];
        if (Number.isNaN(w)) { expect(Number.isNaN(equity[row * n + k])).toBe(true); continue; }
        const sum = w + t + l;
        if (sum > 0) { expect(equity[row * n + k]).toBeCloseTo((w + t / 2) / sum, 12); points += equity[row * n + k] * sum; total += sum; }
      }
      if (total > 0) expect(points / total).toBeCloseTo(m.hero.equity[id], 9);
    });
    expect(rowOf[idOfHand('2c2d')]).toBe(-1);
  });

  it('a runout matches vsSync on the river', () => {
    const m = Range.from(HERO).vsSync(VILLAIN, FLOP, { byRunout: true });
    const { equity, n, rowOf } = m.hero.byRunout;
    const k = 100;
    const cards = [m.runouts[k * 2], m.runouts[k * 2 + 1]];
    const river = Range.from(HERO).vsSync(VILLAIN, [...FLOP, ...cards.map(cardString)]);
    for (const id of m.hero.range.ids) {
      const a = equity[rowOf[id] * n + k], b = river.hero.equity[id];
      if (Number.isNaN(b)) expect(Number.isNaN(a)).toBe(true);
      else expect(a).toBeCloseTo(b, 12);
    }
  });
});

describe('errors and defaults', () => {
  it('needs a flop or turn board; byRunout a flop', () => {
    expect(() => Range.from(HERO).vsSync(VILLAIN, [], { byCard: true })).toThrow('byCard/byRunout need a flop or turn board');
    expect(() => Range.from(HERO).vsSync(VILLAIN, [...TURN, 'Kc'], { byCard: true })).toThrow('byCard/byRunout need a flop or turn board');
    expect(() => Range.from(HERO).vsSync(VILLAIN, TURN, { byRunout: true })).toThrow('byRunout needs a flop board');
  });

  it('null without the options', () => {
    const m = Range.from(HERO).vsSync(VILLAIN, TURN);
    expect(m.hero.byCard).toBeNull();
    expect(m.hero.byRunout).toBeNull();
    expect(m.runouts).toBeNull();
  });

  it('speed: ~300 x 300 turn with byCard', () => {
    const wide = Range.from('22+,A2s+,K2s+,Q6s+,J7s+,T7s+,97s+,87s,76s,65s,54s,A2o+,K9o+,QTo+,JTo');
    const v = Range.from('22+,A2s+,K5s+,Q8s+,J8s+,T8s+,98s,87s,76s,ATo+,KTo+,QJo');
    for (let i = 0; i < 3; i++) wide.vsSync(v, TURN, { byCard: true });
    const t = performance.now();
    for (let i = 0; i < 5; i++) wide.vsSync(v, TURN, { byCard: true });
    const ms = (performance.now() - t) / 5;
    console.log(`turn byCard ${wide.size} x ${v.size}: ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(100);
  });
});
