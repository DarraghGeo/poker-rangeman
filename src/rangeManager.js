const VALID_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const VALID_SUITS = ['s', 'h', 'd', 'c'];
const RANK_VALUES = { A: 14, K: 13, Q: 12, J: 11, T: 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2 };

// poker-extval and poker-bitvaljs are loaded lazily on first use (see _loadEvaluator, _loadBitVal)
let extval = null;
let bitval = null;

const CRITERIA_MAPPING = {
  // Made Hands
  'Pair': 'isPair', 'Two Pair': 'isTwoPair', 'Three of a Kind': 'isThreeOfAKind',
  'Straight': 'isStraight', 'Flush': 'isFlush', 'Full House': 'isFullHouse',
  'Four of a Kind': 'isFourOfAKind', 'Straight Flush': 'isStraightFlush', 'Royal Flush': 'isRoyalFlush',
  'High Card': 'isHighCard',
  // Pair Categorization
  'Top Pair': 'isTopPair', 'Middle Pair': 'isMiddlePair', 'Bottom Pair': 'isBottomPair',
  'Overpair': 'isOverPair', 'Over Pair': 'isOverPair', 'Underpair': 'isUnderPair', 'Under Pair': 'isUnderPair',
  'Middling Pair': 'isMiddlingPair',
  // Two Pair Categorization
  'Top And Middle Pair': 'isTopAndMiddlePair', 'Top And Bottom Pair': 'isTopAndBottomPair', 'Middle And Bottom Pair': 'isMiddleAndBottomPair',
  // Three of a Kind Categorization
  'Top Three Of A Kind': 'isTopThreeOfAKind', 'Middle Three Of A Kind': 'isMiddleThreeOfAKind', 'Bottom Three Of A Kind': 'isBottomThreeOfAKind',
  // Draws
  'Flush Draw': 'isFlushDraw', 'Backdoor Flush Draw': 'isBackdoorFlushDraw',
  'Open Ended Straight Draw': 'isOpenEndedStraightDraw', 'Inside Straight Draw': 'isInsideStraightDraw',
  'Straight Draw': 'isStraightDraw', 'Combo Draw': 'isComboDraw',
  // Wheel Straight Support
  'Straight Wheel': 'isStraightWheel', 'Open Ended Straight Draw Wheel': 'isOpenEndedStraightDrawWheel',
  'Inside Straight Draw Wheel': 'isInsideStraightDrawWheel',
  // Hole cards against the board
  'Overcard': 'isOvercard', 'Two Overcards': 'isTwoOvercards',
  'Overcard And Middle Card': 'isOvercardAndMiddleCard', 'Overcard And Undercard': 'isOvercardAndUndercard',
  'Two Middle Cards': 'isTwoMiddleCards', 'Middle And Undercard': 'isMiddleAndUndercard',
  'Two Undercards': 'isTwoUndercards'
};

// Flag names accepted from earlier versions of this library
const CRITERION_ALIASES = { isOverpair: 'isOverPair' };

// Map lookups avoid matching inherited Object properties (e.g. 'toString')
const CRITERIA_LOOKUP = new Map([...Object.entries(CRITERIA_MAPPING), ...Object.entries(CRITERION_ALIASES)]);
const VALID_CRITERIA = new Set(Object.values(CRITERIA_MAPPING));
const MADE_HANDS = new Set([
  'isRoyalFlush', 'isStraightFlush', 'isFourOfAKind', 'isFullHouse', 'isFlush',
  'isStraight', 'isThreeOfAKind', 'isTwoPair', 'isPair', 'isHighCard'
]);
const STREETS = new Set(['flop', 'turn', 'river']);
// Equity buckets (hand vs range equity, highest band first; a hand belongs to the first band whose min it reaches).
// 'acevedo' is Modern Poker Theory's Equity Buckets (Ch. 10, PDF p. 597): Strong >= 75%, Good >= 50%, Weak >= 33%.
const BAND_PRESETS = {
  acevedo: [
    { name: 'strong', min: 0.75 }, { name: 'good', min: 0.5 }, { name: 'weak', min: 0.33 }, { name: 'trash', min: 0 }
  ],
  quartiles: [
    { name: 'strong', min: 0.75 }, { name: 'good', min: 0.5 }, { name: 'weak', min: 0.25 }, { name: 'trash', min: 0 }
  ]
};

// Modern Poker Theory's average equity buckets over all 1,755 flops, BB defending against an in-position
// opener with 20-40bb MTT ranges (PDF p. 600). A point of comparison only: it describes those ranges.
const ACEVEDO_FLOP_AVERAGES = {
  source: 'Acevedo, Modern Poker Theory, Ch. 10 (PDF p. 600): average over all 1,755 flops, BB vs in-position opener, 20-40bb MTT ranges',
  bigBlind: { strong: 0.07, good: 0.25, weak: 0.23, trash: 0.45 },
  inPosition: { strong: 0.22, good: 0.43, weak: 0.29, trash: 0.06 }
};

// Hand classes for handClasses(), in Modern Poker Theory's order (Ch. 1 "Post-flop Range Breakdown", Ch. 12):
// each combo goes into the first class it fits, made hands before draws, flush draws before straight draws.
// Pair positions count the board's distinct ranks from the top; the lowest is always bottomPair.
const HAND_CLASSES = [
  'straightFlush', 'quads', 'fullHouse', 'flush', 'straight', 'set', 'trips', 'twoPair',
  'overpair', 'topPair', 'pocketPair12', 'secondPair', 'pocketPair23', 'thirdPair', 'pocketPair34', 'fourthPair',
  'pocketPair45', 'bottomPair', 'underpair',
  'flushDraw', 'oesd', 'gutshot', 'aceHigh', 'kingHigh', 'air'
];
const PAIR_POSITIONS = ['topPair', 'secondPair', 'thirdPair', 'fourthPair'];

// Draws a villain combo can hold, for blockers()
const VILLAIN_DRAWS = [
  'isFlushDraw', 'isBackdoorFlushDraw', 'isOpenEndedStraightDraw', 'isInsideStraightDraw', 'isStraightDraw', 'isComboDraw'
];

const buildNonPairPatterns = suffix => ({
  plus: new RegExp(`^([AKQJT2-9])([AKQJT2-9])${suffix}\\+$`),
  range: new RegExp(`^([AKQJT2-9])([AKQJT2-9])${suffix}-([AKQJT2-9])([AKQJT2-9])${suffix}$`),
  single: new RegExp(`^([AKQJT2-9])([AKQJT2-9])${suffix}$`)
});
const NON_PAIR_PATTERNS = { s: buildNonPairPatterns('s'), o: buildNonPairPatterns('o') };
// Suited and offsuit together: 'AK', 'AT+', 'AK-AT'
const ANY_SUIT_PATTERN = /^([AKQJT2-9])([AKQJT2-9])(\+?)$|^([AKQJT2-9])([AKQJT2-9])-([AKQJT2-9])([AKQJT2-9])$/;

export class RangeManager {
  constructor(input, deadCards = []) {
    this.rawInput = input;
    this.hands = [];
    this.filteredHands = [];
    this.lastBoardCards = null;
    this.lastHandStrength = null;
    this.lastStrict = null;
    this.lastStreet = null;
    this.evaluationCache = new Map();
    this.equityCache = new Map();
    // Per-hand equity stored by getEquity(), read by the equity filters
    this.handEquity = null;
    // Villain, board and equity bands set by against() / getEquity()
    this.matchup = null;

    if (!input) throw new Error('Input is required');
    if (!Array.isArray(input) && typeof input !== 'string' && !this._isPlainObject(input)) {
      throw new Error('Input must be a string, array or object');
    }
    this.deadCards = this._validateAndExpandDeadCards(deadCards || []);

    const { hands, weights } = this._parseWeighted(input);
    this.hands = hands;
    // Combo weights from 0 to 1 (frequencies); only combos whose weight is not 1 are stored
    this.handWeights = weights;
    this.filteredHands = this._filterDeadCards(hands);
  }

