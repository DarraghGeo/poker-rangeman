// Cards, combos and their lookup tables. Browser-safe: no Node built-ins.
//
// A card is an integer rank * 4 + suit: ranks 2..A are 0..12, suits s, h, d, c are 0..3, so '2s' = 0 and
// 'Ac' = 51. This is poker-extval 6's cardIndex, and the suit order of poker-bitvaljs's suit masks.
// A combo (two distinct cards) is an id from 0 to 1325.

export const RANK_CHARS = '23456789TJQKA';
export const SUIT_CHARS = 'shdc';
export const COMBO_COUNT = 1326;

const RANK_OF = new Int8Array(128).fill(-1);
const SUIT_OF = new Int8Array(128).fill(-1);
for (let r = 0; r < 13; r++) {
  RANK_OF[RANK_CHARS.charCodeAt(r)] = r;
  RANK_OF[RANK_CHARS.toLowerCase().charCodeAt(r)] = r;
}
for (let s = 0; s < 4; s++) {
  SUIT_OF[SUIT_CHARS.charCodeAt(s)] = s;
  SUIT_OF[SUIT_CHARS.toUpperCase().charCodeAt(s)] = s;
}

export const CARD_STRINGS = [];
for (let c = 0; c < 52; c++) CARD_STRINGS.push(RANK_CHARS[c >> 2] + SUIT_CHARS[c & 3]);

/** 'Ah' (any case) to a card number, or -1 if it isn't a card. */
export function cardIndex(card) {
  if (typeof card !== 'string' || card.length !== 2) return -1;
  const r = RANK_OF[card.charCodeAt(0)];
  const s = SUIT_OF[card.charCodeAt(1)];
  return r < 0 || s < 0 ? -1 : r * 4 + s;
}

export function cardString(card) {
  return CARD_STRINGS[card];
}

// Combo tables: the two cards (low card first), the id of each card pair, and the bitval suit lanes
export const COMBO_LO = new Uint8Array(COMBO_COUNT);
export const COMBO_HI = new Uint8Array(COMBO_COUNT);
export const COMBO_ID = new Int16Array(52 * 52).fill(-1);
// Rank bit masks per suit lane, in poker-bitvaljs's evaluateSuits order (s, h, d, c)
export const COMBO_LANE = [new Uint16Array(COMBO_COUNT), new Uint16Array(COMBO_COUNT), new Uint16Array(COMBO_COUNT), new Uint16Array(COMBO_COUNT)];
// The combo as 3.x writes it: higher rank first; a pair's suits in alphabetical order (c, d, h, s)
export const HAND_STRINGS = new Array(COMBO_COUNT);
const HAND_ID = new Map();

{
  let id = 0;
  for (let a = 0; a < 52; a++) {
    for (let b = a + 1; b < 52; b++) {
      COMBO_LO[id] = a;
      COMBO_HI[id] = b;
      COMBO_ID[a * 52 + b] = id;
      COMBO_ID[b * 52 + a] = id;
      COMBO_LANE[a & 3][id] |= 1 << (a >> 2);
      COMBO_LANE[b & 3][id] |= 1 << (b >> 2);
      let first = CARD_STRINGS[b];
      let second = CARD_STRINGS[a];
      if (a >> 2 === b >> 2 && first[1] > second[1]) [first, second] = [second, first];
      HAND_STRINGS[id] = first + second;
      HAND_ID.set(first + second, id);
      id++;
    }
  }
}

/** The id of two card numbers, or -1 if they are the same card. */
export function comboOf(a, b) {
  return COMBO_ID[a * 52 + b];
}

/** The id of a normalized hand string ('AhKd', 'AcAs'), or -1. */
export function idOfHand(hand) {
  return HAND_ID.get(hand) ?? -1;
}

/** Any two-card string ('KdAh', 'ahkd') to its id, or -1. */
export function idOfAnyHand(hand) {
  if (typeof hand !== 'string' || hand.length !== 4) return -1;
  const a = cardIndex(hand.slice(0, 2));
  const b = cardIndex(hand.slice(2, 4));
  return a < 0 || b < 0 || a === b ? -1 : COMBO_ID[a * 52 + b];
}

/** A Uint8Array(52): 1 for each card in the list (strings or numbers). */
export function cardFlags(cards) {
  const flags = new Uint8Array(52);
  for (const card of cards) flags[typeof card === 'number' ? card : cardIndex(card)] = 1;
  return flags;
}
