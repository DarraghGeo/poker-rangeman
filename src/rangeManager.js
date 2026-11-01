const VALID_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const VALID_SUITS = ['s', 'h', 'd', 'c'];
const RANK_VALUES = { A: 14, K: 13, Q: 12, J: 11, T: 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2 };

let evaluateHandCache = null;

const CRITERIA_MAPPING = {
  // Made Hands
  'Pair': 'isPair', 'Two Pair': 'isTwoPair', 'Three of a Kind': 'isThreeOfAKind',
  'Straight': 'isStraight', 'Flush': 'isFlush', 'Full House': 'isFullHouse',
  'Four of a Kind': 'isFourOfAKind', 'Straight Flush': 'isStraightFlush', 'Royal Flush': 'isRoyalFlush',
  'High Card': 'isHighCard',
  // Pair Categorization
  'Top Pair': 'isTopPair', 'Middle Pair': 'isMiddlePair', 'Bottom Pair': 'isBottomPair',
  'Overpair': 'isOverpair', 'Underpair': 'isUnderPair', 'Middling Pair': 'isMiddlingPair',
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
  'Inside Straight Draw Wheel': 'isInsideStraightDrawWheel'
};

// Map lookups avoid matching inherited Object properties (e.g. 'toString')
const CRITERIA_LOOKUP = new Map(Object.entries(CRITERIA_MAPPING));
const VALID_CRITERIA = new Set(Object.values(CRITERIA_MAPPING));
const BOARD_RELATIVE_KEYS = new Set(['isOverpair', 'isUnderPair', 'isMiddlingPair']);

const buildNonPairPatterns = suffix => ({
  plus: new RegExp(`^([AKQJT2-9])([AKQJT2-9])${suffix}\\+$`),
  range: new RegExp(`^([AKQJT2-9])([AKQJT2-9])${suffix}-([AKQJT2-9])([AKQJT2-9])${suffix}$`),
  single: new RegExp(`^([AKQJT2-9])([AKQJT2-9])${suffix}$`)
});
const NON_PAIR_PATTERNS = { s: buildNonPairPatterns('s'), o: buildNonPairPatterns('o') };

