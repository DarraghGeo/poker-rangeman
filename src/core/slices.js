// Slices of a range by equity, and blocked shares. Arithmetic on weight and equity vectors by combo id
// (Float64Array(1326)); the equities themselves come from poker-bitvaljs. Synchronous; browser-safe.

import { COMBO_COUNT, COMBO_LO, COMBO_HI } from './cards.js';

// Combos holding each card (51 per card)
const COMBOS_WITH_CARD = Array.from({ length: 52 }, () => []);
for (let id = 0; id < COMBO_COUNT; id++) {
  COMBOS_WITH_CARD[COMBO_LO[id]].push(id);
  COMBOS_WITH_CARD[COMBO_HI[id]].push(id);
}

// Equities this close count as equal: poker-bitvaljs sums weighted counts in its own order, so mathematically equal
// hands can differ in the last bits
const TIE = 1e-12;

/**
 * The strongest (or weakest) share of a weighted range by equity: a Float64Array(1326) weight vector by combo id, ready
 * to pass as weights to handEquity/handEquitySync.
 * - weights: Float64Array(1326) by combo id; equity: Float64Array(1326) by combo id (each combo's equity against the
 *   other range, e.g. a Matchup side's `equity`). Combos with NaN equity (blocked) or no weight are left out; share is of
 *   the weight that remains.
 * - options.from: 'top' (default, strongest) or 'bottom' (weakest).
 * - options.ties: 'keep' (default) keeps every combo tied with the last one taken, so the slice can hold more than the
 *   share; 'split' gives each tied combo the same fraction of its weight, so the slice holds exactly the share.
 *   Equities within 1e-12 of each other count as tied.
 */
export function sliceByEquity(weights, equity, share, { from = 'top', ties = 'keep' } = {}) {
  if (typeof share !== 'number' || !(share >= 0 && share <= 1)) throw new Error(`share must be a number from 0 to 1, got ${share}`);
  if (from !== 'top' && from !== 'bottom') throw new Error(`from must be 'top' or 'bottom', got ${from}`);
  if (ties !== 'keep' && ties !== 'split') throw new Error(`ties must be 'keep' or 'split', got ${ties}`);
  const ids = [];
  let total = 0;
  for (let id = 0; id < COMBO_COUNT; id++) {
    if (weights[id] > 0 && !Number.isNaN(equity[id])) { ids.push(id); total += weights[id]; }
  }
  const out = new Float64Array(COMBO_COUNT);
  const target = share * total;
  if (ids.length === 0 || target <= 1e-12) return out;
  const sign = from === 'top' ? -1 : 1;
  ids.sort((a, b) => sign * (equity[a] - equity[b]) || a - b);
  // The cut-off: the equity of the combo where the cumulative weight reaches the target
  let cumulative = 0, cutoff = equity[ids[ids.length - 1]];
  for (const id of ids) {
    cumulative += weights[id];
    if (cumulative >= target - 1e-9) { cutoff = equity[id]; break; }
  }
  const beyond = id => (from === 'top' ? equity[id] > cutoff + TIE : equity[id] < cutoff - TIE);
  const tied = id => Math.abs(equity[id] - cutoff) <= TIE;
  let above = 0, group = 0;
  for (const id of ids) {
    if (beyond(id)) above += weights[id];
    else if (tied(id)) group += weights[id];
  }
  const factor = ties === 'split' ? Math.min(1, (target - above) / group) : 1;
  for (const id of ids) {
    if (beyond(id)) out[id] = weights[id];
    else if (tied(id)) out[id] = weights[id] * factor;
  }
  return out;
}

/**
 * For each combo in `ids`, the share of `weights`' total held by combos that share a card with it (itself included,
 * when it carries weight): how much of that weighted range the combo blocks. Summed directly over the 101 combos
 * holding either card, so a combo that blocks nothing gets exactly 0. Returns a Float64Array aligned with `ids`
 * (all 0 when the weights total 0).
 */
export function blockedShare(ids, weights) {
  let total = 0;
  for (let id = 0; id < COMBO_COUNT; id++) if (weights[id] > 0) total += weights[id];
  const out = new Float64Array(ids.length);
  if (!(total > 0)) return out;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const lo = COMBO_LO[id], hi = COMBO_HI[id];
    let blocked = 0;
    for (const other of COMBOS_WITH_CARD[lo]) if (weights[other] > 0) blocked += weights[other];
    // Combos holding the second card, except those also holding the first (already counted)
    for (const other of COMBOS_WITH_CARD[hi]) {
      if (weights[other] > 0 && COMBO_LO[other] !== lo && COMBO_HI[other] !== lo) blocked += weights[other];
    }
    out[i] = blocked / total;
  }
  return out;
}