  _isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
  }

  // ============================================================================
  // VALIDATION METHODS
  // ============================================================================

  _isValidRank(rank) {
    if (!rank || typeof rank !== 'string') return false;
    return VALID_RANKS.includes(rank);
  }

  _isValidSuit(suit) {
    if (!suit || typeof suit !== 'string') return false;
    return VALID_SUITS.includes(suit.toLowerCase());
  }

  _isValidCard(card) {
    if (!card || typeof card !== 'string' || card.length !== 2) return false;
    const rank = card[0].toUpperCase();
    const suit = card[1].toLowerCase();
    if (rank === 'X' && this._isValidSuit(suit)) return true;
    if (this._isValidRank(rank) && suit === 'x') return true;
    return this._isValidRank(rank) && this._isValidSuit(suit);
  }

  _isValidConcreteCard(card) {
    if (!card || typeof card !== 'string' || card.length !== 2) return false;
    return this._isValidRank(card[0].toUpperCase()) && this._isValidSuit(card[1]);
  }

  // Wildcard cards ('Ax', 'Xs') are only accepted when allowWildcards is true
  _isValidHand(hand, allowWildcards = false) {
    if (!hand || typeof hand !== 'string' || hand.length !== 4) return false;
    const card1 = hand.substring(0, 2);
    const card2 = hand.substring(2, 4);
    const isValidCard = allowWildcards ? c => this._isValidCard(c) : c => this._isValidConcreteCard(c);
    if (!isValidCard(card1) || !isValidCard(card2)) return false;
    return this._normalizeCard(card1) !== this._normalizeCard(card2);
  }

  // ============================================================================
  // NORMALIZATION METHODS
  // ============================================================================

  _normalizeCardOrder(card1, card2) {
    // compareRanks returns 1 if rank1 > rank2, so >= 0 means rank1 >= rank2 (higher or equal rank first)
    if (this._compareRanks(card1[0], card2[0]) >= 0) return [card1, card2];
    return [card2, card1];
  }

  _normalizeCard(card) {
    return card[0].toUpperCase() + card[1].toLowerCase();
  }

  _normalizeHand(hand) {
    if (!this._isValidHand(hand)) throw new Error(`Invalid hand: ${hand}`);
    const normalizedCard1 = this._normalizeCard(hand.substring(0, 2));
    const normalizedCard2 = this._normalizeCard(hand.substring(2, 4));
    const [high, low] = this._normalizeCardOrder(normalizedCard1, normalizedCard2);
    if (high[0] === low[0]) {
      const suits = [high[1], low[1]].sort();
      return high[0] + suits[0] + high[0] + suits[1];
    }
    return high + low;
  }

  _normalizeHandSegment(segment) {
    return this._normalizeCard(segment.substring(0, 2)) + this._normalizeCard(segment.substring(2, 4));
  }

  _normalizeSegment(segment) {
    const trimmed = segment.trim();
    if (trimmed.length === 4 && this._isValidHand(trimmed, true)) return this._normalizeHandSegment(trimmed);
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      return parts.map(p => {
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

  normalizeNotation(notation) {
    if (typeof notation !== 'string') return notation;
    const trimmed = notation.trim().replace(/\s+/g, ' ');
    // A segment may carry a weight after a colon: 'AKs:0.5'
    const normalizeEntry = entry => {
      const [range, weight] = this._splitWeight(entry);
      return weight === undefined ? this._normalizeSegment(range) : `${this._normalizeSegment(range)}:${weight.trim()}`;
    };
    if (trimmed.includes(',')) {
      return trimmed.split(',').map(normalizeEntry).join(',');
    }
    return normalizeEntry(trimmed);
  }

  // 'AKs:0.5' -> ['AKs', '0.5']; 'AKs' -> ['AKs', undefined]
  _splitWeight(entry) {
    const index = entry.indexOf(':');
    return index === -1 ? [entry, undefined] : [entry.slice(0, index), entry.slice(index + 1)];
  }

  // A combo weight: a number from 0 to 1 (or a numeric string)
  _parseWeight(value, entry) {
    const weight = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 1) {
      throw new Error(`Invalid weight for ${entry}: ${value}. Weights are numbers from 0 to 1`);
    }
    return weight;
  }

  // ============================================================================
  // RANK & SUIT UTILITY METHODS
  // ============================================================================

  _getRankValue(rank) {
    return RANK_VALUES[rank] ?? NaN;
  }

  _compareRanks(rank1, rank2) {
    const val1 = this._getRankValue(rank1);
    const val2 = this._getRankValue(rank2);
    if (val1 > val2) return 1;
    if (val1 < val2) return -1;
    return 0;
  }

  _getAllRanksBetween(startRank, endRank) {
    const startIdx = VALID_RANKS.indexOf(startRank);
    const endIdx = VALID_RANKS.indexOf(endRank);
    if (startIdx === -1 || endIdx === -1) return [];
    if (startIdx <= endIdx) return VALID_RANKS.slice(startIdx, endIdx + 1);
    return VALID_RANKS.slice(endIdx, startIdx + 1).reverse();
  }

  _getRankBelow(rank) {
    // Returns the rank that is one rank below the given rank
    // For 'A', returns 'K'
    // For 'K', returns 'Q'
    // For '2', returns null (no rank below 2)
    const rankIdx = VALID_RANKS.indexOf(rank);
    if (rankIdx === -1) return null;
    if (rankIdx === VALID_RANKS.length - 1) return null; // '2' has no rank below
    return VALID_RANKS[rankIdx + 1];
  }

  _isPocketPair(handCards) {
    if (!handCards || handCards.length !== 2) return false;
    return handCards[0][0].toUpperCase() === handCards[1][0].toUpperCase();
  }

  _getAllSuits() {
    return ['c', 'd', 'h', 's'];
  }

  // ============================================================================
  // PATTERN DETECTION METHODS
  // ============================================================================

  _isPairNotation(segment) {
    if (!segment || typeof segment !== 'string') return false;
    if (/^([AKQJT2-9])\1\+$/.test(segment)) return true;
    if (/^([AKQJT2-9])\1$/.test(segment)) return true;
    if (!segment.includes('-')) return false;
    const parts = segment.split('-');
    if (parts.length !== 2) return false;
    return /^([AKQJT2-9])\1$/.test(parts[0]) && /^([AKQJT2-9])\1$/.test(parts[1]);
  }

  _isSuitedNotation(segment) {
    if (!segment || typeof segment !== 'string') return false;
    if (/^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}s\+$/.test(segment)) return true;
    if (/^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}s-[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}s$/.test(segment)) return true;
    return /^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}s$/.test(segment);
  }

  _isOffsuitNotation(segment) {
    if (!segment || typeof segment !== 'string') return false;
    if (/^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}o\+$/.test(segment)) return true;
    if (/^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}o-[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}o$/.test(segment)) return true;
    return /^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}o$/.test(segment);
  }

  _isRankXNotation(segment) {
    if (!segment || typeof segment !== 'string' || segment.length !== 3) return false;
    const rank = segment[0];
    const middle = segment[1];
    const suffix = segment[2];
    return this._isValidRank(rank) && (middle === 'X' || middle === 'x') && (suffix === 'o' || suffix === 's');
  }

  _isAnySuitNotation(segment) {
    if (!segment || typeof segment !== 'string') return false;
    const match = segment.match(ANY_SUIT_PATTERN);
    if (!match) return false;
    // 'AA' is a pair; 'AK-AT' needs distinct ranks on both ends
    if (match[1]) return match[1] !== match[2];
    return match[4] !== match[5] && match[6] !== match[7];
  }

  _isWildcardNotation(segment) {
    if (!segment || typeof segment !== 'string' || segment.length !== 4) return false;
    return segment.includes('x') || segment.includes('X');
  }

  _isSpecificHandNotation(segment) {
    if (!segment || typeof segment !== 'string' || segment.length !== 4) return false;
    return this._isValidHand(segment);
  }

  _detectNotationType(segment) {
    if (this._isPairNotation(segment)) return 'pair';
    if (this._isRankXNotation(segment)) return 'rankX';  // Check this BEFORE suited/offsuit
    if (this._isAnySuitNotation(segment)) return 'anySuit';
    if (this._isSuitedNotation(segment)) return 'suited';
    if (this._isOffsuitNotation(segment)) return 'offsuit';
    if (this._isWildcardNotation(segment)) return 'wildcard';
    if (this._isSpecificHandNotation(segment)) return 'specific';
    return null;
  }

  // ============================================================================
  // EXTRACTION METHODS
  // ============================================================================

  _extractCardsFromHand(hand) {
    if (!hand || hand.length !== 4) return [];
    return [hand.substring(0, 2), hand.substring(2, 4)];
  }

  _extractPairRanks(range) {
    if (!range || typeof range !== 'string') return [null, null];
    if (range.endsWith('+')) {
      const rank = range[0];
      return [rank, 'A'];
    }
      const parts = range.split('-');
    if (parts.length === 1) {
      const rank = parts[0][0];
      return [rank, rank];
    }
    return [parts[0][0], parts[1][0]];
  }

  // Extracts ranks from suited/offsuit notation: 'AKs', 'A2s+', 'A2s-A5s' (suffix is 's' or 'o')
  _extractNonPairRanks(range, suffix) {
    if (!range) return null;
    const patterns = NON_PAIR_PATTERNS[suffix];
    let match = range.match(patterns.plus);
    if (match) return { rank1: match[1], rank2: match[2], isPlus: true };
    match = range.match(patterns.range);
    if (match) return { rank1: match[1], rank2: match[2], endRank1: match[3], endRank2: match[4] };
    match = range.match(patterns.single);
    return match ? { rank1: match[1], rank2: match[2], isPlus: false } : null;
  }

  _extractCard1Wildcard(card1, result) {
    if (card1[1].toLowerCase() === 'x') {
      result.card1SuitWildcard = true;
      // 'AxKh' means offsuit with Kh: card1 takes every suit except card2's suit
      result.card1ExcludeSuit = result.card2SuitWildcard ? null : result.card2Suit;
    } else {
      result.card1Suit = card1[1].toLowerCase();
    }
  }

  _extractCard2Wildcard(card2, card1, result) {
    if (card2[0] === 'X') {
      result.card2RankWildcard = true;
      result.card2ExcludeRank = card1[0];
      if (card2[1].toLowerCase() === 'x') result.card2SuitWildcard = true;
      else result.card2Suit = card2[1].toLowerCase();
    } else {
      result.card2Rank = card2[0];
      result.card2Suit = card2[1].toLowerCase();
    }
  }

  _extractWildcardHand(hand) {
    if (!hand || hand.length !== 4) return null;
    let card1 = hand.substring(0, 2);
    let card2 = hand.substring(2, 4);
    // A rank wildcard is only supported on card2: 'XsKh' is treated as 'KhXs'
    if (card1[0] === 'X') [card1, card2] = [card2, card1];
    if (card1[0] === 'X') return null;
    const result = { card1Rank: card1[0] };
    // card2 is extracted first because card1's excluded suit depends on it
    this._extractCard2Wildcard(card2, card1, result);
    this._extractCard1Wildcard(card1, result);
    return result;
  }

  // ============================================================================
  // GENERATION METHODS
  // ============================================================================

  _generatePairCombos(rank, suits) {
    const combos = [];
    for (let i = 0; i < suits.length; i++) {
      for (let j = i + 1; j < suits.length; j++) {
        combos.push(this._normalizeHand(rank + suits[i] + rank + suits[j]));
      }
    }
    return combos;
  }

  _generatePairCombinations(rank) {
    return this._generatePairCombos(rank, this._getAllSuits());
  }

  _generatePairRange(startRank, endRank) {
    const ranks = this._getAllRanksBetween(startRank, endRank);
    const hands = [];
    ranks.forEach(rank => {
      hands.push(...this._generatePairCombinations(rank));
    });
    return hands;
  }

  _generateSuitedRange(rank1, rank2) {
    const suits = this._getAllSuits();
    return suits.map(suit => this._normalizeHand(rank1 + suit + rank2 + suit));
  }

  _generateOffsuitCombos(rank1, rank2, suits) {
    const hands = [];
    suits.forEach(suit1 => {
      suits.forEach(suit2 => {
        if (suit1 !== suit2) hands.push(this._normalizeHand(rank1 + suit1 + rank2 + suit2));
      });
    });
    return hands;
  }

  _generateOffsuitRange(rank1, rank2) {
    return this._generateOffsuitCombos(rank1, rank2, this._getAllSuits());
  }

  _getCard1Suits(info) {
    return info.card1SuitWildcard ? VALID_SUITS.filter(s => s !== info.card1ExcludeSuit) : [info.card1Suit];
  }

  _getCard2Ranks(info) {
    if (info.card2RankWildcard && info.card2SuitWildcard) return VALID_RANKS;
    return info.card2RankWildcard ? VALID_RANKS.filter(r => r !== info.card2ExcludeRank) : [info.card2Rank];
  }

  _getCard2Suits(info) {
    return info.card2SuitWildcard ? VALID_SUITS : [info.card2Suit];
  }

  _generateCombosFromWildcard(info, card1Suits, card2Ranks, card2Suits) {
    const hands = [];
    card1Suits.forEach(s1 => {
      card2Ranks.forEach(r2 => {
        card2Suits.forEach(s2 => {
          const card2 = r2 + s2;
          const card1Full = info.card1Rank + s1;
          if (card2 === card1Full) return;
          const combo = info.card1Rank + s1 + card2;
          if (!this._isValidHand(combo)) return;
          hands.push(this._normalizeHand(combo));
        });
      });
    });
    return hands;
  }

  _generateWildcardCombinations(hand) {
    const info = this._extractWildcardHand(hand);
    if (!info) return [];
    const card1Suits = this._getCard1Suits(info);
    const card2Ranks = this._getCard2Ranks(info);
    const card2Suits = this._getCard2Suits(info);
    return this._deduplicateHands(this._generateCombosFromWildcard(info, card1Suits, card2Ranks, card2Suits));
  }

  _generateRankXHands(rank, isOffsuit) {
    const hands = [];
    const allRanks = VALID_RANKS.filter(r => r !== rank);
    allRanks.forEach(otherRank => {
      if (isOffsuit) {
        hands.push(...this._generateOffsuitRange(rank, otherRank));
      } else {
        hands.push(...this._generateSuitedRange(rank, otherRank));
      }
    });
    if (isOffsuit) {
      hands.push(...this._generatePairCombinations(rank));
    }
    return this._deduplicateHands(hands);
  }

  // ============================================================================
  // PARSING METHODS
  // ============================================================================

  _parseSpecificHand(hand) {
    if (!this._isValidHand(hand)) throw new Error(`Invalid hand: ${hand}`);
    return this._normalizeHand(hand);
  }

  _parseWildcardHand(hand) {
    const hands = this._generateWildcardCombinations(hand);
    if (hands.length === 0) throw new Error(`Invalid wildcard hand: ${hand}`);
    return hands;
  }

  _parsePairRange(range) {
    const [start, end] = this._extractPairRanks(range);
    if (!start || !end) throw new Error(`Invalid pair range: ${range}`);
    return this._generatePairRange(start, end);
  }

  _parseNonPairRange(range, suffix) {
    const label = suffix === 's' ? 'suited' : 'offsuit';
    const generate = suffix === 's'
      ? (r1, r2) => this._generateSuitedRange(r1, r2)
      : (r1, r2) => this._generateOffsuitRange(r1, r2);
    const info = this._extractNonPairRanks(range, suffix);
    if (!info) throw new Error(`Invalid ${label} range: ${range}`);
    let ranks;
    if (info.isPlus) {
      // '+' runs the second rank up to one rank below the first rank
      const targetRank = this._getRankBelow(info.rank1);
      if (!targetRank) return [];
      ranks = this._getAllRanksBetween(info.rank2, targetRank).filter(r => r !== info.rank1);
    } else if (info.endRank2) {
      if (info.rank1 !== info.endRank1) throw new Error(`Invalid ${label} range: ${range}`);
      ranks = this._getAllRanksBetween(info.rank2, info.endRank2);
    } else {
      ranks = [info.rank2];
    }
    return ranks.flatMap(rank => generate(info.rank1, rank));
  }

  _parseSuitedRange(range) {
    return this._parseNonPairRange(range, 's');
  }

  _parseOffsuitRange(range) {
    return this._parseNonPairRange(range, 'o');
  }

  // 'AK' = 'AKs,AKo'; 'AT+' = 'ATs+,ATo+'; 'AK-AT' = 'AKs-ATs,AKo-ATo'
  _parseAnySuitRange(segment) {
    const withSuffix = suffix => segment.includes('-')
      ? segment.split('-').map(part => part + suffix).join('-')
      : segment.replace(/^(..)(\+?)$/, `$1${suffix}$2`);
    return [...this._parseSuitedRange(withSuffix('s')), ...this._parseOffsuitRange(withSuffix('o'))];
  }

  _parseRankXNotation(segment) {
    const rank = segment[0].toUpperCase();
    const isOffsuit = segment[2].toLowerCase() === 'o';
    if (!this._isValidRank(rank)) throw new Error(`Invalid rank in notation: ${segment}`);
    return this._generateRankXHands(rank, isOffsuit);
  }

  _parseSegment(segment) {
    const type = this._detectNotationType(segment);
    if (type === 'pair') return this._parsePairRange(segment);
    if (type === 'suited') return this._parseSuitedRange(segment);
    if (type === 'offsuit') return this._parseOffsuitRange(segment);
    if (type === 'rankX') return this._parseRankXNotation(segment);
    if (type === 'anySuit') return this._parseAnySuitRange(segment);
    if (type === 'wildcard') return this._parseWildcardHand(segment);
    if (type === 'specific') return [this._parseSpecificHand(segment)];
    throw new Error(`Unrecognized notation: ${segment}`);
  }

  // Parses notation, an array or an object into { hands, weights }. Later entries override earlier ones, and a
  // weight of 0 removes the combo. weights holds only combos whose weight is not 1.
  //   string: 'AA,AKs:0.5,TT+:0.25,AhKh:0.4'
  //   array:  exact combos, each 'AhKh', 'AhKh:0.4' or ['AhKh', 0.4]
  //   object: { AhKh: 0.4, AsKs: 1 } (exact combos)
  _parseWeighted(input) {
    const entries = new Map();
    const set = (hands, weight) => hands.forEach(hand => { entries.delete(hand); entries.set(hand, weight); });
    const exactHand = (hand, where) => {
      if (!this._isValidHand(hand)) throw new Error(`Invalid hand in ${where}: ${hand}`);
      return this._normalizeHand(hand);
    };
    if (typeof input === 'string') {
      const normalized = this.normalizeNotation(input);
      normalized.split(',').map(s => s.trim()).filter(s => s).forEach(entry => {
        const [range, weight] = this._splitWeight(entry);
        set(this._parseSegment(range.trim()), weight === undefined ? 1 : this._parseWeight(weight, range));
      });
    } else if (Array.isArray(input)) {
      if (input.length === 0) throw new Error('Array cannot be empty');
      input.forEach(item => {
        if (Array.isArray(item)) {
          set([exactHand(item[0], 'array')], this._parseWeight(item[1], item[0]));
        } else if (this._isPlainObject(item) && typeof item.hand === 'string') {
          set([exactHand(item.hand, 'array')], item.weight === undefined ? 1 : this._parseWeight(item.weight, item.hand));
        } else if (typeof item === 'string' && item.includes(':')) {
          const [hand, weight] = this._splitWeight(item);
          set([exactHand(hand.trim(), 'array')], this._parseWeight(weight, hand));
        } else {
          set([exactHand(item, 'array')], 1);
        }
      });
    } else if (this._isPlainObject(input)) {
      const items = Object.entries(input);
      if (items.length === 0) throw new Error('Object cannot be empty');
      items.forEach(([hand, weight]) => set([exactHand(hand, 'object')], this._parseWeight(weight, hand)));
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

  _parse(input) {
    return this._parseWeighted(input).hands;
  }

  // ============================================================================
  // INTERNAL HELPER METHODS (INSTANCE CREATION & NORMALIZATION)
  // ============================================================================

  _createFilteredInstance(filteredHands, weights = null) {
    const newInstance = Object.create(Object.getPrototypeOf(this));
    Object.assign(newInstance, this);
    if (weights) newInstance.handWeights = weights;
    newInstance.filteredHands = this._filterDeadCards(filteredHands);
    // evaluationCache is shared by reference: entries are deterministic per (hand, board, strict),
    // so derived instances can safely reuse and extend each other's evaluations
    return newInstance;
  }

  _normalizeInputToHands(input) {
    if (typeof input === 'string' || Array.isArray(input) || this._isPlainObject(input)) return this._parse(input);
    throw new Error('Input must be range notation, an array of hands or an object of weights');
  }

  // { hands, weights } from an input to include/exclude/intersect/setWeight; a RangeManager gives its own
  _weightedInput(input) {
    if (input instanceof RangeManager) return { hands: input.filteredHands, weights: input.handWeights };
    if (typeof input === 'string' || Array.isArray(input) || this._isPlainObject(input)) return this._parseWeighted(input);
    throw new Error('Input must be range notation, an array of hands, an object of weights or a RangeManager');
  }

  // ============================================================================
  // COMBO WEIGHTS (frequencies from 0 to 1)
  // ============================================================================

  /** The weight of a combo in the range: 0 to 1, 0 when it is not in the range. */
  weightOf(hand) {
    const normalized = this._normalizeHand(hand);
    if (!this.contains(normalized)) return 0;
    return this._weight(normalized);
  }

  _weight(hand) {
    return this.handWeights[hand] ?? 1;
  }

  /** Every combo in the range with its weight: { AhKh: 0.5, AsAd: 1, ... }. */
  weights() {
    return Object.fromEntries(this.filteredHands.map(hand => [hand, this._weight(hand)]));
  }

  /** The sum of the combos' weights: the range's size in weighted combos. */
  weightedSize() {
    return this.filteredHands.reduce((sum, hand) => sum + this._weight(hand), 0);
  }

  /** True when any combo has a weight other than 1. */
  isWeighted() {
    return this.filteredHands.some(hand => this._weight(hand) !== 1);
  }

  // A new range from hand -> weight pairs; weights at or below 0 drop the combo, above 1 are capped at 1
  _withWeightMap(map) {
    const hands = [];
    const weights = {};
    for (const [hand, raw] of map) {
      const weight = Math.min(1, raw);
      if (!(weight > 1e-12)) continue;
      hands.push(hand);
      if (weight !== 1) weights[hand] = weight;
    }
    return this._createFilteredInstance(hands, weights);
  }

  /** Multiplies every combo's weight by factor (capped at 1). scale(0.5) halves the range's frequencies. */
  scale(factor) {
    if (typeof factor !== 'number' || !Number.isFinite(factor) || factor < 0) throw new Error('scale needs a number of 0 or more');
    return this._withWeightMap(this.filteredHands.map(hand => [hand, this._weight(hand) * factor]));
  }

  /** Sets the weight of the combos of `input` that are in the range: setWeight('AKs', 0.5). 0 removes them. */
  setWeight(input, weight) {
    const value = this._parseWeight(weight, 'setWeight');
    const targets = new Set(this._parse(input));
    return this._withWeightMap(this.filteredHands.map(hand => [hand, targets.has(hand) ? value : this._weight(hand)]));
  }

  // ============================================================================
  // FILTERING METHODS
  // ============================================================================

  handContainsDeadCard(hand, deadCards) {
    if (!deadCards || deadCards.length === 0) return false;
    return this._handHasCardIn(hand, this._toCardSet(deadCards));
  }

  // Expands wildcards once so per-hand checks are O(1) Set lookups
  _toCardSet(cards) {
    return new Set(this._parseCardArray(cards));
  }

  _handHasCardIn(hand, cardSet) {
    return cardSet.has(this._normalizeCard(hand.substring(0, 2))) || cardSet.has(this._normalizeCard(hand.substring(2, 4)));
  }

  _withoutCards(hands, cards) {
    if (!cards || cards.length === 0) return hands;
    const cardSet = this._toCardSet(cards);
    return hands.filter(hand => !this._handHasCardIn(hand, cardSet));
  }

  _filterDeadCards(hands) {
    return this._withoutCards(hands, this.deadCards);
  }

  handHasSuit(hand, suit) {
    const normalizedSuit = suit.toLowerCase();
    if (!this._isValidSuit(normalizedSuit)) return false;
    const [card1, card2] = this._extractCardsFromHand(hand);
    return card1[1] === normalizedSuit || card2[1] === normalizedSuit;
  }

  handSuitedOf(hand, suit) {
    const normalizedSuit = suit.toLowerCase();
    if (!this._isValidSuit(normalizedSuit)) return false;
    const [card1, card2] = this._extractCardsFromHand(hand);
    return card1[1] === normalizedSuit && card2[1] === normalizedSuit;
  }

  /**
   * Removes hands (notation, an array of hands, weights or a RangeManager) or every hand holding one of a list of
   * cards (['Ah', 'Kx']). A weighted input removes that share of each combo: excluding 'AKs:0.25' keeps 75% of AKs.
   */
  exclude(input) {
    if (Array.isArray(input) && (input.length === 0 || this._isValidCard(input[0]))) {
      return this._createFilteredInstance(this._withoutCards(this.filteredHands, input));
    }
    const { hands, weights } = this._weightedInput(input);
    const removed = new Map(hands.map(hand => [hand, weights[hand] ?? 1]));
    return this._withWeightMap(this.filteredHands.map(hand => [hand, this._weight(hand) * (1 - (removed.get(hand) ?? 0))]));
  }

  hasSuit(suit) {
    const normalizedSuit = suit.toLowerCase();
    if (!this._isValidSuit(normalizedSuit)) throw new Error(`Invalid suit: ${suit}`);
    const filtered = this.filteredHands.filter(hand => this.handHasSuit(hand, normalizedSuit));
    return this._createFilteredInstance(filtered);
  }

  suitedOf(suit) {
    const normalizedSuit = suit.toLowerCase();
    if (!this._isValidSuit(normalizedSuit)) throw new Error(`Invalid suit: ${suit}`);
    const filtered = this.filteredHands.filter(hand => this.handSuitedOf(hand, normalizedSuit));
    return this._createFilteredInstance(filtered);
  }

  _toCriterionKey(criterion) {
    return CRITERIA_LOOKUP.get(criterion) || criterion;
  }

  _normalizeCriteria(criteria) {
    if (!Array.isArray(criteria)) throw new Error('Criteria must be an array');
    return criteria.map(c => this._toCriterionKey(c));
  }

  _normalizeBoardCards(boardCards) {
    if (!Array.isArray(boardCards) || boardCards.length === 0) throw new Error('Board cards are required');
    const normalized = boardCards.map(card => {
      if (!this._isValidConcreteCard(card)) throw new Error(`Invalid board card: ${card}`);
      return this._normalizeCard(card);
    });
    if (new Set(normalized).size !== normalized.length) throw new Error('Board cards must be unique');
    return normalized;
  }

  // Normalizes a hand + board for the public evaluation methods and rejects overlapping cards
  _prepareEvaluationInput(hand, boardCards) {
    const normalizedHand = this._normalizeHand(hand);
    const board = this._normalizeBoardCards(boardCards);
    const overlap = this._extractCardsFromHand(normalizedHand).filter(c => board.includes(c));
    if (overlap.length > 0) throw new Error(`Hand ${hand} shares cards with board: ${overlap.join(', ')}`);
    return [normalizedHand, board];
  }

  async _loadEvaluator() {
    if (!extval) {
      const mod = await import('poker-extval');
      // poker-extval is CommonJS: Node exposes its functions as named exports, some bundlers only on default
      const pick = name => mod[name] || (mod.default && mod.default[name]);
      // Only functions that take exact cards: poker-extval's range functions load poker-rangeman itself
      extval = { evaluateHand: pick('evaluateHand'), evaluate: pick('evaluate') };
    }
    return extval;
  }

  async _loadBitVal() {
    if (!bitval) {
      const mod = await import('poker-bitvaljs');
      const BitVal = mod.default || mod;
      bitval = new BitVal();
    }
    return bitval;
  }

  // Runs out the board for every hero/villain matchup (the same call poker-extval's equity() makes).
  // Exact on the flop and turn; preflop it uses a table or Monte Carlo. Clashing combos are skipped.
  async _computeEquity(heroHands, villainHands, board, deadCards, iterations) {
    const bv = await this._loadBitVal();
    const result = await bv.compareRange(heroHands, villainHands, board, deadCards, 5, iterations, true, null, 100, false);
    const total = result.win + result.tie + result.lose;
    return { win: result.win, tie: result.tie, lose: result.lose, equity: total ? (result.win + result.tie / 2) / total : null };
  }

  // Accepts the positional `strict` boolean used by earlier versions, or an options object
  _parseEvaluationOptions(strictOrOptions) {
    const options = strictOrOptions && typeof strictOrOptions === 'object' ? strictOrOptions : { strict: strictOrOptions };
    const strict = options.strict ?? true;
    if (typeof strict !== 'boolean') throw new Error('strict must be a boolean');
    const street = this._validateStreet(options.street);
    return { strict, street, excludeBoardPlays: options.excludeBoardPlays === true };
  }

  _validateStreet(street) {
    if (street === undefined || street === null) return null;
    if (!STREETS.has(street)) throw new Error(`Invalid street: ${street}. Use 'flop', 'turn' or 'river'`);
    return street;
  }

  // Synchronous: callers must `await this._loadEvaluator()` first. Hand and board must not overlap.
  // The hand is passed as hole cards, so board-relative labels, draws and usesHoleCards are the hand's own.
  _evaluateSync(hand, boardCards, strict, street = null) {
    const handCards = this._extractCardsFromHand(hand);
    const cards = [...handCards, ...boardCards];
    if (cards.length < 5) {
      throw new Error(`Need at least 5 unique cards total (hand + board). Got ${cards.length} unique cards from hand [${handCards.join(', ')}] and board [${boardCards.join(', ')}]`);
    }
    const result = extval.evaluateHand(cards, { strict, holeCards: handCards, street });
    for (const evalObj of Object.values(result)) this._addDerivedFlags(evalObj, handCards);
    return result;
  }

  // isMiddlingPair: a pocket pair between the highest and lowest board cards (extval's isMiddlePair also
  // covers pairing a middle board card)
  _addDerivedFlags(evalObj, handCards) {
    const isMiddlingPair = evalObj.isMiddlePair === true && this._isPocketPair(handCards);
    evalObj.isMiddlingPair = isMiddlingPair;
    if (evalObj.keyCards) evalObj.keyCards.isMiddlingPair = isMiddlingPair ? [...evalObj.keyCards.isMiddlePair] : [];
    if (evalObj.kickerCards) evalObj.kickerCards.isMiddlingPair = isMiddlingPair ? [...evalObj.kickerCards.isMiddlePair] : [];
    return evalObj;
  }

  async _evaluateHandWithBoard(hand, boardCards, options) {
    await this._loadEvaluator();
    return this._evaluateSync(hand, boardCards, options.strict, options.street);
  }

  _cacheKey(hand, boardKey, strict, street = null) {
    return `${hand}|${boardKey}|strict:${strict}|street:${street ?? 'auto'}`;
  }

  // Synchronous cached evaluation; boardKey is boardCards.join(',') computed once per call
  _getCachedOrEvaluate(hand, boardCards, boardKey, strict, street = null) {
    const cacheKey = this._cacheKey(hand, boardKey, strict, street);
    let evaluations = this.evaluationCache.get(cacheKey);
    if (!evaluations) {
      evaluations = Object.values(this._evaluateSync(hand, boardCards, strict, street));
      this.evaluationCache.set(cacheKey, evaluations);
    }
    return evaluations;
  }

  // With excludeBoardPlays, a made hand that uses no hole card (e.g. AK on 8-8-3 "making" a pair) does not count
  _criterionMatches(evalObj, criterion, excludeBoardPlays) {
    if (evalObj[criterion] !== true) return false;
    return !(excludeBoardPlays && MADE_HANDS.has(criterion) && evalObj.usesHoleCards === false);
  }

  _evaluationsMatchCriteria(evaluations, normalizedCriteria, excludeBoardPlays) {
    return evaluations.some(evalObj =>
      normalizedCriteria.some(c => this._criterionMatches(evalObj, c, excludeBoardPlays))
    );
  }

  async makesHand(criteria, boardCards = [], strictOrOptions = true) {
    const { normalizedCriteria, board } = this._validateCriteriaAndBoard(criteria, boardCards);
    const options = this._parseEvaluationOptions(strictOrOptions);
    await this._loadEvaluator();
    const boardSet = new Set(board);
    const boardKey = board.join(',');
    const filtered = this.filteredHands.filter(hand => {
      const handCards = this._extractCardsFromHand(hand);
      if (handCards.some(card => boardSet.has(card))) return false;
      const evaluations = this._getCachedOrEvaluate(hand, board, boardKey, options.strict, options.street);
      return this._evaluationsMatchCriteria(evaluations, normalizedCriteria, options.excludeBoardPlays);
    });
    return this._createEvaluatedInstance(filtered, board, normalizedCriteria, options);
  }

  async evaluateHand(hand, boardCards, strictOrOptions = true) {
    const [normalizedHand, board] = this._prepareEvaluationInput(hand, boardCards);
    const evaluation = await this._evaluateHandWithBoard(normalizedHand, board, this._parseEvaluationOptions(strictOrOptions));
    return {
      is: (criteria) => this._filterEvaluation(evaluation, criteria, false),
      isAll: (criteria) => this._filterEvaluation(evaluation, criteria, true)
    };
  }

  async getObject(hand, boardCards, strictOrOptions = true) {
    const [normalizedHand, board] = this._prepareEvaluationInput(hand, boardCards);
    return await this._evaluateHandWithBoard(normalizedHand, board, this._parseEvaluationOptions(strictOrOptions));
  }

  /** Adds hands; a combo already in the range keeps the larger of its two weights. */
  include(input) {
    const { hands, weights } = this._weightedInput(input);
    const map = new Map(this.filteredHands.map(hand => [hand, this._weight(hand)]));
    hands.forEach(hand => map.set(hand, Math.max(map.get(hand) ?? 0, weights[hand] ?? 1)));
    return this._withWeightMap(map);
  }

  /** Keeps the hands also in `input`; weights multiply, so intersecting with 'AKs:0.5' halves AKs. */
  intersect(input) {
    const { hands, weights } = this._weightedInput(input);
    const other = new Map(hands.map(hand => [hand, weights[hand] ?? 1]));
    return this._withWeightMap(this.filteredHands.filter(hand => other.has(hand)).map(hand => [hand, this._weight(hand) * other.get(hand)]));
  }

  _validateAndExpandDeadCards(deadCards) {
    if (!Array.isArray(deadCards)) throw new Error('Dead cards must be an array');
    deadCards.forEach(card => {
      if (!this._isValidCard(card)) throw new Error(`Invalid card: ${card}`);
    });
    return this._parseCardArray(deadCards);
  }

  setDeadCards(deadCards) {
    const expanded = this._validateAndExpandDeadCards(deadCards);
    // Filter hands using the NEW dead cards before creating instance
    const filtered = this._withoutCards(this.filteredHands, expanded);
    const newInstance = this._createFilteredInstance(filtered);
    newInstance.deadCards = expanded;
    // Equity depends on dead cards: run getEquity() / against() again
    newInstance.handEquity = null;
    newInstance.matchup = null;
    return newInstance;
  }

  _validateCriteriaAndBoard(criteria, boardCards) {
    if (!Array.isArray(criteria)) throw new Error('Criteria must be an array');
    const board = this._normalizeBoardCards(boardCards);
    const invalidCriteria = criteria.filter(c => typeof c !== 'string' || !VALID_CRITERIA.has(this._toCriterionKey(c)));
    if (invalidCriteria.length > 0) throw new Error(`Invalid criteria: ${invalidCriteria.join(', ')}`);
    return { normalizedCriteria: this._normalizeCriteria(criteria), board };
  }

  // Board/criteria/strict/street state is set only on the returned instance, never on `this`
  _createEvaluatedInstance(filtered, board, normalizedCriteria, options) {
    const instance = this._createFilteredInstance(filtered);
    instance.lastBoardCards = board;
    instance.lastHandStrength = normalizedCriteria;
    instance.lastStrict = options.strict;
    instance.lastStreet = options.street;
    return instance;
  }

  async _filterByCombinations(criteria, boardCards, minHandCards, strictOrOptions = true) {
    const { normalizedCriteria, board } = this._validateCriteriaAndBoard(criteria, boardCards);
    const options = this._parseEvaluationOptions(strictOrOptions);
    // Fewer than 5 cards in total cannot be evaluated: no hand can hit
    if (board.length + 2 < 5) return this._createEvaluatedInstance([], board, normalizedCriteria, options);
    await this._loadEvaluator();
    const boardSet = new Set(board);
    const boardKey = board.join(',');
    // filteredHands never contain dead cards: _createFilteredInstance and the constructor remove them
    const filtered = this.filteredHands.filter(hand => {
      const handCards = this._extractCardsFromHand(hand);
      if (handCards.some(card => boardSet.has(card))) return false;
      const evaluations = this._getCachedOrEvaluate(hand, board, boardKey, options.strict, options.street);
      return this._evaluationsMatchWithHandCards(evaluations, normalizedCriteria, handCards, minHandCards, options.excludeBoardPlays);
    });
    return this._createEvaluatedInstance(filtered, board, normalizedCriteria, options);
  }

  async hitsHand(criteria, boardCards, strictOrOptions = true) {
    return await this._filterByCombinations(criteria, boardCards, 1, strictOrOptions);
  }

  async hitsHandBoth(criteria, boardCards, strictOrOptions = true) {
    return await this._filterByCombinations(criteria, boardCards, 2, strictOrOptions);
  }

  _getCachedOnly(hand, boardCards) {
    if (!boardCards) return null;
    const boardKey = boardCards.join(',');
    const street = this.lastStreet ?? null;
    // Use the strict mode and street of the evaluation that produced this instance; fall back to trying both modes
    if (this.lastStrict !== null && this.lastStrict !== undefined) {
      return this.evaluationCache.get(this._cacheKey(hand, boardKey, this.lastStrict, street)) || null;
    }
    return this.evaluationCache.get(this._cacheKey(hand, boardKey, true, street))
      || this.evaluationCache.get(this._cacheKey(hand, boardKey, false, street)) || null;
  }

  _parseSingleCard(card) {
    if (!card || typeof card !== 'string' || card.length !== 2) return [card];
    const rank = card[0].toUpperCase();
    const suit = card[1].toLowerCase();
    if (rank === 'X' && this._isValidSuit(suit)) return VALID_RANKS.map(r => r + suit);
    if (this._isValidRank(rank) && suit === 'x') return VALID_SUITS.map(s => rank + s);
    return [rank + suit];
  }

  _parseCardArray(cards) {
    if (!Array.isArray(cards)) throw new Error('Cards must be an array');
    return cards.flatMap(c => this._parseSingleCard(c));
  }

  _checkCardsInArray(cards, targetArray, and) {
    if (!Array.isArray(cards)) throw new Error('Cards must be an array');
    if (cards.length === 0) return false;
    const expandedCards = this._parseCardArray(cards);
    const normalizedTarget = targetArray.map(c => {
      if (!c || typeof c !== 'string') return c;
      return c[0].toUpperCase() + (c[1] || '').toLowerCase();
    });
    if (and) return expandedCards.every(c => normalizedTarget.includes(c));
    return expandedCards.some(c => normalizedTarget.includes(c));
  }

  _normalizeHandStrength(handStrength) {
    return this._toCriterionKey(handStrength);
  }

  _getHandStrengthKeys(handStrength, cachedCriteria) {
    if (handStrength) return [this._normalizeHandStrength(handStrength)];
    return cachedCriteria || [];
  }

  _checkCardsInHandStrengthObject(cards, strengthObj, handStrengthKeys, and) {
    if (!strengthObj || !handStrengthKeys || handStrengthKeys.length === 0) return false;
    const results = handStrengthKeys.map(key => {
      const cardArray = strengthObj[key] || [];
      return this._checkCardsInArray(cards, cardArray, and);
    });
    return and ? results.every(r => r) : results.some(r => r);
  }

  _filterByHandStrengthCards(cards, propertyName, handStrengthKeys, and) {
    const filtered = [];
    for (const hand of this.filteredHands) {
      const evaluations = this._getCachedOnly(hand, this.lastBoardCards);
      if (evaluations && evaluations.some(evalObj => this._checkCardsInHandStrengthObject(cards, evalObj[propertyName], handStrengthKeys, and))) filtered.push(hand);
    }
    return this._createFilteredInstance(filtered);
  }

  hasKicker(cards, and = false, handStrength = null) {
    if (!this.lastBoardCards) return this._createFilteredInstance([]);
    const handStrengthKeys = this._getHandStrengthKeys(handStrength, this.lastHandStrength);
    if (handStrengthKeys.length === 0) return this._createFilteredInstance([]);
    return this._filterByHandStrengthCards(cards, 'kickerCards', handStrengthKeys, and);
  }

  hasKeyCard(cards, and = false, handStrength = null) {
    if (!this.lastBoardCards) return this._createFilteredInstance([]);
    const handStrengthKeys = this._getHandStrengthKeys(handStrength, this.lastHandStrength);
    if (handStrengthKeys.length === 0) return this._createFilteredInstance([]);
    return this._filterByHandStrengthCards(cards, 'keyCards', handStrengthKeys, and);
  }

  getKeyCards(handStrength = null) {
    if (!this.lastBoardCards) return [];
    const handStrengthKeys = this._getHandStrengthKeys(handStrength, this.lastHandStrength);
    if (handStrengthKeys.length === 0) return [];
    
    const allKeyCards = new Set();
    
    for (const hand of this.filteredHands) {
      const evaluations = this._getCachedOnly(hand, this.lastBoardCards);
      if (!evaluations) continue;
      
      for (const evalObj of evaluations) {
        if (!evalObj.keyCards) continue;
        
        // Collect key cards for all matching criteria
        for (const criterion of handStrengthKeys) {
          const keyCards = evalObj.keyCards[criterion];
          if (Array.isArray(keyCards)) {
            keyCards.forEach(card => {
              if (card && typeof card === 'string') {
                // Normalize card format (uppercase rank, lowercase suit)
                const normalized = card[0].toUpperCase() + (card[1] || '').toLowerCase();
                allKeyCards.add(normalized);
              }
            });
          }
        }
      }
    }
    
    return Array.from(allKeyCards).sort();
  }

  // A criterion counts only when at least minHandCards of the hand's cards are among its key cards
  _evaluationsMatchWithHandCards(evaluations, criteria, handCards, minHandCards, excludeBoardPlays = false) {
    return evaluations.some(evalObj => criteria.some(c =>
      this._criterionMatches(evalObj, c, excludeBoardPlays)
      && this._handCardsInKeyCardsForCriterion(handCards, evalObj, c) >= minHandCards
    ));
  }

  _handCardsInKeyCardsForCriterion(normalizedHandCards, evalObj, criterion) {
    const keyCards = (evalObj.keyCards?.[criterion] || []).map(c => {
      if (!c || typeof c !== 'string') return c;
      return c[0].toUpperCase() + (c[1] || '').toLowerCase();
    });
    return normalizedHandCards.filter(c => keyCards.includes(c)).length;
  }

  _filterEvaluation(evaluation, criteria, matchAll) {
    // Normalize criteria - handle both string and array
    const criteriaArray = Array.isArray(criteria) ? criteria : [criteria];
    const normalizedCriteria = criteriaArray.map(c => this._toCriterionKey(c));
    
    // Filter evaluation entries
    const filtered = {};
    for (const [combo, evalObj] of Object.entries(evaluation)) {
      let matches = false;
      if (matchAll) {
        // AND logic: all criteria must match
        matches = normalizedCriteria.every(c => evalObj[c] === true);
      } else {
        // OR logic: any criteria matches
        matches = normalizedCriteria.some(c => evalObj[c] === true);
      }
      if (matches) {
        filtered[combo] = evalObj;
      }
    }
    return filtered;
  }

  // ============================================================================
  // ANALYSIS METHODS (EQUITY, STRENGTH, BREAKDOWN, BLOCKERS)
  // ============================================================================

  // A board for analysis: empty (preflop), or 3-5 unique cards
  _normalizeAnalysisBoard(boardCards) {
    if (boardCards === undefined || boardCards === null) return [];
    if (!Array.isArray(boardCards)) throw new Error('Board cards must be an array');
    if (boardCards.length === 0) return [];
    const board = this._normalizeBoardCards(boardCards);
    if (board.length < 3 || board.length > 5) throw new Error(`Board must have 0 or 3 to 5 cards, got ${board.length}`);
    return board;
  }

  // A board for per-hand evaluation: 3-5 unique cards
  _requireEvaluationBoard(boardCards) {
    const board = this._normalizeAnalysisBoard(boardCards);
    if (board.length === 0) throw new Error('Board cards are required');
    return board;
  }

  // Villain as { hands, weights }: range notation, an array of hands or cards, weights, or another RangeManager
  _resolveVillain(villain) {
    if (villain instanceof RangeManager) return { hands: villain.toArray(), weights: villain.handWeights };
    if (Array.isArray(villain) && villain.length === 2 && villain.every(c => typeof c === 'string' && this._isValidConcreteCard(c))) {
      return { hands: [this._normalizeHand(villain.join(''))], weights: {} };
    }
    if (typeof villain === 'string' || Array.isArray(villain) || this._isPlainObject(villain)) return this._parseWeighted(villain);
    throw new Error('Villain must be range notation, an array of hands, an object of weights, or a RangeManager');
  }

  // Equity between two weighted ranges in one bitval call: each pair counts heroWeight x villainWeight
  async _weightedEquity(heroHands, heroWeights, villainHands, villainWeights, board, deadCards, iterations) {
    const entries = (hands, weights) => hands.map(hand => (weights[hand] === undefined ? hand : { hand, weight: weights[hand] }));
    return this._computeEquity(entries(heroHands, heroWeights), entries(villainHands, villainWeights), board, deadCards, iterations);
  }

  _weightKey(hands, weights) {
    return hands.map(hand => (weights[hand] === undefined ? hand : `${hand}:${weights[hand]}`)).sort().join(',');
  }

  // A share of 0-1, as a number (0.8) or a percentage string ('80%')
  _parseShare(value, label = 'Equity') {
    let share = value;
    if (typeof value === 'string') {
      const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*%$/);
      if (!match) throw new Error(`${label} must be a number from 0 to 1 or a percentage like '80%', got '${value}'`);
      share = Number(match[1]) / 100;
    }
    if (typeof share !== 'number' || Number.isNaN(share) || share < 0 || share > 1) {
      throw new Error(`${label} must be a number from 0 to 1 or a percentage like '80%', got ${value}`);
    }
    return share;
  }

  _prepareEquity(villain, boardCards, options = {}) {
    const board = this._normalizeAnalysisBoard(boardCards);
    const { hands: villainHands, weights: villainWeights } = this._resolveVillain(villain);
    const extraDead = options.deadCards ? this._validateAndExpandDeadCards(options.deadCards) : [];
    const deadCards = [...new Set([...this.deadCards, ...extraDead])];
    const iterations = options.iterations ?? 10000;
    if (!Number.isInteger(iterations) || iterations < 1) throw new Error('iterations must be a positive integer');
    const key = `${this._weightKey(villainHands, villainWeights)}|${board.join(',')}|${[...deadCards].sort().join(',')}|${iterations}`;
    return { board, villainHands, villainWeights, deadCards, iterations, key };
  }

  /**
   * Equity of this whole range against villain, counting every possible runout (exact on the flop and
   * turn, a Monte Carlo estimate preflop). Combos that clash with the board or dead cards are skipped.
   * With no arguments, totals the equity stored by getEquity() for the hands in the range.
   */
  async equity(villain, boardCards = [], options = {}) {
    if (villain === undefined) {
      const handEquity = this._requireStoredEquity();
      const totals = { win: 0, tie: 0, lose: 0 };
      for (const hand of this.filteredHands) {
        const weight = this._weight(hand);
        for (const key of ['win', 'tie', 'lose']) totals[key] += handEquity[hand][key] * weight;
      }
      const total = totals.win + totals.tie + totals.lose;
      return { ...totals, equity: total ? (totals.win + totals.tie / 2) / total : null };
    }
    const { board, villainHands, villainWeights, deadCards, iterations } = this._prepareEquity(villain, boardCards, options);
    if (this.filteredHands.length === 0 || villainHands.length === 0) return { win: 0, tie: 0, lose: 0, equity: null };
    return this._weightedEquity(this.filteredHands, this.handWeights, villainHands, villainWeights, board, deadCards, iterations);
  }

  /**
   * Equity of each hand in this range against villain, as { hand: { win, tie, lose, equity } }.
   * equity is null for a hand that cannot be dealt (it shares a card with the board or dead cards).
   * With no arguments, returns the equity stored by getEquity() for the hands in the range.
   */
  async equityByHand(villain, boardCards = [], options = {}) {
    if (villain === undefined) {
      const handEquity = this._requireStoredEquity();
      return Object.fromEntries(this.filteredHands.map(hand => [hand, handEquity[hand]]));
    }
    const prepared = this._prepareEquity(villain, boardCards, options);
    const results = {};
    for (const hand of this.filteredHands) {
      results[hand] = await this._handEquity(hand, prepared);
    }
    return results;
  }

  async _handEquity(hand, { board, villainHands, villainWeights, deadCards, iterations, key }) {
    const cacheKey = `${hand}|${key}`;
    if (!this.equityCache.has(cacheKey)) {
      const handCards = this._extractCardsFromHand(hand);
      const blocked = handCards.some(c => board.includes(c) || deadCards.includes(c));
      const result = blocked || villainHands.length === 0
        ? { win: 0, tie: 0, lose: 0, equity: null }
        : await this._weightedEquity([hand], {}, villainHands, villainWeights, board, deadCards, iterations);
      this.equityCache.set(cacheKey, result);
    }
    return this.equityCache.get(cacheKey);
  }

  /**
   * Runs equity against villain once for every hand and stores it on the returned range, so the equity
   * filters (equityAbove, equityBelow, equityBetween) and equity()/equityByHand() can read it without
   * recomputing. Chainable: await rm.getEquity('QQ+', board).equityAbove('60%').hasSuit('s')
   */
  async getEquity(villain, boardCards = [], options = {}) {
    if (villain === undefined) throw new Error('getEquity needs a villain range');
    const bands = this._resolveBands(options.bands);
    const shapeEnough = this._parseShare(options.shape?.enough ?? 0.1, 'shape.enough');
    if (shapeEnough === 0) throw new Error('shape.enough must be above 0');
    const topEnd = this._parseShare(options.shape?.topEnd ?? 0.05, 'shape.topEnd');
    if (topEnd === 0) throw new Error('shape.topEnd must be above 0');
    const minDominant = this._parseShare(options.shape?.minDominant ?? 0.5, 'shape.minDominant');
    const nutsMinEquity = this._parseShare(options.nuts?.minEquity ?? 0.9, 'nuts.minEquity');
    const prepared = this._prepareEquity(villain, boardCards, options);
    const handEquity = {};
    for (const hand of this.filteredHands) {
      handEquity[hand] = await this._handEquity(hand, prepared);
    }
    const instance = this._createFilteredInstance(this.filteredHands);
    instance.handEquity = handEquity;
    // The matchup the stored equity belongs to, for the range vs range analysis methods
    instance.matchup = {
      villainHands: prepared.villainHands,
      villainWeights: prepared.villainWeights,
      parentWeights: this.handWeights,
      board: prepared.board,
      deadCards: prepared.deadCards,
      iterations: prepared.iterations,
      key: prepared.key,
      bands,
      shapeEnough,
      topEnd,
      minDominant,
      nutsMinEquity,
      // The range at against() time: the hands later filters choose from, for shape contiguity
      parentHands: [...this.filteredHands]
    };
    return instance;
  }

  /**
   * Sets villain's range and the board for range vs range analysis: runs hero's equity once (as getEquity)
   * and stores the matchup, so buckets, bucket filters, compare(), compareTo(), defend() and
   * bluffCandidates() work without repeating villain and board.
   * options: { bands, deadCards, iterations, shape: { enough, minDominant, topEnd } }: enough is the share at
   * which an end of the range counts as fully present for the shape scores (default 0.1); minDominant the
   * score a shape needs to be named dominant (default 0.5); topEnd the strongest share of combos that counts
   * as the top end for capping (default 0.05); nuts.minEquity the equity against the other range a hand needs
   * to count as effective nuts (default 0.9).
   */
  async against(villain, boardCards = [], options = {}) {
    if (villain === undefined) throw new Error('against needs a villain range');
    return this.getEquity(villain, boardCards, options);
  }

  _requireStoredEquity() {
    if (!this.handEquity) throw new Error('No equity yet: call getEquity(villain, board) first');
    const missing = this.filteredHands.filter(hand => !Object.hasOwn(this.handEquity, hand));
    if (missing.length > 0) {
      throw new Error(`${missing.length} hand(s) have no equity (e.g. ${missing[0]}, added after getEquity): call getEquity again`);
    }
    return this.handEquity;
  }

  _filterByStoredEquity(matches) {
    const handEquity = this._requireStoredEquity();
    const filtered = this.filteredHands.filter(hand => handEquity[hand].equity !== null && matches(handEquity[hand].equity));
    return this._createFilteredInstance(filtered);
  }

  // With only thresholds, filters synchronously on the equity stored by getEquity(). Given villain (and board,
  // options) as in 3.6.0, runs getEquity first and returns a RangeQuery.
  _equityFilter(buildMatcher, equityArgs) {
    if (equityArgs.length > 0 && equityArgs[0] !== undefined) {
      return new RangeQuery(Promise.resolve().then(() => {
        const matches = buildMatcher();
        return this.getEquity(...equityArgs).then(range => range._filterByStoredEquity(matches));
      }));
    }
    return this._filterByStoredEquity(buildMatcher());
  }

  /** Hands whose stored equity is greater than min (0-1 or '80%'). */
  equityAbove(min, ...equityArgs) {
    return this._equityFilter(() => {
      const threshold = this._parseShare(min);
      return e => e > threshold;
    }, equityArgs);
  }

  /** Hands whose stored equity is less than max (0-1 or '20%'). */
  equityBelow(max, ...equityArgs) {
    return this._equityFilter(() => {
      const threshold = this._parseShare(max);
      return e => e < threshold;
    }, equityArgs);
  }

  /** Hands whose stored equity is between min and max, inclusive (0-1 or '70%'). */
  equityBetween(min, max, ...equityArgs) {
    return this._equityFilter(() => {
      const low = this._parseShare(min);
      const high = this._parseShare(max);
      if (low > high) throw new Error(`Equity range is empty: min ${min} is above max ${max}`);
      return e => e >= low && e <= high;
    }, equityArgs);
  }

  _compareRankArrays(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const diff = (a[i] ?? -1) - (b[i] ?? -1);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  /**
   * Every hand that can be dealt on this board, strongest first, with its made hand:
   * [{ hand, category, strength, rank }]. rank compares element by element (higher is better);
   * it reflects the made hand only, not draws.
   */
  async rankHands(boardCards, options = {}) {
    const board = this._requireEvaluationBoard(boardCards);
    const street = this._validateStreet(options.street);
    await this._loadEvaluator();
    const boardSet = new Set(board);
    const ranked = [];
    for (const hand of this.filteredHands) {
      const handCards = this._extractCardsFromHand(hand);
      if (handCards.some(c => boardSet.has(c))) continue;
      ranked.push({ ...this._rankSync(hand, board, street), weight: this._weight(hand) });
    }
    return ranked.sort((a, b) => this._compareRankArrays(b.rank, a.rank));
  }

  // Synchronous, cached: the made hand of one combo on the board. Needs _loadEvaluator() first.
  _rankSync(hand, board, street = null) {
    const cacheKey = `rank|${hand}|${board.join(',')}|street:${street ?? 'auto'}`;
    let result = this.evaluationCache.get(cacheKey);
    if (!result) {
      const handCards = this._extractCardsFromHand(hand);
      const flat = extval.evaluate([...handCards, ...board], { holeCards: handCards, street });
      result = { hand, category: flat.category, strength: flat.strength, rank: flat.rank };
      this.evaluationCache.set(cacheKey, result);
    }
    return result;
  }

  // The given share of hands from one end of the ranking; hands tied with the last one taken are kept too
  async _takeByStrength(portion, boardCards, options, fromTop) {
    const share = this._parseShare(portion, 'Portion');
    const ranked = await this.rankHands(boardCards, options);
    if (fromTop === false) ranked.reverse();
    // By weight: take hands from this end until they hold the given share of the range's weight
    const target = share * ranked.reduce((sum, r) => sum + r.weight, 0);
    if (ranked.length === 0 || target <= 1e-12) return this._createFilteredInstance([]);
    let cumulative = 0;
    let cutoff = ranked[ranked.length - 1].rank;
    for (const r of ranked) {
      cumulative += r.weight;
      if (cumulative >= target - 1e-9) { cutoff = r.rank; break; }
    }
    const kept = new Set(ranked
      .filter(r => (fromTop ? this._compareRankArrays(r.rank, cutoff) >= 0 : this._compareRankArrays(r.rank, cutoff) <= 0))
      .map(r => r.hand));
    return this._createFilteredInstance(this.filteredHands.filter(hand => kept.has(hand)));
  }

  /** The strongest share of the range on this board (0-1 or '20%'), by made hand. */
  async strongest(portion, boardCards, options = {}) {
    return this._takeByStrength(portion, boardCards, options, true);
  }

  /** The weakest share of the range on this board (0-1 or '20%'), by made hand. */
  async weakest(portion, boardCards, options = {}) {
    return this._takeByStrength(portion, boardCards, options, false);
  }

  /**
   * How the range hits the board: { total, flags: { isPair: { count, share, combos }, ... } } for every flag
   * held by at least one hand, most common first. Hands that share a card with the board are left out.
   */
  async breakdown(boardCards, options = {}) {
    const board = this._requireEvaluationBoard(boardCards);
    const street = this._validateStreet(options.street);
    await this._loadEvaluator();
    const boardSet = new Set(board);
    const boardKey = board.join(',');
    const combosByFlag = new Map();
    let total = 0;
    let totalWeight = 0;
    for (const hand of this.filteredHands) {
      if (this._extractCardsFromHand(hand).some(c => boardSet.has(c))) continue;
      total++;
      totalWeight += this._weight(hand);
      const [evalObj] = this._getCachedOrEvaluate(hand, board, boardKey, true, street);
      for (const [flag, value] of Object.entries(evalObj)) {
        if (value !== true || !flag.startsWith('is')) continue;
        if (!combosByFlag.has(flag)) combosByFlag.set(flag, []);
        combosByFlag.get(flag).push(hand);
      }
    }
    const flags = {};
    [...combosByFlag.entries()]
      .map(([flag, combos]) => [flag, combos, combos.reduce((sum, hand) => sum + this._weight(hand), 0)])
      .sort((a, b) => b[2] - a[2])
      .forEach(([flag, combos, weight]) => { flags[flag] = { count: combos.length, weight, share: weight / totalWeight, combos }; });
    return { total, weight: totalWeight, flags };
  }

  /**
   * Treats this range as villain's and splits it by which known cards block it (as poker-extval's classifyRange):
   * { boardBlocks, heroBlocks, allBlocks }, each { unblocked, blocked }. heroCards are hero's hole cards
   * ('AhKd' or ['Ah', 'Kd']), optional; board plus hero cards must be at least 5 cards.
   */
  async blockers(boardCards, heroCards = null, options = {}) {
    const board = this._requireEvaluationBoard(boardCards);
    const street = this._validateStreet(options.street);
    let hole = null;
    if (heroCards !== null && heroCards !== undefined) {
      const hand = Array.isArray(heroCards) ? heroCards.join('') : heroCards;
      hole = this._extractCardsFromHand(this._prepareEvaluationInput(hand, board)[0]);
    }
    const cards = [...board, ...(hole || [])];
    if (cards.length < 5) throw new Error('Blockers need at least 5 known cards: a turn or river board, or a flop with hero cards');
    await this._loadEvaluator();
    return this._classifyBlockers(board, hole || [], street);
  }

  // Each view lists unblocked combos, and groups blocked ones under the made hand and draws villain would
  // hold with them (evaluated with the combo as villain's hole cards), or under onBoard if a board card blocks it
  _classifyBlockers(board, heroCards, street) {
    const boardCards = new Set(board);
    const heroSet = new Set(heroCards);
    const allCards = new Set([...board, ...heroCards]);
    const categories = new Map();
    const categoriesOf = hand => {
      if (!categories.has(hand)) {
        const villainCards = this._extractCardsFromHand(hand);
        const [evalObj] = Object.values(extval.evaluateHand([...board, ...villainCards], { strict: true, holeCards: villainCards, street }));
        categories.set(hand, [[...MADE_HANDS].find(flag => evalObj[flag]), ...VILLAIN_DRAWS.filter(flag => evalObj[flag])]);
      }
      return categories.get(hand);
    };
    const split = blockerSet => {
      const blocked = Object.fromEntries([...MADE_HANDS, ...VILLAIN_DRAWS, 'onBoard'].map(key => [key, []]));
      const unblocked = [];
      for (const hand of this.filteredHands) {
        const cards = this._extractCardsFromHand(hand);
        if (!cards.some(c => blockerSet.has(c))) unblocked.push(hand);
        else if (cards.some(c => boardCards.has(c))) blocked.onBoard.push(hand);
        else categoriesOf(hand).forEach(category => blocked[category].push(hand));
      }
      return { unblocked, blocked };
    };
    return { boardBlocks: split(boardCards), heroBlocks: split(heroSet), allBlocks: split(allCards) };
  }

  // ============================================================================
  // RANGE VS RANGE ANALYSIS (needs against() or getEquity() first)
  // ============================================================================

  // 'acevedo' (default), 'quartiles', or [{ name, min }, ...] with min from 0 to 1 (or '75%')
  _resolveBands(bands) {
    if (bands === undefined || bands === null) return BAND_PRESETS.acevedo;
    if (typeof bands === 'string') {
      if (!Object.hasOwn(BAND_PRESETS, bands)) throw new Error(`Unknown bands preset: ${bands}. Use ${Object.keys(BAND_PRESETS).join(' or ')}, or an array of { name, min }`);
      return BAND_PRESETS[bands];
    }
    if (!Array.isArray(bands) || bands.length === 0) throw new Error('bands must be a preset name or a non-empty array of { name, min }');
    const resolved = bands.map(band => {
      if (!band || typeof band.name !== 'string' || band.name === '') throw new Error('Each band needs a name');
      return { name: band.name, min: this._parseShare(band.min, `Band ${band.name} min`) };
    }).sort((a, b) => b.min - a.min);
    if (new Set(resolved.map(b => b.name)).size !== resolved.length) throw new Error('Band names must be unique');
    if (resolved[resolved.length - 1].min !== 0) throw new Error('The lowest band must start at 0 so every hand has a band');
    return resolved;
  }

  _requireMatchup() {
    if (!this.matchup) throw new Error('No matchup yet: call against(villain, board) first');
    return this.matchup;
  }

  _bandOf(equity, bands) {
    return bands.find(band => equity >= band.min).name;
  }

  /** The equity band of each hand against villain, e.g. { AcAd: 'strong', ... } (null when it cannot be dealt). */
  bandsByHand() {
    const { bands } = this._requireMatchup();
    const handEquity = this._requireStoredEquity();
    return Object.fromEntries(this.filteredHands.map(hand => {
      const equity = handEquity[hand].equity;
      return [hand, equity === null ? null : this._bandOf(equity, bands)];
    }));
  }

  /** Hands in the named equity band(s) against villain: bucket('good'), bucket('strong', 'good'). */
  bucket(...names) {
    const { bands } = this._requireMatchup();
    const handEquity = this._requireStoredEquity();
    const wanted = names.flat();
    const known = new Set(bands.map(b => b.name));
    const unknown = wanted.filter(name => !known.has(name));
    if (wanted.length === 0) throw new Error('bucket needs at least one band name');
    if (unknown.length > 0) throw new Error(`Unknown band: ${unknown.join(', ')}. Bands: ${[...known].join(', ')}`);
    const wantedSet = new Set(wanted);
    const filtered = this.filteredHands.filter(hand => {
      const equity = handEquity[hand].equity;
      return equity !== null && wantedSet.has(this._bandOf(equity, bands));
    });
    return this._createFilteredInstance(filtered);
  }

  // Villain's equity per hand against hero's current hands; cached per set of hero hands
  async _villainEquityByHand() {
    const { villainHands, board, deadCards, iterations, key } = this._requireMatchup();
    const heroHands = this.filteredHands;
    const cacheKey = `villain|${key}|${this._weightKey(heroHands, this.handWeights)}`;
    if (!this.equityCache.has(cacheKey)) {
      const results = {};
      for (const hand of villainHands) {
        const cards = this._extractCardsFromHand(hand);
        const blocked = cards.some(c => board.includes(c) || deadCards.includes(c));
        results[hand] = blocked || heroHands.length === 0
          ? { win: 0, tie: 0, lose: 0, equity: null }
          : await this._weightedEquity([hand], {}, heroHands, this.handWeights, board, deadCards, iterations);
      }
      this.equityCache.set(cacheKey, results);
    }
    return this.equityCache.get(cacheKey);
  }

  // { combos, equity, buckets: { name: { count, share, combos } }, shape } for one side. parentHands: the
  // range the hands were chosen from (for contiguity); null when the hands are the whole range.
  // Shares are by weight: each combo counts its weight (1 unless the range is weighted).
  _sideSummary(equityByHand, hands, bands, parentHands = null, enough = 0.1, minDominant = 0.5, weights = {}, parentWeights = {}) {
    const live = hands.filter(hand => equityByHand[hand] && equityByHand[hand].equity !== null);
    const weightOf = hand => weights[hand] ?? 1;
    const totals = { win: 0, tie: 0, lose: 0 };
    const buckets = Object.fromEntries(bands.map(band => [band.name, { count: 0, weight: 0, share: 0, combos: [] }]));
    let totalWeight = 0;
    for (const hand of live) {
      const result = equityByHand[hand];
      const weight = weightOf(hand);
      totals.win += result.win * weight; totals.tie += result.tie * weight; totals.lose += result.lose * weight;
      const bucket = buckets[this._bandOf(result.equity, bands)];
      bucket.combos.push(hand);
      bucket.weight += weight;
      totalWeight += weight;
    }
    for (const bucket of Object.values(buckets)) {
      bucket.count = bucket.combos.length;
      bucket.share = totalWeight ? bucket.weight / totalWeight : 0;
    }
    const runouts = totals.win + totals.tie + totals.lose;
    const contiguity = this._contiguity(live, parentHands, equityByHand, weightOf, hand => parentWeights[hand] ?? 1);
    return {
      combos: live.length,
      weight: totalWeight,
      equity: runouts ? (totals.win + totals.tie / 2) / runouts : null,
      buckets,
      shape: live.length ? this._shapeOf(buckets, bands, contiguity, enough, minDominant) : null
    };
  }

  // Share of the hands that are among the parent range's top N hands by equity (N = the hands' count; hands
  // tied with the Nth count too). 1 means no gaps: the hands are a top slice of what they were chosen from.
  // By weight: the parent's top slice holds as much weight as the hands do.
  _contiguity(live, parentHands, equityByHand, weightOf = () => 1, parentWeightOf = () => 1) {
    if (!parentHands || live.length === 0) return 1;
    const parent = parentHands
      .filter(hand => equityByHand[hand] && equityByHand[hand].equity !== null)
      .map(hand => ({ equity: equityByHand[hand].equity, weight: parentWeightOf(hand) }))
      .sort((a, b) => b.equity - a.equity);
    const mine = live.reduce((sum, hand) => sum + weightOf(hand), 0);
    const parentTotal = parent.reduce((sum, p) => sum + p.weight, 0);
    if (mine >= parentTotal - 1e-9) return 1;
    let cumulative = 0;
    let cutoff = parent[parent.length - 1].equity;
    for (const p of parent) {
      cumulative += p.weight;
      if (cumulative >= mine - 1e-9) { cutoff = p.equity; break; }
    }
    return live.filter(hand => equityByHand[hand].equity >= cutoff).reduce((sum, hand) => sum + weightOf(hand), 0) / mine;
  }

  /**
   * The three competing range shapes of Modern Poker Theory (Ch. 1, Range Morphology), each scored 0 to 1.
   * The range's equity against villain is split into the top band (T), the bottom band (B) and the bands
   * between (M). Each share is compared with an even spread across equity: density = share / band width
   * (with the default bands 0.25, 0.42 and 0.33), so 1 means as many hands as an even spread would have.
   * A part is hollow when it is thinner than its neighbours: hollow(part, than) = 1 - part / than, from 0 to 1.
   * - polarized = enough(T) x enough(B) x hollow(middle, thinner end): both ends, no hands in between
   * - linear    = enough(T) x hollow(bottom, middle) x contiguity: the top, then medium hands, without gaps
   * - condensed = hollow(thicker end, middle): the top and bottom removed
   * enough(x) = min(1, x / enough), default 10%. An even spread scores 0 on all three. The scores are
   * independent and need not add up to 1. dominant is the highest when it reaches minDominant, else null.
   */
  _shapeOf(buckets, bands, contiguity, enough, minDominant = 0.5) {
    const top = buckets[bands[0].name].share;
    const bottom = bands.length > 1 ? buckets[bands[bands.length - 1].name].share : 0;
    // Summed from the middle bands (not 1 - top - bottom) so an empty middle is exactly 0
    const middle = bands.slice(1, -1).reduce((sum, band) => sum + buckets[band.name].share, 0);
    const widths = this._bandWidths(bands);
    const density = (share, width) => (width > 0 ? share / width : 0);
    const dTop = density(top, widths.top);
    const dMiddle = density(middle, widths.middle);
    const dBottom = density(bottom, widths.bottom);
    const present = share => Math.min(1, share / enough);
    const hollow = (part, than) => (than <= 0 ? (part <= 0 ? 1 : 0) : Math.max(0, Math.min(1, 1 - part / than)));
    const scores = {
      polarized: present(top) * present(bottom) * hollow(dMiddle, Math.min(dTop, dBottom)),
      linear: present(top) * hollow(dBottom, dMiddle) * contiguity,
      condensed: middle > 0 ? hollow(Math.max(dTop, dBottom), dMiddle) : 0
    };
    const best = Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a));
    return {
      ...scores,
      dominant: best[1] > 0 && best[1] >= minDominant ? best[0] : null,
      contiguity,
      top,
      middle,
      bottom,
      density: { top: dTop, middle: dMiddle, bottom: dBottom }
    };
  }

  // Equity width of the top band, the bands between, and the bottom band
  _bandWidths(bands) {
    const topMin = bands[0].min;
    const bottomMax = bands.length > 1 ? bands[bands.length - 2].min : 0;
    return { top: 1 - topMin, middle: Math.max(0, topMin - bottomMax), bottom: bottomMax };
  }

  /** Equity bucket shares for both sides: { bands, hero, villain }, each { combos, equity, buckets, shape }. */
  async buckets() {
    const { bands, board, deadCards, parentHands, parentWeights, shapeEnough, minDominant, topEnd, villainHands, villainWeights } = this._requireMatchup();
    const villainEquity = await this._villainEquityByHand();
    const hero = this._sideSummary(this._requireStoredEquity(), this.filteredHands, bands, parentHands, shapeEnough, minDominant, this.handWeights, parentWeights);
    const villain = this._sideSummary(villainEquity, villainHands, bands, null, shapeEnough, minDominant, villainWeights);
    await this._loadEvaluator();
    hero.capped = this._cappedFor(this.filteredHands, villainHands, board, deadCards, topEnd, this.handWeights, villainWeights);
    villain.capped = this._cappedFor(villainHands, this.filteredHands, board, deadCards, topEnd, villainWeights, this.handWeights);
    const { nutsMinEquity } = this.matchup;
    hero.nuts = this._nutsByEquity(this.handEquity, this.filteredHands, nutsMinEquity, this.handWeights);
    villain.nuts = this._nutsByEquity(villainEquity, villainHands, nutsMinEquity, villainWeights);
    return { bands, hero, villain };
  }

  // Effective nuts: hands with at least minEquity (default 90%) equity against the other range
  _nutsByEquity(equityByHand, hands, minEquity, weights = {}) {
    const live = hands.filter(hand => equityByHand[hand] && equityByHand[hand].equity !== null);
    if (live.length === 0) return { count: 0, weight: 0, share: null };
    const weightOf = hand => weights[hand] ?? 1;
    const nuts = live.filter(hand => equityByHand[hand].equity >= minEquity);
    const weight = nuts.reduce((sum, hand) => sum + weightOf(hand), 0);
    const total = live.reduce((sum, hand) => sum + weightOf(hand), 0);
    return { count: nuts.length, weight, share: weight / total };
  }

  /**
   * How much of the top end a range is missing, 0 (uncapped) to 1 (capped), from made hands on the board:
   * - relative: the top end is the strongest `topEnd` share (default 5%) of the combos in both ranges;
   *   1 - min(1, the range's share of that top end / its share of all their combos)
   * - absolute: the top end is the strongest `topEnd` share of every combo that can be dealt on the board;
   *   1 - min(1, the share of the range in that top end / the share of all combos in it)
   * Ties at the cut-off count as top end. null preflop (no board to rank on) or with no live combos.
   */
  _cappedFor(hands, otherHands, board, deadCards, topEnd, weights = {}, otherWeights = {}) {
    return this._topEndFor(hands, otherHands, board, deadCards, topEnd, weights, otherWeights).capped;
  }

  // Capping from the made-hand top end, by weight; null preflop
  _topEndFor(hands, otherHands, board, deadCards, topEnd, weights = {}, otherWeights = {}) {
    const none = { capped: { relative: null, absolute: null } };
    if (board.length < 3) return none;
    const blocked = new Set([...board, ...deadCards]);
    const live = list => list.filter(hand => !this._extractCardsFromHand(hand).some(c => blocked.has(c)));
    const mine = live(hands);
    if (mine.length === 0) return none;
    const rankOf = hand => this._rankSync(hand, board).rank;
    const ratioToCap = ratio => Math.max(0, 1 - ratio);

    // Relative: both ranges' combos, each side counted separately, by weight
    const theirs = live(otherHands);
    const all = [
      ...mine.map(hand => ({ rank: rankOf(hand), mine: true, weight: weights[hand] ?? 1 })),
      ...theirs.map(hand => ({ rank: rankOf(hand), mine: false, weight: otherWeights[hand] ?? 1 }))
    ].sort((a, b) => this._compareRankArrays(b.rank, a.rank));
    const sum = list => list.reduce((total, x) => total + x.weight, 0);
    const allWeight = sum(all);
    let cumulative = 0;
    let relCutoff = all[all.length - 1].rank;
    for (const x of all) {
      cumulative += x.weight;
      if (cumulative >= topEnd * allWeight - 1e-9) { relCutoff = x.rank; break; }
    }
    const relTop = all.filter(x => this._compareRankArrays(x.rank, relCutoff) >= 0);
    const mineWeight = sum(all.filter(x => x.mine));
    const relative = ratioToCap((sum(relTop.filter(x => x.mine)) / sum(relTop)) / (mineWeight / allWeight));

    // Absolute: every combo that can be dealt on this board
    const absKey = `abs-top|${board.join(',')}|${[...deadCards].sort().join(',')}|${topEnd}`;
    let abs = this.evaluationCache.get(absKey);
    if (!abs) {
      const deck = VALID_RANKS.flatMap(r => VALID_SUITS.map(suit => r + suit)).filter(c => !blocked.has(c));
      const ranks = [];
      for (let i = 0; i < deck.length; i++) {
        for (let j = i + 1; j < deck.length; j++) ranks.push(rankOf(this._normalizeHand(deck[i] + deck[j])));
      }
      ranks.sort((a, b) => this._compareRankArrays(b, a));
      const cutoff = ranks[Math.max(1, Math.ceil(topEnd * ranks.length - 1e-9)) - 1];
      const share = ranks.filter(rank => this._compareRankArrays(rank, cutoff) >= 0).length / ranks.length;
      abs = { cutoff, share };
      this.evaluationCache.set(absKey, abs);
    }
    const mineInTop = mine.filter(hand => this._compareRankArrays(rankOf(hand), abs.cutoff) >= 0)
      .reduce((total, hand) => total + (weights[hand] ?? 1), 0) / mineWeight;
    const absolute = ratioToCap(mineInTop / abs.share);
    return { capped: { relative, absolute } };
  }

  /**
   * Splits the range into hand classes on the board, each combo in exactly one, so the shares add up to 1:
   * { total, classes: { set: { count, share, combos }, ..., air } } in Modern Poker Theory's order (made
   * hands first, then flush draws, OESDs, gutshots, then ace-high and king-high, then air). A made hand
   * counts only when it uses a hole card. options: { highCards } (default true; false counts ace-high and
   * king-high as air, as the book's Chapter 1 breakdown does), { street }.
   */
  async handClasses(boardCards, options = {}) {
    const board = this._requireEvaluationBoard(boardCards);
    const street = this._validateStreet(options.street);
    const highCards = options.highCards ?? true;
    await this._loadEvaluator();
    const boardSet = new Set(board);
    const boardKey = board.join(',');
    const boardRanks = [...new Set(board.map(c => c[0]))].sort((a, b) => this._getRankValue(b) - this._getRankValue(a));
    const classes = Object.fromEntries(HAND_CLASSES.map(name => [name, { count: 0, weight: 0, share: 0, combos: [] }]));
    let total = 0;
    let totalWeight = 0;
    for (const hand of this.filteredHands) {
      const cards = this._extractCardsFromHand(hand);
      if (cards.some(c => boardSet.has(c))) continue;
      total++;
      const weight = this._weight(hand);
      totalWeight += weight;
      const [evalObj] = this._getCachedOrEvaluate(hand, board, boardKey, true, street);
      const entry = classes[this._handClassOf(cards, evalObj, boardRanks, highCards)];
      entry.combos.push(hand);
      entry.weight += weight;
    }
    for (const entry of Object.values(classes)) {
      entry.count = entry.combos.length;
      entry.share = totalWeight ? entry.weight / totalWeight : 0;
    }
    return { total, weight: totalWeight, classes };
  }

  _handClassOf(cards, evalObj, boardRanks, highCards) {
    const made = [...MADE_HANDS].find(flag => evalObj[flag]);
    const usesHole = evalObj.usesHoleCards !== false;
    const [r1, r2] = cards.map(c => c[0]);
    const pocketPair = r1 === r2;
    if (usesHole) {
      if (made === 'isRoyalFlush' || made === 'isStraightFlush') return 'straightFlush';
      if (made === 'isFourOfAKind') return 'quads';
      if (made === 'isFullHouse') return 'fullHouse';
      if (made === 'isFlush') return 'flush';
      if (made === 'isStraight') return 'straight';
      if (made === 'isThreeOfAKind') return pocketPair ? 'set' : 'trips';
      if (made === 'isTwoPair') return 'twoPair';
      if (made === 'isPair') {
        if (pocketPair) {
          const value = this._getRankValue(r1);
          const above = boardRanks.filter(r => this._getRankValue(r) > value).length;
          if (above === 0) return 'overpair';
          if (above === boardRanks.length) return 'underpair';
          return `pocketPair${above}${above + 1}`;
        }
        const paired = [r1, r2].find(r => boardRanks.includes(r));
        const position = boardRanks.indexOf(paired);
        if (position === 0) return 'topPair';
        if (position === boardRanks.length - 1) return 'bottomPair';
        return PAIR_POSITIONS[position];
      }
    }
    if (evalObj.isFlushDraw) return 'flushDraw';
    if (evalObj.isOpenEndedStraightDraw || evalObj.isOpenEndedStraightDrawWheel) return 'oesd';
    if (evalObj.isInsideStraightDraw || evalObj.isInsideStraightDrawWheel) return 'gutshot';
    if (highCards && (r1 === 'A' || r2 === 'A')) return 'aceHigh';
    if (highCards && (r1 === 'K' || r2 === 'K')) return 'kingHigh';
    return 'air';
  }

  /**
   * Range vs range report: both sides' equity, buckets, shape, capping and effective nuts; advantage, each
   * hero minus villain: range (equity, Modern Poker Theory's "range vs range equity advantage"), nut (share of
   * effective nuts, hands with 90%+ equity against the other range: the book's "effective nut hands make up a
   * larger portion of his range"), polarization
   * (shape.polarized), and the share of each equity band and hand class (positive = hero has more of it);
   * hand classes side by side, exclusive (handClasses, adding up to 1) and overlapping flags (flags), flop,
   * turn or river only; capped (relative and absolute) per side; and the book's flop averages as a reference
   * when the default bands are used.
   */
  async compare() {
    const matchup = this._requireMatchup();
    const { bands, board } = matchup;
    const { hero, villain } = await this.buckets();
    const report = {
      board,
      bands,
      hero,
      villain,
      advantage: {
        range: hero.equity !== null && villain.equity !== null ? hero.equity - villain.equity : null,
        nut: hero.nuts.share !== null && villain.nuts.share !== null ? hero.nuts.share - villain.nuts.share : null,
        polarization: hero.shape && villain.shape ? hero.shape.polarized - villain.shape.polarized : null,
        bands: Object.fromEntries(bands.map(band => [band.name, hero.buckets[band.name].share - villain.buckets[band.name].share])),
        classes: null
      },
      handClasses: null,
      flags: null,
      reference: bands === BAND_PRESETS.acevedo ? ACEVEDO_FLOP_AVERAGES : null
    };
    if (board.length >= 3) {
      const heroExclusive = await this.handClasses(board);
      const villainExclusive = await this._villainRange().handClasses(board);
      report.handClasses = Object.fromEntries(HAND_CLASSES.map(name => [name, {
        hero: heroExclusive.classes[name].share,
        villain: villainExclusive.classes[name].share,
        heroCount: heroExclusive.classes[name].count,
        villainCount: villainExclusive.classes[name].count
      }]));
      report.advantage.classes = Object.fromEntries(HAND_CLASSES.map(name => [
        name, heroExclusive.classes[name].share - villainExclusive.classes[name].share
      ]));
      const heroClasses = await this.breakdown(board);
      const villainClasses = await this._villainRange().breakdown(board);
      const flags = new Set([...Object.keys(heroClasses.flags), ...Object.keys(villainClasses.flags)]);
      const rows = [...flags].map(flag => [flag, {
        hero: heroClasses.flags[flag]?.share ?? 0,
        villain: villainClasses.flags[flag]?.share ?? 0,
        heroCount: heroClasses.flags[flag]?.count ?? 0,
        villainCount: villainClasses.flags[flag]?.count ?? 0
      }]);
      rows.sort((a, b) => Math.max(b[1].hero, b[1].villain) - Math.max(a[1].hero, a[1].villain));
      report.flags = Object.fromEntries(rows);
    }
    return report;
  }

  _villainRange() {
    const { villainHands, villainWeights, deadCards } = this._requireMatchup();
    return new RangeManager(villainHands.map(hand => [hand, villainWeights[hand] ?? 1]), deadCards);
  }

  // Area between two weighted equity CDFs on [0, 1]: 0 for identical distributions, up to 1. Each input is a
  // list of equities or of [equity, weight] pairs.
  _earthMoversDistance(a, b) {
    if (a.length === 0 || b.length === 0) return null;
    const pairs = list => list.map(x => (Array.isArray(x) ? x : [x, 1])).sort((x, y) => x[0] - y[0]);
    const xs = pairs(a);
    const ys = pairs(b);
    const totalX = xs.reduce((sum, x) => sum + x[1], 0);
    const totalY = ys.reduce((sum, y) => sum + y[1], 0);
    const points = [...new Set([...xs, ...ys].map(p => p[0]))].sort((x, y) => x - y);
    let i = 0; let j = 0; let cx = 0; let cy = 0; let area = 0;
    for (let k = 0; k < points.length - 1; k++) {
      while (i < xs.length && xs[i][0] <= points[k]) cx += xs[i++][1];
      while (j < ys.length && ys[j][0] <= points[k]) cy += ys[j++][1];
      area += Math.abs(cx / totalX - cy / totalY) * (points[k + 1] - points[k]);
    }
    return area;
  }

  /**
   * Compares this range with a reference range (notation, hands or a RangeManager): combos in common,
   * missing (in the reference only) and extra (in this range only), and overlap (common / union). After
   * against(), also both ranges' equity, buckets and shape against the same villain and board, and the
   * earth mover's distance between their equity distributions (0 = identical shape).
   */
  async compareTo(reference) {
    const referenceRange = reference instanceof RangeManager ? reference : new RangeManager(reference);
    const mine = new Set(this.filteredHands);
    const theirs = new Set(referenceRange.toArray());
    const common = this.filteredHands.filter(hand => theirs.has(hand));
    const missing = referenceRange.toArray().filter(hand => !mine.has(hand));
    const extra = this.filteredHands.filter(hand => !theirs.has(hand));
    // Overlap by weight: sum of the smaller weights over sum of the larger (1 = the same weighted range)
    const weightIn = (range, hand) => (range.contains(hand) ? range._weight(hand) : 0);
    const everyHand = [...new Set([...this.filteredHands, ...referenceRange.filteredHands])];
    const shared = everyHand.reduce((sum, hand) => sum + Math.min(weightIn(this, hand), weightIn(referenceRange, hand)), 0);
    const union = everyHand.reduce((sum, hand) => sum + Math.max(weightIn(this, hand), weightIn(referenceRange, hand)), 0);
    const notation = hands => (hands.length ? new RangeManager(hands).toNotation() : '');
    const report = {
      combos: { range: mine.size, reference: theirs.size },
      common, missing, extra,
      notation: { common: notation(common), missing: notation(missing), extra: notation(extra) },
      overlap: union ? shared / union : 1,
      equity: null, buckets: null, distance: null
    };
    if (!this.matchup) return report;
    const { villainHands, villainWeights, board, deadCards, iterations, bands, parentHands, parentWeights, shapeEnough, minDominant, topEnd } = this.matchup;
    const villainInput = villainHands.length ? villainHands.map(hand => [hand, villainWeights[hand] ?? 1]) : villainHands;
    const referenceWithEquity = await referenceRange.against(villainInput, board, {
      deadCards, iterations, bands, shape: { enough: shapeEnough, minDominant, topEnd }
    });
    const rangeSummary = this._sideSummary(this._requireStoredEquity(), this.filteredHands, bands, parentHands, shapeEnough, minDominant, this.handWeights, parentWeights);
    const referenceSummary = this._sideSummary(
      referenceWithEquity.handEquity, referenceWithEquity.filteredHands, bands, null, shapeEnough, minDominant, referenceWithEquity.handWeights
    );
    await this._loadEvaluator();
    rangeSummary.capped = this._cappedFor(this.filteredHands, villainHands, board, deadCards, topEnd, this.handWeights, villainWeights);
    referenceSummary.capped = this._cappedFor(referenceWithEquity.filteredHands, villainHands, board, deadCards, topEnd, referenceWithEquity.handWeights, villainWeights);
    const equities = (byHand, hands, range) => hands.filter(hand => byHand[hand].equity !== null).map(hand => [byHand[hand].equity, range._weight(hand)]);
    report.equity = { range: rangeSummary.equity, reference: referenceSummary.equity };
    report.buckets = { range: rangeSummary, reference: referenceSummary };
    report.distance = this._earthMoversDistance(
      equities(this.handEquity, this.filteredHands, this),
      equities(referenceWithEquity.handEquity, referenceWithEquity.filteredHands, referenceWithEquity)
    );
    return report;
  }

  _parseBet({ pot, bet } = {}) {
    for (const [name, value] of [['pot', pot], ['bet', bet]]) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
    }
    return { pot, bet };
  }

  /**
   * Bet-size math for a bet into a pot (Modern Poker Theory Ch. 2): alpha = bet / (pot + bet), how often a
   * bluff must work; mdf = 1 - alpha; potOdds = bet / (pot + 2 bet), the equity a call needs (also the
   * bluff share of a balanced river betting range); valueToBluff = (pot + bet) / bet value combos per bluff.
   * On earlier streets MDF is only a rough guide: the book shows real defence well below it.
   */
  bettingMath(options) {
    const { pot, bet } = this._parseBet(options);
    const potOdds = bet / (pot + 2 * bet);
    return { alpha: bet / (pot + bet), mdf: pot / (pot + bet), potOdds, bluffShare: potOdds, valueToBluff: (pot + bet) / bet };
  }

  /**
   * As the defender facing villain's bet (villain = the betting range given to against()): the hands to
   * continue with. by: 'equity' (default) keeps hands whose equity x realization is at least the pot odds;
   * 'mdf' keeps the strongest MDF share of the range by equity (ties kept). Hands that cannot be dealt are
   * dropped. realization (default 1) scales equity for how much of it the hand realizes: Modern Poker Theory
   * gives about 0.9 out of position and 1.1 in position for symmetric ranges (it needs a solver to know).
   */
  defend(options = {}) {
    const { pot, bet } = this._parseBet(options);
    const by = options.by ?? 'equity';
    if (by !== 'equity' && by !== 'mdf') throw new Error(`Unknown defend method: ${by}. Use 'equity' or 'mdf'`);
    const realization = options.realization ?? 1;
    if (typeof realization !== 'number' || !Number.isFinite(realization) || realization <= 0) {
      throw new Error('realization must be a positive number');
    }
    const handEquity = this._requireStoredEquity();
    this._requireMatchup();
    const { potOdds, mdf } = this.bettingMath({ pot, bet });
    const live = this.filteredHands.filter(hand => handEquity[hand].equity !== null);
    if (by === 'equity') {
      return this._createFilteredInstance(live.filter(hand => handEquity[hand].equity * realization >= potOdds));
    }
    // By weight: the strongest hands holding the MDF share of the range's weight (ties kept)
    const ranked = [...live].sort((a, b) => handEquity[b].equity - handEquity[a].equity);
    const target = mdf * ranked.reduce((sum, hand) => sum + this._weight(hand), 0);
    if (ranked.length === 0 || target <= 1e-12) return this._createFilteredInstance([]);
    let cumulative = 0;
    let cutoff = handEquity[ranked[ranked.length - 1]].equity;
    for (const hand of ranked) {
      cumulative += this._weight(hand);
      if (cumulative >= target - 1e-9) { cutoff = handEquity[hand].equity; break; }
    }
    return this._createFilteredInstance(live.filter(hand => handEquity[hand].equity >= cutoff));
  }

  /**
   * As the bettor: bluffs to pair with the value hands (bands in options.value, default the top band) at this
   * bet size. Count = value combos x alpha, so bluffs are bet / (pot + 2 bet) of the betting range. Picks the
   * lowest-band hands first, preferring those that block more of villain's continuing range (villain hands
   * with at least the pot odds against this range), then lower equity.
   */
  async bluffCandidates(options = {}) {
    const { pot, bet } = this._parseBet(options);
    const { bands } = this._requireMatchup();
    const handEquity = this._requireStoredEquity();
    const valueBands = new Set([options.value ?? bands[0].name].flat());
    const unknown = [...valueBands].filter(name => !bands.some(b => b.name === name));
    if (unknown.length > 0) throw new Error(`Unknown band: ${unknown.join(', ')}`);
    const { alpha, potOdds } = this.bettingMath({ pot, bet });
    const live = this.filteredHands.filter(hand => handEquity[hand].equity !== null);
    const bandIndex = hand => bands.findIndex(b => b.name === this._bandOf(handEquity[hand].equity, bands));
    const value = live.filter(hand => valueBands.has(bands[bandIndex(hand)].name));
    // By weight: bluffs worth value weight x alpha (with weight 1, value combos x alpha, rounded)
    const target = value.reduce((sum, hand) => sum + this._weight(hand), 0) * alpha;
    if (target < 0.5) return this._createFilteredInstance([]);
    const villainEquity = await this._villainEquityByHand();
    const { villainWeights } = this.matchup;
    const continuing = this.matchup.villainHands.filter(hand => villainEquity[hand].equity !== null && villainEquity[hand].equity >= potOdds);
    const blocks = hand => {
      const cards = this._extractCardsFromHand(hand);
      return continuing.filter(v => cards.some(c => v.includes(c))).reduce((sum, v) => sum + (villainWeights[v] ?? 1), 0);
    };
    const candidates = live
      .filter(hand => !valueBands.has(bands[bandIndex(hand)].name))
      .map(hand => ({ hand, band: bandIndex(hand), blocked: blocks(hand), equity: handEquity[hand].equity }))
      .sort((a, b) => b.band - a.band || b.blocked - a.blocked || a.equity - b.equity);
    const chosen = new Set();
    let taken = 0;
    for (const candidate of candidates) {
      if (taken >= Math.round(target) - 1e-9 && this.isWeighted() === false) break;
      if (this.isWeighted() && taken >= target - 1e-9) break;
      chosen.add(candidate.hand);
      taken += this._weight(candidate.hand);
    }
    return this._createFilteredInstance(this.filteredHands.filter(hand => chosen.has(hand)));
  }

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  toArray() {
    return [...this.filteredHands];
  }

  getHands() {
    return this.toArray();
  }

  size() {
    return this.filteredHands.length;
  }

  contains(hand) {
    const normalized = this._normalizeHand(hand);
    if (this._handSetSource !== this.filteredHands) {
      this._handSet = new Set(this.filteredHands);
      this._handSetSource = this.filteredHands;
    }
    return this._handSet.has(normalized);
  }

  toString() {
    return this._byWeight(hands => this._groupHandsIntoNotation(hands));
  }

  /** Abbreviated notation; weighted combos get their weight after a colon: 'QQ+,AKs:0.5'. */
  toNotation() {
    return this._byWeight(hands => this._abbreviatedNotation(hands));
  }

  // Applies a notation writer to each group of equal weight, weight 1 first, then heavier weights first. A hand
  // class (AKs, QQ) whose combos in the range have different weights is written as exact combos, so that the
  // output parses back to the same weights.
  _byWeight(write) {
    const roundWeight = hand => Math.round(this._weight(hand) * 10000) / 10000;
    const classWeights = new Map();
    for (const hand of this.filteredHands) {
      const cls = this._categorizeHand(hand).notation;
      if (!classWeights.has(cls)) classWeights.set(cls, new Set());
      classWeights.get(cls).add(roundWeight(hand));
    }
    const groups = new Map();
    for (const hand of this.filteredHands) {
      const weight = roundWeight(hand);
      if (!groups.has(weight)) groups.set(weight, []);
      groups.get(weight).push(hand);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([weight, hands]) => {
        const mixed = hand => classWeights.get(this._categorizeHand(hand).notation).size > 1;
        const parts = [write(hands.filter(hand => !mixed(hand))), ...hands.filter(mixed)].filter(Boolean).join(',');
        if (!parts || weight === 1) return parts;
        return parts.split(',').map(part => `${part}:${weight}`).join(',');
      })
      .filter(Boolean)
      .join(',');
  }

  _abbreviatedNotation(hands) {
    const notation = this._groupHandsIntoNotation(hands);
    if (!notation) return '';
    const parts = notation.split(',');
    return [...this._abbreviatePairs(parts.filter(p => /^([AKQJT2-9])\1$/.test(p))), ...this._abbreviateSuited(parts.filter(p => /^[AKQJT2-9]{2}s$/.test(p))), ...this._abbreviateOffsuit(parts.filter(p => /^[AKQJT2-9]{2}o$/.test(p)))].join(',');
  }

  // ============================================================================
  // INTERNAL HELPER METHODS
  // ============================================================================

  _deduplicateHands(hands) {
    return [...new Set(hands)];
  }

  _categorizeHand(hand) {
    const [c1, c2] = this._extractCardsFromHand(hand);
    const [high, low] = this._normalizeCardOrder(c1, c2);
    if (high[0] === low[0]) return { type: 'pair', notation: high[0] + low[0] };
    if (high[1] === low[1]) return { type: 'suited', notation: high[0] + low[0] + 's' };
    return { type: 'offsuit', notation: high[0] + low[0] + 'o' };
  }

  _buildNotationParts(categories) {
    const parts = [];
    if (categories.pairs.length > 0) parts.push([...new Set(categories.pairs)].join(','));
    if (categories.suited.length > 0) parts.push([...new Set(categories.suited)].join(','));
    if (categories.offsuit.length > 0) parts.push([...new Set(categories.offsuit)].join(','));
    return parts.join(',');
  }

  _groupHandsIntoNotation(hands) {
    if (hands.length === 0) return '';
    const categories = { pairs: [], suited: [], offsuit: [] };
    hands.forEach(hand => {
      const cat = this._categorizeHand(hand);
      categories[cat.type === 'pair' ? 'pairs' : cat.type === 'suited' ? 'suited' : 'offsuit'].push(cat.notation);
    });
    return this._buildNotationParts(categories);
  }

  _findConsecutiveSequences(ranks) {
    if (ranks.length === 0) return [];
    const sorted = [...new Set(ranks)].sort((a, b) => this._getRankValue(a) - this._getRankValue(b));
    const sequences = [];
    let start = sorted[0], end = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (this._getRankValue(sorted[i]) === this._getRankValue(end) + 1) end = sorted[i];
      else { sequences.push({ start, end }); start = end = sorted[i]; }
    }
    return [...sequences, { start, end }];
  }

  _processPairSequence(seq) {
    // seq.start is the lowest rank and seq.end the highest (sequences are consecutive)
    if (seq.start === seq.end) return seq.start + seq.start;
    if (seq.end === 'A') return seq.start + seq.start + '+';
    return seq.end + seq.end + '-' + seq.start + seq.start;
  }

  _abbreviatePairs(pairs) {
    if (pairs.length === 0) return [];
    const ranks = [...new Set(pairs)].map(p => p[0]);
    const sequences = this._findConsecutiveSequences(ranks);
    return sequences.map(seq => this._processPairSequence(seq)).sort((a, b) => this._getRankValue(b[0]) - this._getRankValue(a[0]));
  }

  _groupByFirstRank(notations) {
    const groups = {};
    notations.forEach(not => {
      if (!groups[not[0]]) groups[not[0]] = [];
      groups[not[0]].push(not);
    });
    return groups;
  }

  _processSequence(seq, firstRank, suffix) {
    if (seq.start === seq.end) return [firstRank + seq.start + suffix];
    // '+' means the second rank runs up to one rank below the first rank
    if (seq.end === this._getRankBelow(firstRank)) return [firstRank + seq.start + suffix + '+'];
    return [firstRank + seq.start + suffix + '-' + firstRank + seq.end + suffix];
  }

  _processGroup(group, suffix) {
    const secondRanks = [...new Set(group)].map(h => h[1]);
    const sequences = this._findConsecutiveSequences(secondRanks);
    const firstRank = group[0][0];
    return sequences.flatMap(seq => this._processSequence(seq, firstRank, suffix));
  }

  _abbreviateGroup(groups, suffix) {
    const result = [];
    Object.values(groups).forEach(group => result.push(...this._processGroup(group, suffix)));
    return result;
  }

  _abbreviateSuited(suited) {
    if (suited.length === 0) return [];
    return this._abbreviateGroup(this._groupByFirstRank(suited), 's');
  }

  _abbreviateOffsuit(offsuit) {
    if (offsuit.length === 0) return [];
    return this._abbreviateGroup(this._groupByFirstRank(offsuit), 'o');
  }
}


