// Board texture: how wet, connected, paired, suited, high and dynamic a 3-, 4- or 5-card board is.
// Every count is exact: it goes over every two-card hand that can be dealt with the board and dead cards
// removed, ranked with poker-bitvaljs's integer evaluator.
import { BOARD_TEXTURE_SCALES } from './boardTextureScales.js';

const RANK_CHARS = '23456789TJQKA';
const SUIT_CHARS = 'shdc';
const SUIT_LABELS = [null, 'rainbow', 'twoTone', 'monotone', 'fourFlush', 'fiveFlush'];
const TWO_PAIR = 2;
// Top rank (0 = deuce ... 12 = ace) of the best straight in a 13-bit rank mask, or -1; the wheel's top is 3
const STRAIGHT_WINDOWS = Array.from({ length: 10 }, (_, i) => {
  const top = i + 3;
  return { top, mask: top === 3 ? 0b1000000001111 : 0b11111 << (top - 4) };
}).reverse();
const STRAIGHT_TOP = new Int8Array(8192).map((_, mask) => {
  const window = STRAIGHT_WINDOWS.find(w => (mask & w.mask) === w.mask);
  return window ? window.top : -1;
});
const POPCOUNT = new Uint8Array(8192).map((_, mask) => {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
});

let evaluator = null;

export async function loadEvaluator() {
  if (!evaluator) {
    const mod = await import('poker-bitvaljs');
    const BitVal = mod.default || mod;
    const bv = new BitVal();
    evaluator = (s, h, d, c) => bv.evaluateSuits(s, h, d, c);
  }
  return evaluator;
}

const cardIndex = card => RANK_CHARS.indexOf(card[0]) * 4 + SUIT_CHARS.indexOf(card[1]);

function normalizeCard(card) {
  if (typeof card !== 'string' || card.length !== 2) return null;
  const normalized = card[0].toUpperCase() + card[1].toLowerCase();
  return RANK_CHARS.includes(normalized[0]) && SUIT_CHARS.includes(normalized[1]) ? normalized : null;
}

// Dead cards take the same forms as the constructor's: concrete cards, 'Ax' (every ace) or 'Xs' (every spade)
function expandDeadCard(card) {
  if (typeof card === 'string' && card.length === 2) {
    const rank = card[0].toUpperCase();
    const suit = card[1].toLowerCase();
    if (rank === 'X' && SUIT_CHARS.includes(suit)) return [...RANK_CHARS].map(r => r + suit);
    if (RANK_CHARS.includes(rank) && suit === 'x') return [...SUIT_CHARS].map(s => rank + s);
  }
  const normalized = normalizeCard(card);
  if (!normalized) throw new Error(`Invalid card: ${card}`);
  return [normalized];
}

export function parseTextureInput(boardCards, deadCards = []) {
  deadCards = deadCards ?? [];
  if (!Array.isArray(boardCards)) throw new Error('Board cards must be an array');
  if (boardCards.length < 3 || boardCards.length > 5) throw new Error(`A board has 3, 4 or 5 cards. Got ${boardCards.length}`);
  const board = boardCards.map(card => {
    const normalized = normalizeCard(card);
    if (!normalized) throw new Error(`Invalid board card: ${card}`);
    return normalized;
  });
  if (new Set(board).size !== board.length) throw new Error('Board cards must be unique');
  if (!Array.isArray(deadCards)) throw new Error('Dead cards must be an array');
  // A wildcard covers the cards it can: 'Ax' on an ace-high board means the other aces
  const expanded = deadCards.map(card => ({ wildcard: /x/i.test(String(card)), cards: expandDeadCard(card) }));
  const onBoard = expanded.filter(d => !d.wildcard).flatMap(d => d.cards).filter(card => board.includes(card));
  if (onBoard.length > 0) throw new Error(`Dead cards cannot be on the board: ${onBoard.join(', ')}`);
  const dead = [...new Set(expanded.flatMap(d => d.cards))].filter(card => !board.includes(card));
  return { board, dead };
}

const CATEGORY = 1048576; // bitval's values hold the category from bit 20 up

// The part of a hand value that names the made hand, without kickers: the pairs of two pair, the
// trips of trips, a full house, the quads; straights and flushes keep every card (they have no kicker)
function madePart(value) {
  const category = Math.floor(value / CATEGORY);
  if (category === 2 || category === 6) return value - (value % 4096);
  if (category === 3 || category === 7) return value - (value % 65536);
  return value;
}

// The board's own made hand, as madePart() of a value; under 5 cards only its pairings count
function boardMadePart(boardIdx, suitMasks, evaluate) {
  if (boardIdx.length === 5) return madePart(evaluate(...suitMasks));
  const counts = new Array(13).fill(0);
  for (const card of boardIdx) counts[card >> 2]++;
  const ranksWith = n => counts.map((count, rank) => (count === n ? rank : -1)).filter(rank => rank >= 0).reverse();
  const [quads] = ranksWith(4);
  const [trips] = ranksWith(3);
  const pairs = ranksWith(2);
  if (quads !== undefined) return 7 * CATEGORY + quads * 65536;
  if (trips !== undefined) return 3 * CATEGORY + trips * 65536;
  if (pairs.length === 2) return 2 * CATEGORY + pairs[0] * 65536 + pairs[1] * 4096;
  return 0;
}

