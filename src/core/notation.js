// Range notation: reading ('AA,KQs,JTo', 'AT+', 'KXs', 'AxKh', 'AhKd', with weights 'AKs:0.5') and writing it
// back. Pure functions on hand strings; the same rules as poker-rangeman 3.x. Browser-safe.

export const VALID_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const VALID_SUITS = ['s', 'h', 'd', 'c'];
const RANK_VALUES = { A: 14, K: 13, Q: 12, J: 11, T: 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2 };
const ALL_SUITS = ['c', 'd', 'h', 's'];

const buildNonPairPatterns = suffix => ({
  plus: new RegExp(`^([AKQJT2-9])([AKQJT2-9])${suffix}\\+$`),
  range: new RegExp(`^([AKQJT2-9])([AKQJT2-9])${suffix}-([AKQJT2-9])([AKQJT2-9])${suffix}$`),
  single: new RegExp(`^([AKQJT2-9])([AKQJT2-9])${suffix}$`)
});
const NON_PAIR_PATTERNS = { s: buildNonPairPatterns('s'), o: buildNonPairPatterns('o') };
// Suited and offsuit together: 'AK', 'AT+', 'AK-AT'
const ANY_SUIT_PATTERN = /^([AKQJT2-9])([AKQJT2-9])(\+?)$|^([AKQJT2-9])([AKQJT2-9])-([AKQJT2-9])([AKQJT2-9])$/;

// ---------------------------------------------------------------------------------------------------------------
// Cards and hands
// ---------------------------------------------------------------------------------------------------------------

export const rankValue = rank => RANK_VALUES[rank] ?? NaN;
export const isValidRank = rank => typeof rank === 'string' && VALID_RANKS.includes(rank);
export const isValidSuit = suit => typeof suit === 'string' && suit !== '' && VALID_SUITS.includes(suit.toLowerCase());

/** An exact card or a wildcard ('Ax' every ace, 'Xh' every heart). */
export function isValidCard(card) {
  if (!card || typeof card !== 'string' || card.length !== 2) return false;
  const rank = card[0].toUpperCase();
  const suit = card[1].toLowerCase();
  if (rank === 'X' && isValidSuit(suit)) return true;
  if (isValidRank(rank) && suit === 'x') return true;
  return isValidRank(rank) && isValidSuit(suit);
}

export function isValidConcreteCard(card) {
  if (!card || typeof card !== 'string' || card.length !== 2) return false;
  return isValidRank(card[0].toUpperCase()) && isValidSuit(card[1]);
}

export const normalizeCard = card => card[0].toUpperCase() + card[1].toLowerCase();

/** Two distinct cards; wildcard cards only with allowWildcards. */
export function isValidHand(hand, allowWildcards = false) {
  if (!hand || typeof hand !== 'string' || hand.length !== 4) return false;
  const card1 = hand.substring(0, 2);
  const card2 = hand.substring(2, 4);
  const valid = allowWildcards ? isValidCard : isValidConcreteCard;
  if (!valid(card1) || !valid(card2)) return false;
  return normalizeCard(card1) !== normalizeCard(card2);
}

const compareRanks = (a, b) => Math.sign(rankValue(a) - rankValue(b));

/** 'kdAh' -> 'AhKd': higher rank first; a pair's suits in alphabetical order (c, d, h, s). */
export function normalizeHand(hand) {
  if (!isValidHand(hand)) throw new Error(`Invalid hand: ${hand}`);
  const card1 = normalizeCard(hand.substring(0, 2));
  const card2 = normalizeCard(hand.substring(2, 4));
  const [high, low] = compareRanks(card1[0], card2[0]) >= 0 ? [card1, card2] : [card2, card1];
  if (high[0] === low[0]) {
    const suits = [high[1], low[1]].sort();
    return high[0] + suits[0] + high[0] + suits[1];
  }
  return high + low;
}

export const handCards = hand => (!hand || hand.length !== 4 ? [] : [hand.substring(0, 2), hand.substring(2, 4)]);