export class RangeManager {
  constructor(input, deadCards = []) {
    this.rawInput = input;
    this.hands = [];
    this.filteredHands = [];
    this.lastBoardCards = null;
    this.lastHandStrength = null;
    this.lastStrict = null;
    this.evaluationCache = new Map();

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

  _getBoardRankInfo(boardCards) {
    if (!boardCards || boardCards.length === 0) return null;
    const ranks = [...new Set(boardCards.map(c => c[0].toUpperCase()))];
    const sorted = ranks.sort((a, b) => this._getRankValue(b) - this._getRankValue(a));
    const midIdx = Math.floor(sorted.length / 2);
    return {
      highest: sorted[0],
      middle: sorted[midIdx],
      lowest: sorted[sorted.length - 1],
      ranksOnBoard: new Set(sorted)
    };
  }

  _isPocketPair(handCards) {
    if (!handCards || handCards.length !== 2) return false;
    return handCards[0][0].toUpperCase() === handCards[1][0].toUpperCase();
  }

  _getPocketPairRank(handCards) {
    if (!this._isPocketPair(handCards)) return null;
    return handCards[0][0].toUpperCase();
  }

  _isMiddlingPairVsBoard(pairRank, boardInfo) {
    const aboveLow = this._compareRanks(pairRank, boardInfo.lowest) > 0;
    const belowHigh = this._compareRanks(pairRank, boardInfo.highest) < 0;
    return aboveLow && belowHigh && !boardInfo.ranksOnBoard.has(pairRank);
  }

  _buildBoardRelativePairResult(pairRank, boardInfo) {
    return {
      isOverpair: this._compareRanks(pairRank, boardInfo.highest) > 0,
      isUnderPair: this._compareRanks(pairRank, boardInfo.lowest) < 0,
      isMiddlingPair: this._isMiddlingPairVsBoard(pairRank, boardInfo)
    };
  }

  _getBoardRelativePairType(handCards, boardCards) {
    return this._getBoardRelativePairTypeFromInfo(handCards, this._getBoardRankInfo(boardCards));
  }

  _getBoardRelativePairTypeFromInfo(handCards, boardInfo) {
    if (!boardInfo || !this._isPocketPair(handCards)) return null;
    return this._buildBoardRelativePairResult(this._getPocketPairRank(handCards), boardInfo);
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
    if (!evaluateHandCache) {
      const module = await import('poker-extval');
      evaluateHandCache = module.evaluateHand;
    }
    return evaluateHandCache;
  }

  // Synchronous: callers must `await this._loadEvaluator()` first. Hand and board must not overlap.
  _evaluateSync(hand, boardCards, strict) {
    const handCards = this._extractCardsFromHand(hand);
    const cards = [...handCards, ...boardCards];
    if (cards.length < 5) {
      throw new Error(`Need at least 5 unique cards total (hand + board). Got ${cards.length} unique cards from hand [${handCards.join(', ')}] and board [${boardCards.join(', ')}]`);
    }
    return evaluateHandCache(cards, strict);
  }

  async _evaluateHandWithBoard(hand, boardCards, strict = true) {
    await this._loadEvaluator();
    return this._evaluateSync(hand, boardCards, strict);
  }

  _cacheKey(hand, boardKey, strict) {
    return `${hand}|${boardKey}|strict:${strict}`;
  }

  // Synchronous cached evaluation; boardKey is boardCards.join(',') computed once per call
  _getCachedOrEvaluate(hand, boardCards, boardKey, strict) {
    const cacheKey = this._cacheKey(hand, boardKey, strict);
    let evaluations = this.evaluationCache.get(cacheKey);
    if (!evaluations) {
      evaluations = Object.values(this._evaluateSync(hand, boardCards, strict));
      this.evaluationCache.set(cacheKey, evaluations);
    }
    return evaluations;
  }

  _criterionMatchWithBoardRelative(evalObj, criterion, boardRelative) {
    if (boardRelative && BOARD_RELATIVE_KEYS.has(criterion)) {
      return boardRelative[criterion] === true;
    }
    return evalObj[criterion] === true;
  }

  _evaluationsMatchCriteria(evaluations, normalizedCriteria, boardRelative) {
    return evaluations.some(evalObj =>
      normalizedCriteria.some(c => this._criterionMatchWithBoardRelative(evalObj, c, boardRelative))
    );
  }

  async makesHand(criteria, boardCards = [], strict = true) {
    const { normalizedCriteria, board } = this._validateCriteriaAndBoard(criteria, boardCards);
    await this._loadEvaluator();
    const boardSet = new Set(board);
    const boardKey = board.join(',');
    const boardInfo = this._getBoardRankInfo(board);
    const filtered = this.filteredHands.filter(hand => {
      const handCards = this._extractCardsFromHand(hand);
      if (handCards.some(card => boardSet.has(card))) return false;
      const evaluations = this._getCachedOrEvaluate(hand, board, boardKey, strict);
      const boardRelative = this._getBoardRelativePairTypeFromInfo(handCards, boardInfo);
      return this._evaluationsMatchCriteria(evaluations, normalizedCriteria, boardRelative);
    });
    return this._createEvaluatedInstance(filtered, board, normalizedCriteria, strict);
  }

  async evaluateHand(hand, boardCards, strict = true) {
    const [normalizedHand, board] = this._prepareEvaluationInput(hand, boardCards);
    const evaluation = await this._evaluateHandWithBoard(normalizedHand, board, strict);
    return {
      is: (criteria) => this._filterEvaluation(evaluation, criteria, false),
      isAll: (criteria) => this._filterEvaluation(evaluation, criteria, true)
    };
  }

  async getObject(hand, boardCards, strict = true) {
    const [normalizedHand, board] = this._prepareEvaluationInput(hand, boardCards);
    return await this._evaluateHandWithBoard(normalizedHand, board, strict);
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
    return newInstance;
  }

  _validateCriteriaAndBoard(criteria, boardCards) {
    if (!Array.isArray(criteria)) throw new Error('Criteria must be an array');
    const board = this._normalizeBoardCards(boardCards);
    const invalidCriteria = criteria.filter(c => typeof c !== 'string' || !VALID_CRITERIA.has(this._toCriterionKey(c)));
    if (invalidCriteria.length > 0) throw new Error(`Invalid criteria: ${invalidCriteria.join(', ')}`);
    return { normalizedCriteria: this._normalizeCriteria(criteria), board };
  }

  // Board/criteria/strict state is set only on the returned instance, never on `this`
  _createEvaluatedInstance(filtered, board, normalizedCriteria, strict) {
    const instance = this._createFilteredInstance(filtered);
    instance.lastBoardCards = board;
    instance.lastHandStrength = normalizedCriteria;
    instance.lastStrict = strict;
    return instance;
  }

  async _filterByCombinations(criteria, boardCards, minHandCards, strict = true) {
    const { normalizedCriteria, board } = this._validateCriteriaAndBoard(criteria, boardCards);
    // Fewer than 5 cards in total cannot be evaluated: no hand can hit
    if (board.length + 2 < 5) return this._createEvaluatedInstance([], board, normalizedCriteria, strict);
    await this._loadEvaluator();
    const boardSet = new Set(board);
    const boardKey = board.join(',');
    const boardInfo = this._getBoardRankInfo(board);
    // filteredHands never contain dead cards: _createFilteredInstance and the constructor remove them
    const filtered = this.filteredHands.filter(hand => {
      const handCards = this._extractCardsFromHand(hand);
      if (handCards.some(card => boardSet.has(card))) return false;
      const evaluations = this._getCachedOrEvaluate(hand, board, boardKey, strict);
      const boardRelative = this._getBoardRelativePairTypeFromInfo(handCards, boardInfo);
      return this._evaluationsMatchWithHandCards(evaluations, normalizedCriteria, handCards, minHandCards, boardRelative);
    });
    return this._createEvaluatedInstance(filtered, board, normalizedCriteria, strict);
  }

  async hitsHand(criteria, boardCards, strict = true) {
    return await this._filterByCombinations(criteria, boardCards, 1, strict);
  }

  async hitsHandBoth(criteria, boardCards, strict = true) {
    return await this._filterByCombinations(criteria, boardCards, 2, strict);
  }

  _getCachedOnly(hand, boardCards) {
    if (!boardCards) return null;
    const boardKey = boardCards.join(',');
    // Use the strict mode of the evaluation that produced this instance; fall back to trying both
    if (this.lastStrict !== null && this.lastStrict !== undefined) {
      return this.evaluationCache.get(this._cacheKey(hand, boardKey, this.lastStrict)) || null;
    }
    return this.evaluationCache.get(this._cacheKey(hand, boardKey, true))
      || this.evaluationCache.get(this._cacheKey(hand, boardKey, false)) || null;
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

  _evaluationsMatchWithHandCards(evaluations, criteria, handCards, minHandCards, boardRelative = null) {
    const criterionMatches = (evalObj, c) => this._criterionMatchWithBoardRelative(evalObj, c, boardRelative);
    if (minHandCards === 0) return evaluations.some(evalObj => criteria.some(c => criterionMatches(evalObj, c)));
    const normalizedHandCards = handCards.map(c => c[0].toUpperCase() + (c[1] || '').toLowerCase());
    return evaluations.some(evalObj => this._evalObjMatchesWithHandCards(evalObj, criteria, normalizedHandCards, minHandCards, boardRelative));
  }

  _evalObjMatchesWithHandCards(evalObj, criteria, normalizedHandCards, minHandCards, boardRelative = null) {
    const matchingCriteria = criteria.filter(c => this._criterionMatchWithBoardRelative(evalObj, c, boardRelative));
    if (matchingCriteria.length === 0) return false;
    return matchingCriteria.some(c => {
      if (boardRelative && BOARD_RELATIVE_KEYS.has(c) && boardRelative[c]) return minHandCards <= 2;
      return this._handCardsInKeyCardsForCriterion(normalizedHandCards, evalObj, c) >= minHandCards;
    });
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

