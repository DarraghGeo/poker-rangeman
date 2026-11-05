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
    if (!Array.isArray(input) && typeof input !== 'string') {
      throw new Error('Input must be a string or array');
    }
    this.deadCards = this._validateAndExpandDeadCards(deadCards || []);

    const parsed = this._parse(input);
    this.hands = parsed;
    this.filteredHands = this._filterDeadCards(parsed);
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
    if (trimmed.includes(',')) {
      return trimmed.split(',').map(s => this._normalizeSegment(s)).join(',');
    }
    return this._normalizeSegment(trimmed);
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

  _parseString(notation) {
    const normalized = this.normalizeNotation(notation);
    const segments = normalized.split(',').map(s => s.trim()).filter(s => s);
    const hands = [];
    segments.forEach(segment => {
      hands.push(...this._parseSegment(segment));
    });
    return this._deduplicateHands(hands);
  }

  _parseArray(input) {
    if (!Array.isArray(input)) throw new Error('Input must be an array');
    if (input.length === 0) throw new Error('Array cannot be empty');
    const hands = [];
    input.forEach(hand => {
      if (!this._isValidHand(hand)) throw new Error(`Invalid hand in array: ${hand}`);
      hands.push(this._normalizeHand(hand));
    });
    return this._deduplicateHands(hands);
  }

  _parse(input) {
    if (typeof input === 'string') return this._parseString(input);
    if (Array.isArray(input)) return this._parseArray(input);
    throw new Error('Input must be a string or array');
  }

  // ============================================================================
  // INTERNAL HELPER METHODS (INSTANCE CREATION & NORMALIZATION)
  // ============================================================================

  _createFilteredInstance(filteredHands) {
    const newInstance = Object.create(Object.getPrototypeOf(this));
    Object.assign(newInstance, this);
    newInstance.filteredHands = this._filterDeadCards(filteredHands);
    // evaluationCache is shared by reference: entries are deterministic per (hand, board, strict),
    // so derived instances can safely reuse and extend each other's evaluations
    return newInstance;
  }

  _normalizeInputToHands(input) {
    if (typeof input === 'string' || Array.isArray(input)) return this._parse(input);
    throw new Error('Input must be a string (range notation) or array of hands');
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

  exclude(input) {
    if (Array.isArray(input) && (input.length === 0 || this._isValidCard(input[0]))) {
      return this._createFilteredInstance(this._withoutCards(this.filteredHands, input));
    }
    const excludeHands = this._normalizeInputToHands(input);
    const excludeSet = new Set(excludeHands);
    const filtered = this.filteredHands.filter(hand => !excludeSet.has(hand));
    return this._createFilteredInstance(filtered);
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

  include(input) {
    const includeHands = this._normalizeInputToHands(input);
    const combined = [...this.filteredHands, ...includeHands];
    return this._createFilteredInstance(this._deduplicateHands(combined));
  }

  intersect(input) {
    const intersectHands = this._normalizeInputToHands(input);
    const intersectSet = new Set(intersectHands);
    const filtered = this.filteredHands.filter(hand => intersectSet.has(hand));
    return this._createFilteredInstance(filtered);
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

  // Villain as range notation, an array of hands or cards, or another RangeManager (its current hands)
  _resolveVillain(villain) {
    if (villain instanceof RangeManager) return villain.toArray();
    if (Array.isArray(villain) && villain.length === 2 && villain.every(c => this._isValidConcreteCard(c))) {
      return [this._normalizeHand(villain.join(''))];
    }
    if (typeof villain === 'string' || Array.isArray(villain)) return this._parse(villain);
    throw new Error('Villain must be range notation, an array of hands, or a RangeManager');
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
    const villainHands = this._resolveVillain(villain);
    const extraDead = options.deadCards ? this._validateAndExpandDeadCards(options.deadCards) : [];
    const deadCards = [...new Set([...this.deadCards, ...extraDead])];
    const iterations = options.iterations ?? 10000;
    if (!Number.isInteger(iterations) || iterations < 1) throw new Error('iterations must be a positive integer');
    const key = `${[...villainHands].sort().join(',')}|${board.join(',')}|${[...deadCards].sort().join(',')}|${iterations}`;
    return { board, villainHands, deadCards, iterations, key };
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
        for (const key of ['win', 'tie', 'lose']) totals[key] += handEquity[hand][key];
      }
      const total = totals.win + totals.tie + totals.lose;
      return { ...totals, equity: total ? (totals.win + totals.tie / 2) / total : null };
    }
    const { board, villainHands, deadCards, iterations } = this._prepareEquity(villain, boardCards, options);
    if (this.filteredHands.length === 0 || villainHands.length === 0) return { win: 0, tie: 0, lose: 0, equity: null };
    return this._computeEquity(this.filteredHands, villainHands, board, deadCards, iterations);
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

  async _handEquity(hand, { board, villainHands, deadCards, iterations, key }) {
    const cacheKey = `${hand}|${key}`;
    if (!this.equityCache.has(cacheKey)) {
      const handCards = this._extractCardsFromHand(hand);
      const blocked = handCards.some(c => board.includes(c) || deadCards.includes(c));
      const result = blocked || villainHands.length === 0
        ? { win: 0, tie: 0, lose: 0, equity: null }
        : await this._computeEquity([hand], villainHands, board, deadCards, iterations);
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
      board: prepared.board,
      deadCards: prepared.deadCards,
      iterations: prepared.iterations,
      key: prepared.key,
      bands
    };
    return instance;
  }

  /**
   * Sets villain's range and the board for range vs range analysis: runs hero's equity once (as getEquity)
   * and stores the matchup, so buckets, bucket filters, compare(), compareTo(), defend() and
   * bluffCandidates() work without repeating villain and board. options: { bands, deadCards, iterations }.
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
      const cacheKey = `rank|${hand}|${board.join(',')}|street:${street ?? 'auto'}`;
      let result = this.evaluationCache.get(cacheKey);
      if (!result) {
        const flat = extval.evaluate([...handCards, ...board], { holeCards: handCards, street });
        result = { hand, category: flat.category, strength: flat.strength, rank: flat.rank };
        this.evaluationCache.set(cacheKey, result);
      }
      ranked.push(result);
    }
    return ranked.sort((a, b) => this._compareRankArrays(b.rank, a.rank));
  }

  // The given share of hands from one end of the ranking; hands tied with the last one taken are kept too
  async _takeByStrength(portion, boardCards, options, fromTop) {
    const share = this._parseShare(portion, 'Portion');
    const ranked = await this.rankHands(boardCards, options);
    if (fromTop === false) ranked.reverse();
    const count = Math.ceil(share * ranked.length - 1e-9);
    if (count === 0) return this._createFilteredInstance([]);
    const cutoff = ranked[count - 1].rank;
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
    for (const hand of this.filteredHands) {
      if (this._extractCardsFromHand(hand).some(c => boardSet.has(c))) continue;
      total++;
      const [evalObj] = this._getCachedOrEvaluate(hand, board, boardKey, true, street);
      for (const [flag, value] of Object.entries(evalObj)) {
        if (value !== true || !flag.startsWith('is')) continue;
        if (!combosByFlag.has(flag)) combosByFlag.set(flag, []);
        combosByFlag.get(flag).push(hand);
      }
    }
    const flags = {};
    [...combosByFlag.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([flag, combos]) => { flags[flag] = { count: combos.length, share: combos.length / total, combos }; });
    return { total, flags };
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
    const cacheKey = `villain|${key}|${[...heroHands].sort().join(',')}`;
    if (!this.equityCache.has(cacheKey)) {
      const results = {};
      for (const hand of villainHands) {
        const cards = this._extractCardsFromHand(hand);
        const blocked = cards.some(c => board.includes(c) || deadCards.includes(c));
        results[hand] = blocked || heroHands.length === 0
          ? { win: 0, tie: 0, lose: 0, equity: null }
          : await this._computeEquity([hand], heroHands, board, deadCards, iterations);
      }
      this.equityCache.set(cacheKey, results);
    }
    return this.equityCache.get(cacheKey);
  }

  // { combos, equity, buckets: { name: { count, share, combos } }, shape } for one side
  _sideSummary(equityByHand, hands, bands) {
    const live = hands.filter(hand => equityByHand[hand] && equityByHand[hand].equity !== null);
    const totals = { win: 0, tie: 0, lose: 0 };
    const buckets = Object.fromEntries(bands.map(band => [band.name, { count: 0, share: 0, combos: [] }]));
    for (const hand of live) {
      const result = equityByHand[hand];
      totals.win += result.win; totals.tie += result.tie; totals.lose += result.lose;
      buckets[this._bandOf(result.equity, bands)].combos.push(hand);
    }
    for (const bucket of Object.values(buckets)) {
      bucket.count = bucket.combos.length;
      bucket.share = live.length ? bucket.count / live.length : 0;
    }
    const runouts = totals.win + totals.tie + totals.lose;
    const summary = {
      combos: live.length,
      equity: runouts ? (totals.win + totals.tie / 2) / runouts : null,
      buckets
    };
    summary.shape = this._shapeOf(summary, bands);
    return summary;
  }

  /**
   * A heuristic label for a range's shape from its bucket shares (top band, bottom band, the middle):
   * - polarized: top >= 10%, bottom >= 20% and the extremes outweigh the middle
   * - linear: top >= 10% and bottom < 10% (strong hands down, few weak ones)
   * - condensed: top < 10% and the middle >= 50%
   * - mixed: none of these
   * capped: top < 5% (few or none of the strongest hands). polarization: extremes minus middle, -1 to 1.
   */
  _shapeOf(summary, bands) {
    const shares = bands.map(band => summary.buckets[band.name].share);
    const top = shares[0];
    const bottom = shares[shares.length - 1];
    const middle = shares.slice(1, -1).reduce((sum, share) => sum + share, 0);
    let label = 'mixed';
    if (top >= 0.1 && bottom >= 0.2 && top + bottom > middle) label = 'polarized';
    else if (top >= 0.1 && bottom < 0.1) label = 'linear';
    else if (top < 0.1 && middle >= 0.5) label = 'condensed';
    return { label, capped: top < 0.05, polarization: top + bottom - middle };
  }

  /** Equity bucket shares for both sides: { bands, hero, villain }, each { combos, equity, buckets, shape }. */
  async buckets() {
    const { bands } = this._requireMatchup();
    const villainEquity = await this._villainEquityByHand();
    return {
      bands,
      hero: this._sideSummary(this._requireStoredEquity(), this.filteredHands, bands),
      villain: this._sideSummary(villainEquity, this.matchup.villainHands, bands)
    };
  }

  /**
   * Range vs range report: both sides' equity, buckets and shape; range advantage (equity difference);
   * nut advantage (difference in top-band share, as Modern Poker Theory measures it with Strong hands);
   * hand classes side by side (flop, turn or river only); and the book's flop averages as a reference
   * when the default bands are used.
   */
  async compare() {
    const matchup = this._requireMatchup();
    const { bands, board } = matchup;
    const { hero, villain } = await this.buckets();
    const topBand = bands[0].name;
    const report = {
      board,
      bands,
      hero,
      villain,
      rangeAdvantage: hero.equity !== null && villain.equity !== null ? hero.equity - villain.equity : null,
      nutAdvantage: hero.buckets[topBand].share - villain.buckets[topBand].share,
      handClasses: null,
      reference: bands === BAND_PRESETS.acevedo ? ACEVEDO_FLOP_AVERAGES : null
    };
    if (board.length >= 3) {
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
      report.handClasses = Object.fromEntries(rows);
    }
    return report;
  }

  _villainRange() {
    const { villainHands, deadCards } = this._requireMatchup();
    return new RangeManager(villainHands, deadCards);
  }

  // Area between two empirical equity CDFs on [0, 1]: 0 for identical distributions, up to 1
  _earthMoversDistance(a, b) {
    if (a.length === 0 || b.length === 0) return null;
    const xs = [...a].sort((x, y) => x - y);
    const ys = [...b].sort((x, y) => x - y);
    const points = [...new Set([...xs, ...ys])].sort((x, y) => x - y);
    let i = 0; let j = 0; let area = 0;
    for (let k = 0; k < points.length - 1; k++) {
      while (i < xs.length && xs[i] <= points[k]) i++;
      while (j < ys.length && ys[j] <= points[k]) j++;
      area += Math.abs(i / xs.length - j / ys.length) * (points[k + 1] - points[k]);
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
    const union = mine.size + theirs.size - common.length;
    const notation = hands => (hands.length ? new RangeManager(hands).toNotation() : '');
    const report = {
      combos: { range: mine.size, reference: theirs.size },
      common, missing, extra,
      notation: { common: notation(common), missing: notation(missing), extra: notation(extra) },
      overlap: union ? common.length / union : 1,
      equity: null, buckets: null, distance: null
    };
    if (!this.matchup) return report;
    const { villainHands, board, deadCards, iterations, bands } = this.matchup;
    const referenceWithEquity = await referenceRange.against(villainHands, board, { deadCards, iterations, bands });
    const rangeSummary = this._sideSummary(this._requireStoredEquity(), this.filteredHands, bands);
    const referenceSummary = this._sideSummary(referenceWithEquity.handEquity, referenceWithEquity.filteredHands, bands);
    const equities = (byHand, hands) => hands.map(hand => byHand[hand].equity).filter(e => e !== null);
    report.equity = { range: rangeSummary.equity, reference: referenceSummary.equity };
    report.buckets = { range: rangeSummary, reference: referenceSummary };
    report.distance = this._earthMoversDistance(
      equities(this.handEquity, this.filteredHands),
      equities(referenceWithEquity.handEquity, referenceWithEquity.filteredHands)
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
    const ranked = [...live].sort((a, b) => handEquity[b].equity - handEquity[a].equity);
    const count = Math.ceil(mdf * ranked.length - 1e-9);
    if (count === 0) return this._createFilteredInstance([]);
    const cutoff = handEquity[ranked[count - 1]].equity;
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
    const count = Math.round(value.length * alpha);
    if (count === 0) return this._createFilteredInstance([]);
    const villainEquity = await this._villainEquityByHand();
    const continuing = this.matchup.villainHands.filter(hand => villainEquity[hand].equity !== null && villainEquity[hand].equity >= potOdds);
    const blocks = hand => {
      const cards = this._extractCardsFromHand(hand);
      return continuing.filter(v => cards.some(c => v.includes(c))).length;
    };
    const candidates = live
      .filter(hand => !valueBands.has(bands[bandIndex(hand)].name))
      .map(hand => ({ hand, band: bandIndex(hand), blocked: blocks(hand), equity: handEquity[hand].equity }))
      .sort((a, b) => b.band - a.band || b.blocked - a.blocked || a.equity - b.equity);
    const chosen = new Set(candidates.slice(0, count).map(c => c.hand));
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
    return this._groupHandsIntoNotation(this.filteredHands);
  }

  toNotation() {
    const notation = this.toString();
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
  'exclude', 'include', 'intersect', 'hasSuit', 'suitedOf', 'setDeadCards', 'hasKicker', 'hasKeyCard',
  'equityAbove', 'equityBelow', 'equityBetween', 'bucket', 'defend'
];

// Methods that return a value; on a RangeQuery they return a Promise of that value.
// toString is left out: string conversion calls it, and a Promise there would throw.
const VALUE_METHODS = [
  'toArray', 'getHands', 'size', 'contains', 'toNotation', 'getKeyCards', 'normalizeNotation',
  'handContainsDeadCard', 'handHasSuit', 'handSuitedOf',
  'evaluateHand', 'getObject', 'equity', 'equityByHand', 'rankHands', 'breakdown', 'blockers',
  'bandsByHand', 'buckets', 'compare', 'compareTo', 'bettingMath'
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