/** Cards with wildcards expanded: ['Ax', 'Kh'] -> ['As', 'Ah', 'Ad', 'Ac', 'Kh']. */
export function expandCards(cards) {
  if (!Array.isArray(cards)) throw new Error('Cards must be an array');
  return cards.flatMap(card => {
    if (!card || typeof card !== 'string' || card.length !== 2) return [card];
    const rank = card[0].toUpperCase();
    const suit = card[1].toLowerCase();
    if (rank === 'X' && isValidSuit(suit)) return VALID_RANKS.map(r => r + suit);
    if (isValidRank(rank) && suit === 'x') return VALID_SUITS.map(s => rank + s);
    return [rank + suit];
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Reading notation
// ---------------------------------------------------------------------------------------------------------------

const normalizeHandSegment = segment => normalizeCard(segment.substring(0, 2)) + normalizeCard(segment.substring(2, 4));

function normalizeSegment(segment) {
  const trimmed = segment.trim();
  if (trimmed.length === 4 && isValidHand(trimmed, true)) return normalizeHandSegment(trimmed);
  if (trimmed.includes('-')) {
    return trimmed.split('-').map(p => {
      const lastChar = p.slice(-1).toLowerCase();
      return (lastChar === 's' || lastChar === 'o') ? p.slice(0, -1).toUpperCase() + lastChar : p.toUpperCase();
    }).join('-');
  }
  const lastChar = trimmed.slice(-1).toLowerCase();
  const secondLastChar = trimmed.length > 1 ? trimmed.slice(-2, -1).toLowerCase() : '';
  if (lastChar === '+' && secondLastChar === 's') return trimmed.slice(0, -2).toUpperCase() + 's+';
  if (lastChar === '+' && secondLastChar === 'o') return trimmed.slice(0, -2).toUpperCase() + 'o+';
  if (lastChar === 's' || lastChar === 'o') return trimmed.slice(0, -1).toUpperCase() + lastChar;
  return trimmed.toUpperCase();
}

/** 'AKs:0.5' -> ['AKs', '0.5']; 'AKs' -> ['AKs', undefined] */
export function splitWeight(entry) {
  const index = entry.indexOf(':');
  return index === -1 ? [entry, undefined] : [entry.slice(0, index), entry.slice(index + 1)];
}

/** Upper-cases ranks and lower-cases suits, keeping any ':weight'. */
export function normalizeNotation(notation) {
  if (typeof notation !== 'string') return notation;
  const trimmed = notation.trim().replace(/\s+/g, ' ');
  const normalizeEntry = entry => {
    const [range, weight] = splitWeight(entry);
    return weight === undefined ? normalizeSegment(range) : `${normalizeSegment(range)}:${weight.trim()}`;
  };
  return trimmed.includes(',') ? trimmed.split(',').map(normalizeEntry).join(',') : normalizeEntry(trimmed);
}

/** A combo weight: a number from 0 to 1 (or a numeric string). */
export function parseWeight(value, entry) {
  const weight = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 1) {
    throw new Error(`Invalid weight for ${entry}: ${value}. Weights are numbers from 0 to 1`);
  }
  return weight;
}

function allRanksBetween(startRank, endRank) {
  const startIdx = VALID_RANKS.indexOf(startRank);
  const endIdx = VALID_RANKS.indexOf(endRank);
  if (startIdx === -1 || endIdx === -1) return [];
  if (startIdx <= endIdx) return VALID_RANKS.slice(startIdx, endIdx + 1);
  return VALID_RANKS.slice(endIdx, startIdx + 1).reverse();
}

export function rankBelow(rank) {
  const index = VALID_RANKS.indexOf(rank);
  if (index === -1 || index === VALID_RANKS.length - 1) return null;
  return VALID_RANKS[index + 1];
}

function isPairNotation(segment) {
  if (/^([AKQJT2-9])\1\+$/.test(segment) || /^([AKQJT2-9])\1$/.test(segment)) return true;
  if (!segment.includes('-')) return false;
  const parts = segment.split('-');
  return parts.length === 2 && /^([AKQJT2-9])\1$/.test(parts[0]) && /^([AKQJT2-9])\1$/.test(parts[1]);
}

function isSuitedNotation(segment) {
  return /^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}s\+$/.test(segment)
    || /^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}s-[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}s$/.test(segment)
    || /^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}s$/.test(segment);
}