// ============================================================================
// CHAINABLE ASYNC FILTERS
// ============================================================================

// Async methods that return a range. They return a RangeQuery, so further filters can be chained
// before a single await: await rm.makesHand(['Pair'], board).getEquity('QQ+', board).equityAbove('60%')
const ASYNC_RANGE_METHODS = [
  'makesHand', 'hitsHand', 'hitsHandBoth', 'getEquity', 'against', 'strongest', 'weakest', 'bluffCandidates'
];

// Methods that return a range synchronously; on a RangeQuery they queue another step
// (the equity filters are synchronous after getEquity, or return a RangeQuery given a villain)
const SYNC_RANGE_METHODS = [
  'exclude', 'include', 'intersect', 'hasSuit', 'suitedOf', 'setDeadCards', 'hasKicker', 'hasKeyCard', 'scale', 'setWeight',
  'equityAbove', 'equityBelow', 'equityBetween', 'bucket', 'defend'
];

// Methods that return a value; on a RangeQuery they return a Promise of that value.
// toString is left out: string conversion calls it, and a Promise there would throw.
const VALUE_METHODS = [
  'toArray', 'getHands', 'size', 'contains', 'toNotation', 'getKeyCards', 'normalizeNotation',
  'weights', 'weightOf', 'weightedSize', 'isWeighted',
  'handContainsDeadCard', 'handHasSuit', 'handSuitedOf',
  'evaluateHand', 'getObject', 'equity', 'equityByHand', 'rankHands', 'breakdown', 'blockers',
  'bandsByHand', 'buckets', 'compare', 'compareTo', 'bettingMath', 'handClasses'
];

