// Range vs range equity for every combo at once. Browser-safe: no Node built-ins.
//
// For each runout of the deck, every live combo is scored once with poker-bitvaljs's evaluateSuits, both sides are
// sorted by score, and one sweep in score order gives each combo its win, tie and lose weight against the other
// side. Card removal is exact: the sweep keeps the other side's cumulative weight per card, so the combos that
// share a card with this one are subtracted (inclusion-exclusion on its two cards). Each hero/villain pair counts
// exactly the runouts that avoid its four cards, as in poker-bitvaljs's compareRange, with weight hw * vw.
//
// Postflop every runout is enumerated (exact). Preflop, boards are sampled (Monte Carlo) and shared by all combos.

import { COMBO_COUNT, COMBO_LO, COMBO_HI, COMBO_LANE } from './cards.js';

const [LANE_S, LANE_H, LANE_D, LANE_C] = COMBO_LANE;

// Scratch buffers, reused across calls (single-threaded; each worker has its own module instance)
const valueById = new Int32Array(COMBO_COUNT);
const sortedA = { ids: new Uint16Array(COMBO_COUNT), values: new Int32Array(COMBO_COUNT) };
const sortedB = { ids: new Uint16Array(COMBO_COUNT), values: new Int32Array(COMBO_COUNT) };
const sortedC = { ids: new Uint16Array(COMBO_COUNT), values: new Int32Array(COMBO_COUNT) };
const less = new Float64Array(52);
const lessEq = new Float64Array(52);
const all = new Float64Array(52);

/**
 * @param {object} bv        A poker-bitvaljs instance (for evaluateSuits)
 * @param {object} job
 * @param {Uint16Array|number[]} job.heroIds     Hero combo ids
 * @param {Float64Array} job.heroWeight          Weight by combo id (1326), used for villain's side
 * @param {Uint16Array|number[]} job.villainIds  Villain combo ids
 * @param {Float64Array} job.villainWeight       Weight by combo id (1326)
 * @param {number[]} job.board                   Board card numbers (0, 3, 4 or 5)
 * @param {number[]} job.dead                    Dead card numbers
 * @param {number} [job.iterations=10000]        Boards sampled preflop
 * @param {boolean} [job.both=false]             Also villain's results against hero
 * @param {number} [job.seed]                    Preflop sampling seed
 * @param {number} [job.from=0]                  First runout index to enumerate (for splitting work across workers)
 * @param {number} [job.to=Infinity]             Runout index to stop before
 * @returns {{ hero: {win, tie, lose}, villain?: {win, tie, lose}, runouts: number }} Float64Arrays aligned with the
 *   id lists. A combo holding a board card gets 0 everywhere.
 */