function isOffsuitNotation(segment) {
  return /^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}o\+$/.test(segment)
    || /^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}o-[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}o$/.test(segment)
    || /^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}o$/.test(segment);
}

function isRankXNotation(segment) {
  if (segment.length !== 3) return false;
  return isValidRank(segment[0]) && (segment[1] === 'X' || segment[1] === 'x') && (segment[2] === 'o' || segment[2] === 's');
}

function isAnySuitNotation(segment) {
  const match = segment.match(ANY_SUIT_PATTERN);
  if (!match) return false;
  // 'AA' is a pair; 'AK-AT' needs distinct ranks on both ends
  if (match[1]) return match[1] !== match[2];
  return match[4] !== match[5] && match[6] !== match[7];
}

const isWildcardNotation = segment => segment.length === 4 && (segment.includes('x') || segment.includes('X'));

function detectNotationType(segment) {
  if (!segment || typeof segment !== 'string') return null;
  if (isPairNotation(segment)) return 'pair';
  if (isRankXNotation(segment)) return 'rankX';
  if (isAnySuitNotation(segment)) return 'anySuit';
  if (isSuitedNotation(segment)) return 'suited';
  if (isOffsuitNotation(segment)) return 'offsuit';
  if (isWildcardNotation(segment)) return 'wildcard';
  if (segment.length === 4 && isValidHand(segment)) return 'specific';
  return null;
}

function pairCombos(rank) {
  const combos = [];
  for (let i = 0; i < ALL_SUITS.length; i++) {
    for (let j = i + 1; j < ALL_SUITS.length; j++) combos.push(normalizeHand(rank + ALL_SUITS[i] + rank + ALL_SUITS[j]));
  }
  return combos;
}

const suitedCombos = (rank1, rank2) => ALL_SUITS.map(suit => normalizeHand(rank1 + suit + rank2 + suit));

function offsuitCombos(rank1, rank2) {
  const hands = [];
  for (const s1 of ALL_SUITS) for (const s2 of ALL_SUITS) if (s1 !== s2) hands.push(normalizeHand(rank1 + s1 + rank2 + s2));
  return hands;
}

function parsePairRange(range) {
  let start, end;
  if (range.endsWith('+')) [start, end] = [range[0], 'A'];
  else {
    const parts = range.split('-');
    [start, end] = parts.length === 1 ? [parts[0][0], parts[0][0]] : [parts[0][0], parts[1][0]];
  }
  if (!start || !end) throw new Error(`Invalid pair range: ${range}`);
  return allRanksBetween(start, end).flatMap(pairCombos);
}

function parseNonPairRange(range, suffix) {
  const label = suffix === 's' ? 'suited' : 'offsuit';
  const generate = suffix === 's' ? suitedCombos : offsuitCombos;
  const patterns = NON_PAIR_PATTERNS[suffix];
  let info = null;
  let match = range.match(patterns.plus);
  if (match) info = { rank1: match[1], rank2: match[2], isPlus: true };
  else if ((match = range.match(patterns.range))) info = { rank1: match[1], rank2: match[2], endRank1: match[3], endRank2: match[4] };
  else if ((match = range.match(patterns.single))) info = { rank1: match[1], rank2: match[2], isPlus: false };
  if (!info) throw new Error(`Invalid ${label} range: ${range}`);
  let ranks;
  if (info.isPlus) {
    // '+' runs the second rank up to one rank below the first rank
    const target = rankBelow(info.rank1);
    if (!target) return [];
    ranks = allRanksBetween(info.rank2, target).filter(r => r !== info.rank1);
  } else if (info.endRank2) {
    if (info.rank1 !== info.endRank1) throw new Error(`Invalid ${label} range: ${range}`);
    ranks = allRanksBetween(info.rank2, info.endRank2);
  } else {
    ranks = [info.rank2];
  }
  return ranks.flatMap(rank => generate(info.rank1, rank));
}