function rankCounts(boardIdx) {
  const counts = new Array(13).fill(0);
  for (const card of boardIdx) counts[card >> 2]++;
  return counts.filter(Boolean);
}

// Distinct straights the board allows: five-rank windows missing at most two ranks, each with a live card
function countStraights(boardRanks, live) {
  const liveRanks = live.reduce((mask, card) => mask | (1 << (card >> 2)), 0);
  return STRAIGHT_WINDOWS.filter(({ mask }) => {
    const missing = mask & ~boardRanks;
    return POPCOUNT[missing] <= 2 && (missing & liveRanks) === missing;
  }).length;
}

// Open-addressing table from a hand value to its percentile numerator, reused across calls. A
// generation stamp marks live slots, so it never needs clearing; it is a float so it never wraps
// (a Uint32 would after 2^32 calls and then never match). 4096 slots hold the at most 1176 values.
const SLOTS = 4096;
const slotKeys = new Int32Array(SLOTS);
const slotValues = new Int32Array(SLOTS);
const slotStamps = new Float64Array(SLOTS);
let stamp = 0;

// Mid-rank percentile of each value among `values`, as an integer numerator over 2 × (length − 1):
// 2 × below + ties − 1. Integers keep the dynamism sums exact, so isomorphic boards agree to the bit.
function percentileNumerators(values, length, out, sorted) {
  const view = sorted.subarray(0, length);
  view.set(values.subarray(0, length));
  view.sort();
  stamp++;
  let start = 0;
  while (start < length) {
    const value = view[start];
    let end = start + 1;
    while (end < length && view[end] === value) end++;
    let slot = Math.imul(value, 0x9e3779b1) >>> 20;
    while (slotStamps[slot] === stamp) slot = (slot + 1) & (SLOTS - 1);
    slotStamps[slot] = stamp;
    slotKeys[slot] = value;
    slotValues[slot] = start + end - 1;
    start = end;
  }
  for (let i = 0; i < length; i++) {
    const value = values[i];
    let slot = Math.imul(value, 0x9e3779b1) >>> 20;
    while (slotKeys[slot] !== value || slotStamps[slot] !== stamp) slot = (slot + 1) & (SLOTS - 1);
    out[i] = slotValues[slot];
  }
}

/**
 * The unscaled texture of a board: counts, shares and the mean change in strength percentile.
 * Synchronous; call `await loadEvaluator()` first. `board` and `dead` are normalized card strings.
 */
export function rawTexture(board, dead = []) {
  if (!evaluator) throw new Error('Call loadEvaluator() before rawTexture()');
  const evaluate = evaluator;
  const boardIdx = board.map(cardIndex);
  const excluded = new Set([...boardIdx, ...dead.map(cardIndex)]);
  const live = [];
  for (let c = 0; c < 52; c++) if (!excluded.has(c)) live.push(c);
  if (live.length < 4) throw new Error('Too few cards left to deal hands');

  const size = boardIdx.length;
  const boardSuits = [0, 0, 0, 0];
  for (const card of boardIdx) boardSuits[card & 3] |= 1 << (card >> 2);
  const boardRanks = boardSuits[0] | boardSuits[1] | boardSuits[2] | boardSuits[3];
  const boardMade = boardMadePart(boardIdx, boardSuits, evaluate);
  const boardTop = STRAIGHT_TOP[boardRanks];
  // The board's own straight once each rank comes (-1 for none)
  const boardTopWith = Int8Array.from({ length: 13 }, (_, r) => STRAIGHT_TOP[boardRanks | (1 << r)]);
  const drawsPossible = size < 5;

  const n = live.length * (live.length - 1) / 2;
  const handA = new Int8Array(n);
  const handB = new Int8Array(n);
  const masks = new Int32Array(n * 4);
  const values = new Int32Array(n);
  let made = 0, flushDraws = 0, straightDraws = 0, connected = 0, wet = 0;

  let h = 0;
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++, h++) {
      const a = live[i], b = live[j];
      handA[h] = a;
      handB[h] = b;
      const m = h * 4;
      masks[m] = boardSuits[0]; masks[m + 1] = boardSuits[1]; masks[m + 2] = boardSuits[2]; masks[m + 3] = boardSuits[3];
      masks[m + (a & 3)] |= 1 << (a >> 2);
      masks[m + (b & 3)] |= 1 << (b >> 2);
      const value = evaluate(masks[m], masks[m + 1], masks[m + 2], masks[m + 3]);
      values[h] = value;

      const category = value >>> 20;
      // Two pair or better that beats the board's own made hand, kickers aside: the hole cards make it
      const isMade = category >= TWO_PAIR && madePart(value) > boardMade;
      const ranks = boardRanks | (1 << (a >> 2)) | (1 << (b >> 2));
      const madeStraight = STRAIGHT_TOP[ranks] > boardTop;
      let flushDraw = false, straightDraw = false;
      if (drawsPossible) {
        // Four to a flush with at least one hole card in it (five would be a made flush)
        flushDraw = POPCOUNT[masks[m + (a & 3)]] === 4 || POPCOUNT[masks[m + (b & 3)]] === 4;
        // OESD or gutshot: a rank that gives the hand a straight above the one it gives the board alone
        if (!madeStraight) {
          for (let r = 0; r < 13 && !straightDraw; r++) straightDraw = STRAIGHT_TOP[ranks | (1 << r)] > boardTopWith[r];
        }
      }
      if (isMade) made++;
      if (flushDraw) flushDraws++;
      if (straightDraw) straightDraws++;
      if (madeStraight || straightDraw) connected++;
      if (isMade || flushDraw || straightDraw) wet++;
    }
  }

  return {
    combos: n,
    straights: countStraights(boardRanks, live),
    flushDraws,
    straightDraws,
    madeHands: made,
    connectedness: connected / n,
    wetness: wet / n,
    dynamism: drawsPossible ? meanPercentileChange(live, handA, handB, masks, values, n, evaluate) : null
  };
}

