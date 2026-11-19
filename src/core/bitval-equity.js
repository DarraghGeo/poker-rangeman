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

const equityOf = (w, t, l) => {
  const total = w + t + l;
  return total > 0 ? (w + t / 2) / total : NaN;
};

// poker-bitvaljs's byCard rows (hand-major, i * 52 + card) by combo id: { win, tie, lose, equity }, each
// Float64Array(1326 * 52). NaN for combos not in the range, cards on the board, dead or in the hand; equity is also NaN
// where the combo meets nothing on that card.
function byCardById(side) {
  const size = COMBO_COUNT * 52;
  const win = new Float64Array(size).fill(NaN), tie = new Float64Array(size).fill(NaN);
  const lose = new Float64Array(size).fill(NaN), equity = new Float64Array(size).fill(NaN);
  const rows = side.byCard;
  side.hands.forEach((hand, i) => {
    const id = idOfAnyHand(hand);
    for (let c = 0; c < 52; c++) {
      const from = i * 52 + c, to = id * 52 + c;
      win[to] = rows.win[from]; tie[to] = rows.tie[from]; lose[to] = rows.lose[from];
      equity[to] = equityOf(rows.win[from], rows.tie[from], rows.lose[from]);
    }
  });
  return { win, tie, lose, equity };
}

// poker-bitvaljs's byRunout rows as equity, kept in its row order (only the range's hands: id-indexed rows for all
// 1,326 combos would mostly be empty and take ~12 MB per side): { equity: Float64Array(rows * n), n, rowOf }, where
// rowOf[id] is the combo's row (-1 if not in the range) and equity[rowOf[id] * n + k] its equity on runout k
function byRunoutRows(side, n) {
  const rows = side.byRunout;
  const count = side.hands.length;
  const equity = new Float64Array(count * n);
  const rowOf = new Int16Array(COMBO_COUNT).fill(-1);
  for (let i = 0; i < count; i++) {
    rowOf[idOfAnyHand(side.hands[i])] = i;
    const base = i * n;
    for (let k = 0; k < n; k++) {
      const w = rows.win[base + k], t = rows.tie[base + k], total = w + t + rows.lose[base + k];
      equity[base + k] = total > 0 ? (w + t / 2) / total : NaN;
    }
  }
  return { equity, n, rowOf };
}

// The range entries for a job, or null when a side is empty (nothing to ask poker-bitvaljs)
function request({ heroIds, heroWeight, villainIds, villainWeight, board, dead = [], byCard = false, byRunout = false }) {
  const cards = list => list.map(card => (typeof card === 'number' ? cardString(card) : card));
  if ((byCard || byRunout) && board.length !== 3 && board.length !== 4) throw new Error('byCard/byRunout need a flop or turn board');
  if (byRunout && board.length !== 3) throw new Error('byRunout needs a flop board');
  const hero = entries(heroIds, heroWeight);
  const villain = entries(villainIds, villainWeight);
  return hero.length && villain.length ? { hero, villain, board: cards(board), dead: cards(dead) } : null;
}

function emptyResult() {
  const empty = () => ({ win: new Float64Array(COMBO_COUNT), tie: new Float64Array(COMBO_COUNT), lose: new Float64Array(COMBO_COUNT) });
  return { hero: empty(), villain: empty(), total: { win: 0, tie: 0, lose: 0 } };
}

function read(result, job) {
  const out = { hero: byId(result.hero), villain: byId(result.villain), total: { win: result.win, tie: result.tie, lose: result.lose } };
  if (job.byCard) {
    out.hero.byCard = byCardById(result.hero);
    out.villain.byCard = byCardById(result.villain);
  }
  if (job.byRunout) {
    const n = result.runouts.length / result.runoutSize;
    out.hero.byRunout = byRunoutRows(result.hero, n);
    out.villain.byRunout = byRunoutRows(result.villain, n);
    out.runouts = Uint8Array.from(result.runouts);
    out.runoutSize = result.runoutSize;
  }
  return out;
}

const bitvalOptions = job => ({ useWorkers: Boolean(job.workers), byCard: Boolean(job.byCard), byRunout: Boolean(job.byRunout) });

/**
 * Every hero hand's win/tie/lose against the villain range, and every villain hand's against the hero range, from one
 * poker-bitvaljs compareRangeHands call. Each hand's counts are weighted by the other side's weights. Arrays are
 * Float64Array(1326) by combo id (zeros for hands not in the range, clashing with the board, or blocked by every
 * opposing combo). board / dead: card numbers or strings. With job.byCard (flop or turn) each side also has byCard
 * (every next card), and with job.byRunout (flop) byRunout (every turn + river pair) plus runouts / runoutSize.
 */
export async function handEquity(bitval, job) {
  const req = request(job);
  if (!req) return emptyResult();
  const result = await bitval.compareRangeHands(req.hero, req.villain, req.board, req.dead, 5, job.iterations ?? 10000, true, bitvalOptions(job));
  return read(result, job);
}

/** handEquity() synchronously, from poker-bitvaljs's compareRangeHandsSync (no workers). */
export function handEquitySync(bitval, job) {
  const req = request(job);
  if (!req) return emptyResult();
  return read(bitval.compareRangeHandsSync(req.hero, req.villain, req.board, req.dead, 5, job.iterations ?? 10000, true, { ...bitvalOptions(job), useWorkers: false }), job);
}