// 'AK' = 'AKs,AKo'; 'AT+' = 'ATs+,ATo+'; 'AK-AT' = 'AKs-ATs,AKo-ATo'
function parseAnySuitRange(segment) {
  const withSuffix = suffix => segment.includes('-')
    ? segment.split('-').map(part => part + suffix).join('-')
    : segment.replace(/^(..)(\+?)$/, `$1${suffix}$2`);
  return [...parseNonPairRange(withSuffix('s'), 's'), ...parseNonPairRange(withSuffix('o'), 'o')];
}

function parseRankX(segment) {
  const rank = segment[0].toUpperCase();
  const offsuit = segment[2].toLowerCase() === 'o';
  if (!isValidRank(rank)) throw new Error(`Invalid rank in notation: ${segment}`);
  const hands = [];
  for (const other of VALID_RANKS) if (other !== rank) hands.push(...(offsuit ? offsuitCombos(rank, other) : suitedCombos(rank, other)));
  if (offsuit) hands.push(...pairCombos(rank));
  return [...new Set(hands)];
}

// 'AxKh' (offsuit with the Kh), 'AhXs' (Ah with any spade), 'AxXx' (every ace hand)
function parseWildcard(hand) {
  let card1 = hand.substring(0, 2);
  let card2 = hand.substring(2, 4);
  // A rank wildcard is only supported on card2: 'XsKh' is treated as 'KhXs'
  if (card1[0] === 'X') [card1, card2] = [card2, card1];
  const info = card1[0] === 'X' ? null : { card1Rank: card1[0] };
  if (info) {
    if (card2[0] === 'X') {
      info.card2RankWildcard = true;
      info.card2ExcludeRank = card1[0];
      if (card2[1].toLowerCase() === 'x') info.card2SuitWildcard = true;
      else info.card2Suit = card2[1].toLowerCase();
    } else {
      info.card2Rank = card2[0];
      info.card2Suit = card2[1].toLowerCase();
    }
    if (card1[1].toLowerCase() === 'x') {
      info.card1SuitWildcard = true;
      info.card1ExcludeSuit = info.card2SuitWildcard ? null : info.card2Suit;
    } else {
      info.card1Suit = card1[1].toLowerCase();
    }
  }
  const hands = [];
  if (info) {
    const card1Suits = info.card1SuitWildcard ? VALID_SUITS.filter(s => s !== info.card1ExcludeSuit) : [info.card1Suit];
    const card2Ranks = info.card2RankWildcard && info.card2SuitWildcard ? VALID_RANKS
      : info.card2RankWildcard ? VALID_RANKS.filter(r => r !== info.card2ExcludeRank) : [info.card2Rank];
    const card2Suits = info.card2SuitWildcard ? VALID_SUITS : [info.card2Suit];
    for (const s1 of card1Suits) {
      for (const r2 of card2Ranks) {
        for (const s2 of card2Suits) {
          const card2Full = r2 + s2;
          if (card2Full === info.card1Rank + s1) continue;
          const combo = info.card1Rank + s1 + card2Full;
          if (isValidHand(combo)) hands.push(normalizeHand(combo));
        }
      }
    }
  }
  if (hands.length === 0) throw new Error(`Invalid wildcard hand: ${hand}`);
  return [...new Set(hands)];
}

/** The hands of one notation segment ('TT+', 'AKs', 'AxKh', 'AhKd'). */
export function parseSegment(segment) {
  const type = detectNotationType(segment);
  if (type === 'pair') return parsePairRange(segment);
  if (type === 'suited') return parseNonPairRange(segment, 's');
  if (type === 'offsuit') return parseNonPairRange(segment, 'o');
  if (type === 'rankX') return parseRankX(segment);
  if (type === 'anySuit') return parseAnySuitRange(segment);
  if (type === 'wildcard') return parseWildcard(segment);
  if (type === 'specific') return [normalizeHand(segment)];
  throw new Error(`Unrecognized notation: ${segment}`);
}

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
export { isPlainObject };

