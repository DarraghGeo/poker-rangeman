// Per-hand equity from poker-bitvaljs. Every equity number in poker-rangeman comes from poker-bitvaljs: this file only
// turns combo ids and weights into its range entries and its per-hand rows back into arrays indexed by combo id.
// No counting happens here.

import { COMBO_COUNT, HAND_STRINGS, idOfAnyHand, cardString } from './cards.js';

const entries = (ids, weight) => {
  const out = [];
  for (const id of ids) {
    const w = weight[id];
    if (!(w > 0)) continue;
    out.push(w === 1 ? HAND_STRINGS[id] : { hand: HAND_STRINGS[id], weight: w });
  }
  return out;
};

// One side's rows, by combo id
function byId(side) {
  const win = new Float64Array(COMBO_COUNT), tie = new Float64Array(COMBO_COUNT), lose = new Float64Array(COMBO_COUNT);
  side.hands.forEach((hand, i) => {
    const id = idOfAnyHand(hand);
    win[id] = side.win[i]; tie[id] = side.tie[i]; lose[id] = side.lose[i];
  });
  return { win, tie, lose };
}

/**
 * Every hero hand's win/tie/lose against the villain range, and every villain hand's against the hero range, from one
 * poker-bitvaljs compareRangeHands call. Each hand's counts are weighted by the other side's weights. Arrays are
 * Float64Array(1326) by combo id (zeros for hands not in the range, clashing with the board, or blocked by every
 * opposing combo). board / dead: card numbers or strings.
 */
export async function handEquity(bitval, { heroIds, heroWeight, villainIds, villainWeight, board, dead = [], iterations = 10000, workers = false }) {
  const cards = list => list.map(card => (typeof card === 'number' ? cardString(card) : card));
  const hero = entries(heroIds, heroWeight);
  const villain = entries(villainIds, villainWeight);
  if (hero.length === 0 || villain.length === 0) {
    const empty = () => ({ win: new Float64Array(COMBO_COUNT), tie: new Float64Array(COMBO_COUNT), lose: new Float64Array(COMBO_COUNT) });
    return { hero: empty(), villain: empty(), total: { win: 0, tie: 0, lose: 0 } };
  }
  const result = await bitval.compareRangeHands(hero, villain, cards(board), cards(dead), 5, iterations, true, null, 100, Boolean(workers));
  return { hero: byId(result.hero), villain: byId(result.villain), total: { win: result.win, tie: result.tie, lose: result.lose } };
}
