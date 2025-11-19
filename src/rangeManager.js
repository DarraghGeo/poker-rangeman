const VALID_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const VALID_SUITS = ['s', 'h', 'd', 'c'];

let evaluateHandCache = null;

const CRITERIA_MAPPING = {
  // Made Hands
  'Pair': 'isPair', 'Two Pair': 'isTwoPair', 'Three of a Kind': 'isThreeOfAKind',
  'Straight': 'isStraight', 'Flush': 'isFlush', 'Full House': 'isFullHouse',
  'Four of a Kind': 'isFourOfAKind', 'Straight Flush': 'isStraightFlush', 'Royal Flush': 'isRoyalFlush',
  'High Card': 'isHighCard',
  // Pair Categorization
  'Top Pair': 'isTopPair', 'Middle Pair': 'isMiddlePair', 'Bottom Pair': 'isBottomPair',
  'Underpair': 'isUnderPair',
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

export class RangeManager {
  constructor(input, deadCards = []) {
    this.rawInput = input;
    this.deadCards = deadCards || [];
    this.hands = [];
    this.filteredHands = [];
    this.lastBoardCards = null;
    this.lastHandStrength = null;
    this.evaluationCache = new Map();
    
    if (!input) throw new Error('Input is required');
    if (!Array.isArray(input) && typeof input !== 'string') {
      throw new Error('Input must be a string or array');
    }
    
    const parsed = this._parse(input);
    this.hands = parsed;
    this.filteredHands = [...parsed];
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

  _isValidHand(hand) {
    if (!hand || typeof hand !== 'string' || hand.length !== 4) return false;
    const card1 = hand.substring(0, 2);
    const card2 = hand.substring(2, 4);
    if (!this._isValidCard(card1) || !this._isValidCard(card2)) return false;
    return card1 !== card2;
  }

  // ============================================================================
  // NORMALIZATION METHODS
  // ============================================================================

  _normalizeCardOrder(card1, card2) {
    // compareRanks returns 1 if rank1 > rank2, so >= 0 means rank1 >= rank2 (higher or equal rank first)
    if (this._compareRanks(card1[0], card2[0]) >= 0) return [card1, card2];
    return [card2, card1];
  }

  _normalizeHand(hand) {
    if (!this._isValidHand(hand)) throw new Error(`Invalid hand: ${hand}`);
    const card1 = hand.substring(0, 2);
    const card2 = hand.substring(2, 4);
    const normalizedCard1 = card1[0] + card1[1].toLowerCase();
    const normalizedCard2 = card2[0] + card2[1].toLowerCase();
    const [high, low] = this._normalizeCardOrder(normalizedCard1, normalizedCard2);
    if (high[0] === low[0]) {
      const suits = [high[1], low[1]].sort();
      return high[0] + suits[0] + high[0] + suits[1];
    }
    return high + low;
  }

  _normalizeHandSegment(segment) {
    return segment[0] + segment[1].toLowerCase() + segment[2] + segment[3].toLowerCase();
  }

  _normalizeSegment(segment) {
    const trimmed = segment.trim();
    if (trimmed.length === 4 && this._isValidHand(trimmed)) return this._normalizeHandSegment(trimmed);
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
    if (rank === 'A') return 14;
    if (rank === 'K') return 13;
    if (rank === 'Q') return 12;
    if (rank === 'J') return 11;
    if (rank === 'T') return 10;
    return parseInt(rank, 10);
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

  _extractSuitedPlus(range) {
      const match = range.match(/^([AKQJT2-9])([AKQJT2-9])s\+$/);
    return match ? { rank1: match[1], rank2: match[2], isPlus: true } : null;
    }

  _extractSuitedRange(range) {
      const match = range.match(/^([AKQJT2-9])([AKQJT2-9])s-([AKQJT2-9])([AKQJT2-9])s$/);
    return match ? { rank1: match[1], rank2: match[2], endRank1: match[3], endRank2: match[4] } : null;
    }

  _extractSuitedSingle(range) {
    const match = range.match(/^([AKQJT2-9])([AKQJT2-9])s$/);
    return match ? { rank1: match[1], rank2: match[2], isPlus: false } : null;
  }

  _extractSuitedRanks(range) {
    if (!range) return null;
    if (range.endsWith('+')) return this._extractSuitedPlus(range);
    if (range.includes('-')) return this._extractSuitedRange(range);
    return this._extractSuitedSingle(range);
  }

  _extractOffsuitPlus(range) {
      const match = range.match(/^([AKQJT2-9])([AKQJT2-9])o\+$/);
    return match ? { rank1: match[1], rank2: match[2], isPlus: true } : null;
    }

  _extractOffsuitRange(range) {
      const match = range.match(/^([AKQJT2-9])([AKQJT2-9])o-([AKQJT2-9])([AKQJT2-9])o$/);
    return match ? { rank1: match[1], rank2: match[2], endRank1: match[3], endRank2: match[4] } : null;
    }

  _extractOffsuitSingle(range) {
    const match = range.match(/^([AKQJT2-9])([AKQJT2-9])o$/);
    return match ? { rank1: match[1], rank2: match[2], isPlus: false } : null;
  }

  _extractOffsuitRanks(range) {
    if (!range) return null;
    if (range.endsWith('+')) return this._extractOffsuitPlus(range);
    if (range.includes('-')) return this._extractOffsuitRange(range);
    return this._extractOffsuitSingle(range);
  }

  _extractCard1Wildcard(card1, result) {
    if (card1[1].toLowerCase() === 'x') {
      result.card1SuitWildcard = true;
      result.card1ExcludeSuit = 's';
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
    const card1 = hand.substring(0, 2);
    const card2 = hand.substring(2, 4);
    const result = { card1Rank: card1[0] };
    this._extractCard1Wildcard(card1, result);
    this._extractCard2Wildcard(card2, card1, result);
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

  _generateSuitedCombination(rank1, suit1, rank2, suit2) {
    const s1 = suit1.toLowerCase();
    const s2 = suit2.toLowerCase();
    if (s1 !== s2) throw new Error('Suits must match for suited combination');
    return this._normalizeHand(rank1 + s1 + rank2 + s2);
  }

  _generateOffsuitCombination(rank1, suit1, rank2, suit2) {
    const s1 = suit1.toLowerCase();
    const s2 = suit2.toLowerCase();
    if (s1 === s2) throw new Error('Suits must differ for offsuit combination');
    return this._normalizeHand(rank1 + s1 + rank2 + s2);
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
    return this._generateWildcardCombinations(hand);
  }

  _parsePairRange(range) {
    const [start, end] = this._extractPairRanks(range);
    if (!start || !end) throw new Error(`Invalid pair range: ${range}`);
    return this._generatePairRange(start, end);
  }

  _parseSuitedPlus(info) {
    const ranks = this._getAllRanksBetween(info.rank2, 'K').filter(r => r !== info.rank1);
    return ranks.flatMap(rank => this._generateSuitedRange(info.rank1, rank));
  }

  _parseSuitedRangeBetween(info, range) {
    if (info.rank1 !== info.endRank1) throw new Error(`Invalid suited range: ${range}`);
    const ranks = this._getAllRanksBetween(info.rank2, info.endRank2);
    return ranks.flatMap(rank => this._generateSuitedRange(info.rank1, rank));
  }

  _parseSuitedSingle(info) {
    return this._generateSuitedRange(info.rank1, info.rank2);
  }

  _parseSuitedRange(range) {
    const info = this._extractSuitedRanks(range);
    if (!info) throw new Error(`Invalid suited range: ${range}`);
    if (info.isPlus) return this._parseSuitedPlus(info);
    if (info.endRank2) return this._parseSuitedRangeBetween(info, range);
    return this._parseSuitedSingle(info);
  }

  _parseOffsuitPlus(info) {
    const ranks = this._getAllRanksBetween(info.rank2, 'K').filter(r => r !== info.rank1);
    return ranks.flatMap(rank => this._generateOffsuitRange(info.rank1, rank));
  }

  _parseOffsuitRangeBetween(info, range) {
    if (info.rank1 !== info.endRank1) throw new Error(`Invalid offsuit range: ${range}`);
    const ranks = this._getAllRanksBetween(info.rank2, info.endRank2);
    return ranks.flatMap(rank => this._generateOffsuitRange(info.rank1, rank));
  }

  _parseOffsuitSingle(info) {
    return this._generateOffsuitRange(info.rank1, info.rank2);
  }

  _parseOffsuitRange(range) {
    const info = this._extractOffsuitRanks(range);
    if (!info) throw new Error(`Invalid offsuit range: ${range}`);
    if (info.isPlus) return this._parseOffsuitPlus(info);
    if (info.endRank2) return this._parseOffsuitRangeBetween(info, range);
    return this._parseOffsuitSingle(info);
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
    newInstance.evaluationCache = new Map(this.evaluationCache);
    newInstance.lastHandStrength = this.lastHandStrength;
    return newInstance;
  }

  _normalizeInputToHands(input) {
    if (typeof input === 'string') return this._parseString(input);
    if (Array.isArray(input)) return this._parseArray(input);
    throw new Error('Input must be a string (range notation) or array of hands');
  }

  // ============================================================================
  // FILTERING METHODS
  // ============================================================================

  handContainsDeadCard(hand, deadCards) {
    if (!deadCards || deadCards.length === 0) return false;
    const expandedDeadCards = this._parseCardArray(deadCards);
    const [card1, card2] = this._extractCardsFromHand(hand);
    const normalizedCard1 = card1[0].toLowerCase() + card1[1].toLowerCase();
    const normalizedCard2 = card2[0].toLowerCase() + card2[1].toLowerCase();
    return expandedDeadCards.includes(normalizedCard1) || expandedDeadCards.includes(normalizedCard2);
  }

  _filterDeadCards(hands) {
    if (!this.deadCards || this.deadCards.length === 0) return hands;
    return hands.filter(hand => !this.handContainsDeadCard(hand, this.deadCards));
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
      const expandedCards = this._parseCardArray(input);
      const filtered = this.filteredHands.filter(hand => !this.handContainsDeadCard(hand, expandedCards));
      return this._createFilteredInstance(filtered);
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

  _normalizeCriteria(criteria) {
    if (!Array.isArray(criteria)) throw new Error('Criteria must be an array');
    return criteria.map(c => CRITERIA_MAPPING[c] || c);
  }

  async _evaluateHandWithBoard(hand, boardCards, strict = true) {
    if (!evaluateHandCache) {
      const module = await import('poker-extval');
      evaluateHandCache = module.evaluateHand;
    }
    const handCards = this._extractCardsFromHand(hand);
    const allCards = [...handCards, ...boardCards];
    const uniqueCards = [...new Set(allCards)];
    if (uniqueCards.length < 5) {
      throw new Error(`Need at least 5 unique cards total (hand + board). Got ${uniqueCards.length} unique cards from hand [${handCards.join(', ')}] and board [${boardCards.join(', ')}]`);
    }
    return evaluateHandCache(uniqueCards, strict);
  }

  async _getCachedOrEvaluate(hand, boardCards, strict = true) {
    const cacheKey = `${hand}|${boardCards.join(',')}|strict:${strict}`;
    const cached = this.evaluationCache.get(cacheKey);
    if (cached) return cached;
    const evaluation = await this._evaluateHandWithBoard(hand, boardCards, strict);
    const evaluations = Object.values(evaluation);
    this.evaluationCache.set(cacheKey, evaluations);
    return evaluations;
  }

  async _handMatchesCriteria(hand, criteria, boardCards, strict = true) {
    const handCards = this._extractCardsFromHand(hand);
    const handCardSet = new Set(handCards);
    const boardCardSet = new Set(boardCards);
    const hasOverlap = handCards.some(card => boardCardSet.has(card));
    if (hasOverlap) return false;
    const evaluations = await this._getCachedOrEvaluate(hand, boardCards, strict);
    const normalizedCriteria = this._normalizeCriteria(criteria);
    return evaluations.some(evalObj => normalizedCriteria.some(c => evalObj[c] === true));
  }

  async makesHand(criteria, boardCards = [], strict = true) {
    this.lastBoardCards = boardCards;
    const normalizedCriteria = this._validateCriteriaAndBoard(criteria, boardCards);
    this.lastHandStrength = normalizedCriteria;
    const filtered = [];
    for (const hand of this.filteredHands) {
      if (await this._handMatchesCriteria(hand, criteria, boardCards, strict)) filtered.push(hand);
    }
    const instance = this._createFilteredInstance(filtered);
    instance.lastBoardCards = boardCards;
    instance.lastHandStrength = normalizedCriteria;
    return instance;
  }

  async evaluateHand(hand, boardCards, strict = true) {
    const evaluation = await this._evaluateHandWithBoard(hand, boardCards, strict);
    return {
      is: (criteria) => this._filterEvaluation(evaluation, criteria, false),
      isAll: (criteria) => this._filterEvaluation(evaluation, criteria, true)
    };
  }

  async getObject(hand, boardCards, strict = true) {
    return await this._evaluateHandWithBoard(hand, boardCards, strict);
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

  setDeadCards(deadCards) {
    if (!Array.isArray(deadCards)) throw new Error('Dead cards must be an array');
    deadCards.forEach(card => {
      if (!this._isValidCard(card)) throw new Error(`Invalid card: ${card}`);
    });
    const expanded = this._parseCardArray(deadCards);
    const newInstance = this._createFilteredInstance([...this.filteredHands]);
    newInstance.deadCards = expanded;
    return newInstance;
  }

  _generate5CardCombinations(handCards, boardCards, minHandCards) {
    const allCards = [...handCards, ...boardCards];
    const uniqueCards = [...new Set(allCards)];
    if (uniqueCards.length < 5) return [];
    const combinations = [];
    this._combineCards(uniqueCards, 5, 0, [], combinations, handCards, minHandCards);
    return combinations;
  }

  _combineCards(cards, k, start, current, result, handCards, minHandCards) {
    if (current.length === k) {
      const handCount = current.filter(c => handCards.includes(c)).length;
      if (handCount >= minHandCards) result.push([...current]);
      return;
    }
    for (let i = start; i < cards.length; i++) {
      current.push(cards[i]);
      this._combineCards(cards, k, i + 1, current, result, handCards, minHandCards);
      current.pop();
    }
  }

  _validateCriteriaAndBoard(criteria, boardCards) {
    if (!Array.isArray(criteria)) throw new Error('Criteria must be an array');
    if (!boardCards || boardCards.length === 0) throw new Error('Board cards are required');
    const normalizedCriteria = this._normalizeCriteria(criteria);
    const invalidCriteria = normalizedCriteria.filter(c => !CRITERIA_MAPPING[c] && !c.startsWith('is'));
    if (invalidCriteria.length > 0) throw new Error(`Invalid criteria: ${invalidCriteria.join(', ')}`);
    return normalizedCriteria;
  }

  async _filterByCombinations(criteria, boardCards, minHandCards, strict = true) {
    this.lastBoardCards = boardCards;
    const normalizedCriteria = this._validateCriteriaAndBoard(criteria, boardCards);
    this.lastHandStrength = normalizedCriteria;
    const filtered = [];
    for (const hand of this.filteredHands) {
      if (this.deadCards.length > 0 && this.handContainsDeadCard(hand, this.deadCards)) continue;
      const handCards = this._extractCardsFromHand(hand);
      const combinations = this._generate5CardCombinations(handCards, boardCards, minHandCards);
      if (await this._evaluateCombinations(hand, boardCards, combinations, normalizedCriteria, handCards, minHandCards, strict)) filtered.push(hand);
    }
    const instance = this._createFilteredInstance(filtered);
    instance.lastBoardCards = boardCards;
    instance.lastHandStrength = normalizedCriteria;
    return instance;
  }

  async hitsHand(criteria, boardCards, strict = true) {
    return await this._filterByCombinations(criteria, boardCards, 1, strict);
  }

  async hitsHandBoth(criteria, boardCards, strict = true) {
    return await this._filterByCombinations(criteria, boardCards, 2, strict);
  }

  _getBoardCards(boardCards) {
    return boardCards || this.lastBoardCards;
  }

  _getCachedOnly(hand, boardCards) {
    if (!boardCards) return null;
    // Try both strict=true and strict=false cache keys since we don't know which was used
    let evaluations = this.evaluationCache.get(`${hand}|${boardCards.join(',')}|strict:true`);
    if (!evaluations) {
      evaluations = this.evaluationCache.get(`${hand}|${boardCards.join(',')}|strict:false`);
    }
    return evaluations || null;
  }

  _parseSingleCard(card) {
    if (!card || typeof card !== 'string' || card.length !== 2) return [card];
    const rank = card[0].toUpperCase();
    const suit = card[1].toLowerCase();
    if (rank === 'X' && this._isValidSuit(suit)) return VALID_RANKS.map(r => r.toLowerCase() + suit);
    if (this._isValidRank(rank) && suit === 'x') return VALID_SUITS.map(s => rank.toLowerCase() + s);
    return [rank.toLowerCase() + suit];
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
      return c[0].toLowerCase() + (c[1] || '').toLowerCase();
    });
    if (and) return expandedCards.every(c => normalizedTarget.includes(c));
    return expandedCards.some(c => normalizedTarget.includes(c));
  }

  _normalizeHandStrength(handStrength) {
    return CRITERIA_MAPPING[handStrength] || handStrength;
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
      // Try both strict=true and strict=false cache keys since we don't know which was used
      let evaluations = this.evaluationCache.get(`${hand}|${this.lastBoardCards.join(',')}|strict:true`);
      if (!evaluations) {
        evaluations = this.evaluationCache.get(`${hand}|${this.lastBoardCards.join(',')}|strict:false`);
      }
      if (!evaluations) continue;
      
      for (const evalObj of evaluations) {
        if (!evalObj.keyCards) continue;
        
        // Collect key cards for all matching criteria
        for (const criterion of handStrengthKeys) {
          const keyCards = evalObj.keyCards[criterion];
          if (Array.isArray(keyCards)) {
            keyCards.forEach(card => {
              if (card && typeof card === 'string') {
                // Normalize card format (lowercase)
                const normalized = card[0].toLowerCase() + (card[1] || '').toLowerCase();
                allKeyCards.add(normalized);
              }
            });
          }
        }
      }
    }
    
    return Array.from(allKeyCards).sort();
  }

  async _evaluateCombinations(hand, boardCards, combinations, normalizedCriteria, handCards, minHandCards, strict = true) {
    if (!evaluateHandCache) {
      const module = await import('poker-extval');
      evaluateHandCache = module.evaluateHand;
    }
    const cacheKey = `${hand}|${boardCards.join(',')}|strict:${strict}`;
    const cachedEvaluations = this.evaluationCache.get(cacheKey);
    if (cachedEvaluations) return this._evaluationsMatchWithHandCards(cachedEvaluations, normalizedCriteria, handCards, minHandCards);
    const allCards = [...handCards, ...boardCards];
    const uniqueCards = [...new Set(allCards)];
    if (uniqueCards.length < 5) return false;
    const evaluations = Object.values(evaluateHandCache(uniqueCards, strict));
    this.evaluationCache.set(cacheKey, evaluations);
    return this._evaluationsMatchWithHandCards(evaluations, normalizedCriteria, handCards, minHandCards);
  }

  _evaluationsMatchWithHandCards(evaluations, criteria, handCards, minHandCards) {
    if (minHandCards === 0) return evaluations.some(evalObj => criteria.some(c => evalObj[c] === true));
    const normalizedHandCards = handCards.map(c => c[0].toLowerCase() + (c[1] || '').toLowerCase());
    return evaluations.some(evalObj => this._evalObjMatchesWithHandCards(evalObj, criteria, normalizedHandCards, minHandCards));
  }

  _evalObjMatchesWithHandCards(evalObj, criteria, normalizedHandCards, minHandCards) {
    const matchingCriteria = criteria.filter(c => evalObj[c] === true);
    if (matchingCriteria.length === 0) return false;
    return matchingCriteria.some(c => this._handCardsInKeyCardsForCriterion(normalizedHandCards, evalObj, c) >= minHandCards);
  }

  _handCardsInKeyCardsForCriterion(normalizedHandCards, evalObj, criterion) {
    const keyCards = (evalObj.keyCards?.[criterion] || []).map(c => {
      if (!c || typeof c !== 'string') return c;
      return c[0].toLowerCase() + (c[1] || '').toLowerCase();
    });
    return normalizedHandCards.filter(c => keyCards.includes(c)).length;
  }

  _filterEvaluation(evaluation, criteria, matchAll) {
    // Normalize criteria - handle both string and array
    const criteriaArray = Array.isArray(criteria) ? criteria : [criteria];
    const normalizedCriteria = criteriaArray.map(c => CRITERIA_MAPPING[c] || c);
    
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
    return this.filteredHands.includes(normalized);
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

  _mergeHands(handArrays) {
    const merged = handArrays.flat();
    return this._deduplicateHands(merged);
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

  _detectConsecutiveRanks(ranks) {
    if (ranks.length < 2) return { isConsecutive: false };
    const sortedRanks = [...new Set(ranks)].sort((a, b) => this._getRankValue(b) - this._getRankValue(a));
    const expected = this._getAllRanksBetween(sortedRanks[0], sortedRanks[sortedRanks.length - 1]);
    if (expected.length !== sortedRanks.length || !expected.every((r, i) => r === sortedRanks[i])) return { isConsecutive: false };
    return { isConsecutive: true, startRank: sortedRanks[0], endRank: sortedRanks[sortedRanks.length - 1], goesToAce: sortedRanks[0] === 'A' };
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
    if (seq.start === seq.end) return seq.start + seq.start;
    const detected = this._detectConsecutiveRanks([seq.start, seq.end]);
    if (detected.goesToAce) return seq.end + seq.end + '+';
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

  _shouldUsePlusNotation(firstRank, highestSecondRank, rankDiff, detected) {
    const isHighRank = firstRank === 'Q' || firstRank === 'K' || firstRank === 'A';
    return (isHighRank && rankDiff === 1) || highestSecondRank === 'Q' || highestSecondRank === 'K' || detected.startRank === 'K';
  }

  _processSequence(seq, firstRank, suffix) {
    if (seq.start === seq.end) return [firstRank + seq.start + suffix];
    const detected = this._detectConsecutiveRanks([seq.start, seq.end]);
    const rankDiff = this._getRankValue(firstRank) - this._getRankValue(seq.end);
    if (this._shouldUsePlusNotation(firstRank, seq.end, rankDiff, detected)) return [firstRank + seq.start + suffix + '+'];
    return [firstRank + seq.start + suffix + '-' + firstRank + seq.end + suffix];
  }

  _shouldCombineToPlus(sequences, firstRank) {
    if (sequences.length === 1) return false;
    const lastSeq = sequences[sequences.length - 1];
    return lastSeq.start === lastSeq.end && lastSeq.start === 'Q' && firstRank === 'K';
  }

  _processGroup(group, suffix) {
    const secondRanks = [...new Set(group)].map(h => h[1]);
    const sequences = this._findConsecutiveSequences(secondRanks);
    const firstRank = group[0][0];
    if (sequences.length === 1) return this._processSequence(sequences[0], firstRank, suffix);
    if (this._shouldCombineToPlus(sequences, firstRank)) return [firstRank + sequences[0].start + suffix + '+'];
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