export function rangeEquity(bv, job) {
  const { heroIds, villainIds, heroWeight, villainWeight, board, dead = [], both = false } = job;
  // Dead cards leave the deck; a combo that holds one still plays (as in compareRange). Combos that clash with
  // the board can't be dealt.
  const onBoard = new Uint8Array(52);
  for (const c of board) onBoard[c] = 1;
  const blocked = onBoard.slice();
  for (const c of dead) blocked[c] = 1;

  const hero = side(heroIds);
  const villain = both ? side(villainIds) : null;

  // Live combos on the board (no board or dead card), each side
  const heroLive = liveIds(heroIds, onBoard, null);
  const villainLive = liveIds(villainIds, onBoard, villainWeight);
  const heroPos = positions(heroIds);
  const villainPos = both ? positions(villainIds) : null;
  if (heroLive.length === 0 || villainLive.length === 0) return { hero, villain, runouts: 0 };
  let heroLiveW = both ? liveIds(heroIds, onBoard, heroWeight) : null;
  // Usually every hero combo has weight: then villain's sweep can reuse hero's sorted list
  if (heroLiveW && heroLiveW.length === heroLive.length) heroLiveW = heroLive;

  // Union of combos to score on each runout
  const scored = new Uint8Array(COMBO_COUNT);
  const union = [];
  for (const id of heroLive) if (!scored[id]) { scored[id] = 1; union.push(id); }
  for (const id of villainLive) if (!scored[id]) { scored[id] = 1; union.push(id); }
  if (heroLiveW) for (const id of heroLiveW) if (!scored[id]) { scored[id] = 1; union.push(id); }

  let bs = 0, bh = 0, bd = 0, bc = 0;
  for (const c of board) {
    const bit = 1 << (c >> 2);
    switch (c & 3) { case 0: bs |= bit; break; case 1: bh |= bit; break; case 2: bd |= bit; break; default: bc |= bit; }
  }
  const deck = [];
  for (let c = 0; c < 52; c++) if (!blocked[c]) deck.push(c);
  const missing = 5 - board.length;

  const runout = (r1, r2, r3, r4, r5, s, h, d, cl) => {
    // Score the live combos on this full board
    for (let i = 0; i < union.length; i++) {
      const id = union[i];
      const lo = COMBO_LO[id], hi = COMBO_HI[id];
      if (lo === r1 || lo === r2 || lo === r3 || lo === r4 || lo === r5 || hi === r1 || hi === r2 || hi === r3 || hi === r4 || hi === r5) {
        valueById[id] = -1;
      } else {
        valueById[id] = bv.evaluateSuits(s | LANE_S[id], h | LANE_H[id], d | LANE_D[id], cl | LANE_C[id]);
      }
    }
    const nh = sortByValue(heroLive, sortedA);
    const nv = sortByValue(villainLive, sortedB);
    sweep(sortedA, nh, heroPos, sortedB, nv, villainWeight, hero);
    if (both) {
      if (heroLiveW === heroLive) sweep(sortedB, nv, villainPos, sortedA, nh, heroWeight, villain);
      else sweep(sortedB, nv, villainPos, sortedC, sortByValue(heroLiveW, sortedC), heroWeight, villain);
    }
  };

  let runouts = 0;
  const from = job.from ?? 0;
  const to = job.to ?? Infinity;
  if (missing === 0) {
    runout(-1, -1, -1, -1, -1, bs, bh, bd, bc);
    runouts = 1;
  } else if (missing <= 2) {
    // Enumerate every runout (exact)
    let index = 0;
    const n = deck.length;
    if (missing === 1) {
      for (let i = 0; i < n; i++, index++) {
        if (index < from || index >= to) continue;
        const a = deck[i];
        const [s, h, d, cl] = addCard(bs, bh, bd, bc, a);
        runout(a, -1, -1, -1, -1, s, h, d, cl);
        runouts++;
      }
    } else {
      for (let i = 0; i < n; i++) {
        const a = deck[i];
        const [s1, h1, d1, c1] = addCard(bs, bh, bd, bc, a);
        for (let j = i + 1; j < n; j++, index++) {
          if (index < from || index >= to) continue;
          const b = deck[j];
          const [s, h, d, cl] = addCard(s1, h1, d1, c1, b);
          runout(a, b, -1, -1, -1, s, h, d, cl);
          runouts++;
        }
      }
    }
  } else {
    // Preflop (or a 1-2 card board): sample the missing cards, shared by every combo
    const iterations = job.iterations ?? 10000;
    let seed = (job.seed ?? (Math.random() * 0x7fffffff)) | 0 || 1;
    const random = () => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    };
    const cards = deck.slice();
    const picked = [-1, -1, -1, -1, -1];
    for (let it = 0; it < iterations; it++) {
      let s = bs, h = bh, d = bd, cl = bc;
      for (let k = 0; k < missing; k++) {
        const j = k + Math.floor(random() * (cards.length - k));
        const t = cards[k]; cards[k] = cards[j]; cards[j] = t;
        picked[k] = cards[k];
        [s, h, d, cl] = addCard(s, h, d, cl, cards[k]);
      }
      runout(picked[0], picked[1], picked[2], picked[3], picked[4], s, h, d, cl);
    }
    runouts = iterations;
  }
  if (weighted(heroWeight, heroIds) || weighted(villainWeight, villainIds)) {
    snap(hero);
    if (villain) snap(villain);
  }
  return { hero, villain, runouts };
}

// Fractional weights make the counts sums of weight x runouts, and the sweep adds them in its own order, so equal
// hands can differ in the last bits (0.6 + 1.2 vs 1.2 + 0.6). The true counts sit on a grid as fine as the weights'
// decimals; snapping to 1e-6 recovers them for weights of up to six decimals, so equal hands tie exactly.
const SNAP = 1e6;
function snap(side) {
  for (const counts of [side.win, side.tie, side.lose]) {
    for (let i = 0; i < counts.length; i++) {
      const x = counts[i];
      if (Math.abs(x) < 1e9) counts[i] = Math.round(x * SNAP) / SNAP;
    }
  }
}

function weighted(weight, ids) {
  for (const id of ids) {
    const w = weight[id];
    if (w > 0 && w !== 1) return true;
  }
  return false;
}

/** The number of runouts rangeEquity enumerates on this board, or 0 when it samples (preflop). */
export function runoutCount(board, dead = []) {
  const blocked = new Set([...board, ...dead]);
  const n = 52 - blocked.size;
  const missing = 5 - board.length;
  if (missing === 0) return 1;
  if (missing === 1) return n;
  if (missing === 2) return (n * (n - 1)) / 2;
  return 0;
}