// Mean, over every next card, of the mean absolute change in each hand's strength percentile
function meanPercentileChange(live, handA, handB, masks, values, n, evaluate) {
  const sorted = new Int32Array(n);
  const before = new Int32Array(n);
  percentileNumerators(values, n, before, sorted);
  const [S, H, D, C] = [0, 1, 2, 3].map(suit => Int32Array.from({ length: n }, (_, h) => masks[h * 4 + suit]));

  const m = n - (live.length - 1); // hands left once a next card is dealt
  const index = new Int32Array(m);
  const nextValues = new Int32Array(m);
  const after = new Int32Array(m);
  // |after / (2(m − 1)) − before / (2(n − 1))| = |after (n − 1) − before (m − 1)| / (2 (m − 1)(n − 1))
  let total = 0;
  for (const card of live) {
    const bit = 1 << (card >> 2);
    const suit = card & 3;
    const addS = suit === 0 ? bit : 0, addH = suit === 1 ? bit : 0, addD = suit === 2 ? bit : 0, addC = suit === 3 ? bit : 0;
    let k = 0;
    for (let h = 0; h < n; h++) {
      if (handA[h] === card || handB[h] === card) continue;
      nextValues[k] = evaluate(S[h] | addS, H[h] | addH, D[h] | addD, C[h] | addC);
      index[k++] = h;
    }
    percentileNumerators(nextValues, m, after, sorted);
    let sum = 0;
    for (let i = 0; i < m; i++) sum += Math.abs(after[i] * (n - 1) - before[index[i]] * (m - 1));
    total += sum;
  }
  return total / (2 * (m - 1) * (n - 1) * m * live.length);
}

const clamp01 = x => Math.min(1, Math.max(0, x));

function scale(raw, range) {
  if (raw === null) return null;
  const { min, max } = range;
  return max > min ? clamp01((raw - min) / (max - min)) : 0;
}

function pairingLabel(counts) {
  const sorted = [...counts].sort((a, b) => b - a);
  if (sorted[0] === 4) return 'quads';
  if (sorted[0] === 3) return sorted[1] >= 2 ? 'fullHouse' : 'trips';
  if (sorted[0] === 2) return sorted[1] === 2 ? 'twoPair' : 'paired';
  return 'unpaired';
}

/**
 * Texture report for a 3-, 4- or 5-card board. Scores run from 0 to 1 (`dynamism` is null on 5 cards).
 * @param {string[]} boardCards
 * @param {string[]} [deadCards]
 */
export async function boardTexture(boardCards, deadCards = []) {
  const { board, dead } = parseTextureInput(boardCards, deadCards);
  await loadEvaluator();
  const raw = rawTexture(board, dead);
  const size = board.length;
  const boardIdx = board.map(cardIndex);

  const suitCounts = [0, 0, 0, 0];
  for (const card of boardIdx) suitCounts[card & 3]++;
  const maxSuit = Math.max(...suitCounts);
  const counts = rankCounts(boardIdx);
  const meanRank = boardIdx.reduce((sum, card) => sum + (card >> 2), 0) / size;
  const scales = BOARD_TEXTURE_SCALES[size];

  return {
    board,
    scores: {
      suitedness: (maxSuit - 1) / (size - 1),
      pairedness: (size - counts.length) / (size - Math.ceil(size / 4)),
      height: meanRank / 12,
      connectedness: scale(raw.connectedness, scales.connectedness),
      wetness: scale(raw.wetness, scales.wetness),
      dynamism: size < 5 ? scale(raw.dynamism, scales.dynamism) : null
    },
    suits: SUIT_LABELS[maxSuit],
    pairing: pairingLabel(counts),
    highCard: RANK_CHARS[Math.max(...boardIdx.map(card => card >> 2))],
    combos: raw.combos,
    straights: raw.straights,
    flushDraws: raw.flushDraws,
    straightDraws: raw.straightDraws,
    madeHands: raw.madeHands,
    raw: { connectedness: raw.connectedness, wetness: raw.wetness, dynamism: raw.dynamism }
  };
}