const parsedNotation = new Map();

/**
 * Notation, an array or an object to { hands, weights }. Later entries override earlier ones, and weight 0 removes
 * the combo. weights holds only combos whose weight is not 1. Notation strings are remembered (the last 256);
 * every call returns its own copy.
 *   string: 'AA,AKs:0.5,TT+:0.25,AhKh:0.4'
 *   array:  exact combos, each 'AhKh', 'AhKh:0.4', ['AhKh', 0.4] or { hand: 'AhKh', weight: 0.4 }
 *   object: { AhKh: 0.4, AsKs: 1 } (exact combos)
 */
export function parseWeighted(input) {
  if (typeof input !== 'string') return parseUncached(input);
  let parsed = parsedNotation.get(input);
  if (!parsed) {
    parsed = parseUncached(input);
    if (parsedNotation.size >= 256) parsedNotation.delete(parsedNotation.keys().next().value);
    parsedNotation.set(input, parsed);
  }
  return { hands: parsed.hands.slice(), weights: { ...parsed.weights } };
}

function parseUncached(input) {
  const entries = new Map();
  const set = (hands, weight) => hands.forEach(hand => { entries.delete(hand); entries.set(hand, weight); });
  const exactHand = (hand, where) => {
    if (!isValidHand(hand)) throw new Error(`Invalid hand in ${where}: ${hand}`);
    return normalizeHand(hand);
  };
  if (typeof input === 'string') {
    normalizeNotation(input).split(',').map(s => s.trim()).filter(s => s).forEach(entry => {
      const [range, weight] = splitWeight(entry);
      set(parseSegment(range.trim()), weight === undefined ? 1 : parseWeight(weight, range));
    });
  } else if (Array.isArray(input)) {
    if (input.length === 0) throw new Error('Array cannot be empty');
    input.forEach(item => {
      if (Array.isArray(item)) {
        set([exactHand(item[0], 'array')], parseWeight(item[1], item[0]));
      } else if (isPlainObject(item) && typeof item.hand === 'string') {
        set([exactHand(item.hand, 'array')], item.weight === undefined ? 1 : parseWeight(item.weight, item.hand));
      } else if (typeof item === 'string' && item.includes(':')) {
        const [hand, weight] = splitWeight(item);
        set([exactHand(hand.trim(), 'array')], parseWeight(weight, hand));
      } else {
        set([exactHand(item, 'array')], 1);
      }
    });
  } else if (isPlainObject(input)) {
    const items = Object.entries(input);
    if (items.length === 0) throw new Error('Object cannot be empty');
    items.forEach(([hand, weight]) => set([exactHand(hand, 'object')], parseWeight(weight, hand)));
  } else {
    throw new Error('Input must be a string, array or object');
  }
  const hands = [];
  const weights = {};
  for (const [hand, weight] of entries) {
    if (weight === 0) continue;
    hands.push(hand);
    if (weight !== 1) weights[hand] = weight;
  }
  return { hands, weights };
}

// ---------------------------------------------------------------------------------------------------------------
// Writing notation
// ---------------------------------------------------------------------------------------------------------------

/** The hand class: { type: 'pair' | 'suited' | 'offsuit', notation: 'QQ' | 'AKs' | 'AKo' }. */
export function handClass(hand) {
  const [c1, c2] = handCards(hand);
  const [high, low] = compareRanks(c1[0], c2[0]) >= 0 ? [c1, c2] : [c2, c1];
  if (high[0] === low[0]) return { type: 'pair', notation: high[0] + low[0] };
  if (high[1] === low[1]) return { type: 'suited', notation: high[0] + low[0] + 's' };
  return { type: 'offsuit', notation: high[0] + low[0] + 'o' };
}