function side(ids) {
  return { win: new Float64Array(ids.length), tie: new Float64Array(ids.length), lose: new Float64Array(ids.length) };
}

// Ids without a blocked card (and with weight > 0 when weights are given)
function liveIds(ids, blocked, weight) {
  const out = [];
  for (const id of ids) {
    if (blocked[COMBO_LO[id]] || blocked[COMBO_HI[id]]) continue;
    if (weight && !(weight[id] > 0)) continue;
    out.push(id);
  }
  return out;
}

// Combo id -> its index in the id list
function positions(ids) {
  const pos = new Int32Array(COMBO_COUNT).fill(-1);
  for (let i = 0; i < ids.length; i++) pos[ids[i]] = i;
  return pos;
}

function addCard(s, h, d, c, card) {
  const bit = 1 << (card >> 2);
  switch (card & 3) {
    case 0: return [s | bit, h, d, c];
    case 1: return [s, h | bit, d, c];
    case 2: return [s, h, d | bit, c];
    default: return [s, h, d, c | bit];
  }
}

// Radix sort buffers: values are poker-bitvaljs scores (24 bits), sorted 8 bits per pass
const tmpValues = new Int32Array(COMBO_COUNT);
const tmpIds = new Uint16Array(COMBO_COUNT);
const counts = new Int32Array(256);

// Sorts a side's live combos by value (ascending) into out.ids / out.values; returns how many
function sortByValue(ids, out) {
  let n = 0;
  const values = out.values, outIds = out.ids;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const v = valueById[id];
    if (v >= 0) { values[n] = v; outIds[n] = id; n++; }
  }
  // LSD radix sort, three passes of 8 bits: out -> tmp -> out -> tmp, then copy back
  let srcV = values, srcI = outIds, dstV = tmpValues, dstI = tmpIds;
  for (let shift = 0; shift < 24; shift += 8) {
    counts.fill(0);
    for (let i = 0; i < n; i++) counts[(srcV[i] >>> shift) & 255]++;
    let sum = 0;
    for (let b = 0; b < 256; b++) { const c = counts[b]; counts[b] = sum; sum += c; }
    for (let i = 0; i < n; i++) {
      const pos = counts[(srcV[i] >>> shift) & 255]++;
      dstV[pos] = srcV[i];
      dstI[pos] = srcI[i];
    }
    [srcV, dstV] = [dstV, srcV];
    [srcI, dstI] = [dstI, srcI];
  }
  // After three passes the sorted data is in the tmp buffers
  values.set(srcV.subarray(0, n));
  outIds.set(srcI.subarray(0, n));
  return n;
}

// For each combo of side A (sorted), adds its win/tie/lose weight against side B (sorted, weights by id). B's
// cumulative weight overall and per card, below and up to A's value, gives wins and ties by inclusion-exclusion.
function sweep(a, na, posA, b, nb, weightB, out) {
  less.fill(0); lessEq.fill(0); all.fill(0);
  const idsA = a.ids, valuesA = a.values, idsB = b.ids, valuesB = b.values;
  let total = 0;
  for (let k = 0; k < nb; k++) {
    const id = idsB[k];
    const w = weightB[id];
    total += w;
    all[COMBO_LO[id]] += w;
    all[COMBO_HI[id]] += w;
  }
  let lessTotal = 0, lessEqTotal = 0;
  let j = 0, k = 0;
  const { win, tie, lose } = out;
  for (let i = 0; i < na; i++) {
    const id = idsA[i];
    const value = valuesA[i];
    while (j < nb && valuesB[j] < value) {
      const vid = idsB[j];
      const w = weightB[vid];
      lessTotal += w; less[COMBO_LO[vid]] += w; less[COMBO_HI[vid]] += w;
      j++;
    }
    while (k < nb && valuesB[k] <= value) {
      const vid = idsB[k];
      const w = weightB[vid];
      lessEqTotal += w; lessEq[COMBO_LO[vid]] += w; lessEq[COMBO_HI[vid]] += w;
      k++;
    }
    const lo = COMBO_LO[id], hi = COMBO_HI[id];
    const w = lessTotal - less[lo] - less[hi];
    // The same combo on B's side shares both cards: subtracted twice from the tie and total sums
    const same = valueById[id] >= 0 ? (weightB[id] || 0) : 0;
    const t = lessEqTotal - lessEq[lo] - lessEq[hi] + same - w;
    const totalLive = total - all[lo] - all[hi] + same;
    const p = posA[id];
    win[p] += w;
    tie[p] += t;
    lose[p] += totalLive - w - t;
  }
}