/**
 * A pending range from an async filter. Awaiting it (or calling then/catch/finally) gives the
 * RangeManager. Calling a range method on it chains another filter and returns a new RangeQuery;
 * calling a value method returns a Promise of the value. Errors from any step reject the whole chain.
 */
export class RangeQuery {
  #promise;

  constructor(promise) {
    this.#promise = Promise.resolve(promise);
  }

  then(onFulfilled, onRejected) {
    return this.#promise.then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.#promise.catch(onRejected);
  }

  finally(onFinally) {
    return this.#promise.finally(onFinally);
  }

  get [Symbol.toStringTag]() {
    return 'RangeQuery';
  }
}

for (const name of ASYNC_RANGE_METHODS) {
  const run = RangeManager.prototype[name];
  RangeManager.prototype[name] = function (...args) {
    // Called inside then() so a validation error rejects the query instead of throwing synchronously
    return new RangeQuery(Promise.resolve().then(() => run.apply(this, args)));
  };
}

for (const name of [...ASYNC_RANGE_METHODS, ...SYNC_RANGE_METHODS]) {
  RangeQuery.prototype[name] = function (...args) {
    return new RangeQuery(this.then(range => range[name](...args)));
  };
}

for (const name of VALUE_METHODS) {
  RangeQuery.prototype[name] = function (...args) {
    return this.then(range => range[name](...args));
  };
}