/** Hand classes, unabbreviated: 'AA,KK,AKs,AKo' (in the order the hands come). */
export function classNotation(hands) {
  if (hands.length === 0) return '';
  const categories = { pairs: [], suited: [], offsuit: [] };
  for (const hand of hands) {
    const cls = handClass(hand);
    categories[cls.type === 'pair' ? 'pairs' : cls.type === 'suited' ? 'suited' : 'offsuit'].push(cls.notation);
  }
  const parts = [];
  if (categories.pairs.length > 0) parts.push([...new Set(categories.pairs)].join(','));
  if (categories.suited.length > 0) parts.push([...new Set(categories.suited)].join(','));
  if (categories.offsuit.length > 0) parts.push([...new Set(categories.offsuit)].join(','));
  return parts.join(',');
}

function consecutiveSequences(ranks) {
  if (ranks.length === 0) return [];
  const sorted = [...new Set(ranks)].sort((a, b) => rankValue(a) - rankValue(b));
  const sequences = [];
  let start = sorted[0], end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (rankValue(sorted[i]) === rankValue(end) + 1) end = sorted[i];
    else { sequences.push({ start, end }); start = end = sorted[i]; }
  }
  return [...sequences, { start, end }];
}

function abbreviatePairs(pairs) {
  if (pairs.length === 0) return [];
  return consecutiveSequences([...new Set(pairs)].map(p => p[0]))
    .map(seq => (seq.start === seq.end ? seq.start + seq.start : seq.end === 'A' ? seq.start + seq.start + '+' : seq.end + seq.end + '-' + seq.start + seq.start))
    .sort((a, b) => rankValue(b[0]) - rankValue(a[0]));
}

function abbreviateNonPairs(list, suffix) {
  if (list.length === 0) return [];
  const groups = {};
  for (const notation of list) (groups[notation[0]] ||= []).push(notation);
  const result = [];
  for (const group of Object.values(groups)) {
    const firstRank = group[0][0];
    for (const seq of consecutiveSequences([...new Set(group)].map(h => h[1]))) {
      if (seq.start === seq.end) result.push(firstRank + seq.start + suffix);
      // '+' means the second rank runs up to one rank below the first rank
      else if (seq.end === rankBelow(firstRank)) result.push(firstRank + seq.start + suffix + '+');
      else result.push(firstRank + seq.start + suffix + '-' + firstRank + seq.end + suffix);
    }
  }
  return result;
}

/** Abbreviated notation of a list of hands whose classes are complete: 'QQ+,AKs,ATo+'. */
export function abbreviatedNotation(hands) {
  const notation = classNotation(hands);
  if (!notation) return '';
  const parts = notation.split(',');
  return [
    ...abbreviatePairs(parts.filter(p => /^([AKQJT2-9])\1$/.test(p))),
    ...abbreviateNonPairs(parts.filter(p => /^[AKQJT2-9]{2}s$/.test(p)), 's'),
    ...abbreviateNonPairs(parts.filter(p => /^[AKQJT2-9]{2}o$/.test(p)), 'o')
  ].join(',');
}

/**
 * Writes a weighted range: each group of equal weight with `write`, weight 1 first, then heavier weights first. A
 * hand class whose combos have different weights is written as exact combos, so the output parses back to the
 * same weights.
 */
export function weightedNotation(hands, weightOf, write = abbreviatedNotation) {
  const roundWeight = hand => Math.round(weightOf(hand) * 10000) / 10000;
  const classWeights = new Map();
  for (const hand of hands) {
    const cls = handClass(hand).notation;
    if (!classWeights.has(cls)) classWeights.set(cls, new Set());
    classWeights.get(cls).add(roundWeight(hand));
  }
  const groups = new Map();
  for (const hand of hands) {
    const weight = roundWeight(hand);
    if (!groups.has(weight)) groups.set(weight, []);
    groups.get(weight).push(hand);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([weight, list]) => {
      const mixed = hand => classWeights.get(handClass(hand).notation).size > 1;
      const parts = [write(list.filter(hand => !mixed(hand))), ...list.filter(mixed)].filter(Boolean).join(',');
      if (!parts || weight === 1) return parts;
      return parts.split(',').map(part => `${part}:${weight}`).join(',');
    })
    .filter(Boolean)
    .join(',');
}
