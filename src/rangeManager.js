const VALID_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const VALID_SUITS = ['s', 'h', 'd', 'c'];

let evaluateHandCache = null;

const CRITERIA_MAPPING = {
  'Pair': 'isPair', 'Two Pair': 'isTwoPair', 'Three of a Kind': 'isThreeOfAKind',
  'Straight': 'isStraight', 'Flush': 'isFlush', 'Full House': 'isFullHouse',
  'Four of a Kind': 'isFourOfAKind', 'Straight Flush': 'isStraightFlush', 'Royal Flush': 'isRoyalFlush',
  'Top Pair': 'isTopPair', 'Middle Pair': 'isMiddlePair', 'Bottom Pair': 'isBottomPair', 'Overpair': 'isOverpair',
  'Set': 'isSet', 'Trips': 'isTrips', 'Top Set': 'isTopSet', 'Middle Set': 'isMiddleSet', 'Bottom Set': 'isBottomSet',
  'Top Trips': 'isTopTrips', 'Middle Trips': 'isMiddleTrips', 'Bottom Trips': 'isBottomTrips',
  'Top Two Pair': 'isTopTwoPair', 'Middle Two Pair': 'isMiddleTwoPair', 'Bottom Two Pair': 'isBottomTwoPair',
  'Top Kicker': 'isTopKicker', 'Middle Kicker': 'isMiddleKicker', 'Bottom Kicker': 'isBottomKicker',
  'Ace Kicker': 'isAceKicker', 'King Kicker': 'isKingKicker',
  'Flush Draw': 'isFlushDraw', 'Straight Draw': 'isStraightDraw', 'Inside Straight Draw': 'isInsideStraightDraw',
  'Open Ended Straight Draw': 'isOpenEndedStraightDraw', 'Backdoor Flush Draw': 'isBackdoorFlushDraw',
  'Backdoor Straight Draw': 'isBackdoorStraightDraw',
  'Ace High': 'isAceHigh', 'King High': 'isKingHigh', 'Queen High': 'isQueenHigh', 'Jack High': 'isJackHigh',
  'No Pair': 'isNoPair', 'High Card': 'isHighCard'
};

export class RangeManager {
  constructor(input, deadCards = []) {
    this.rawInput = input;
    this.deadCards = deadCards || [];
    this.hands = [];
    this.filteredHands = [];
    
    if (!input) throw new Error('Input is required');
    if (!Array.isArray(input) && typeof input !== 'string') {
      throw new Error('Input must be a string or array');
    }
    
    const parsed = this.parse(input);
    this.hands = parsed;
    this.filteredHands = [...parsed];
  }

  // ============================================================================
  // VALIDATION METHODS
  // ============================================================================

  isValidRank(rank) {
    if (!rank || typeof rank !== 'string') return false;
    return VALID_RANKS.includes(rank);
  }

  isValidSuit(suit) {
    if (!suit || typeof suit !== 'string') return false;
    return VALID_SUITS.includes(suit);
  }

  isValidCard(card) {
    if (!card || typeof card !== 'string' || card.length !== 2) return false;
    return this.isValidRank(card[0]) && this.isValidSuit(card[1]);
  }

  isValidHand(hand) {
    if (!hand || typeof hand !== 'string' || hand.length !== 4) return false;
    const card1 = hand.substring(0, 2);
    const card2 = hand.substring(2, 4);
    if (!this.isValidCard(card1) || !this.isValidCard(card2)) return false;
    return card1 !== card2;
  }

  // ============================================================================
  // NORMALIZATION METHODS
  // ============================================================================

  normalizeCardOrder(card1, card2) {
    // compareRanks returns 1 if rank1 > rank2, so >= 0 means rank1 >= rank2 (higher or equal rank first)
    if (this.compareRanks(card1[0], card2[0]) >= 0) return [card1, card2];
    return [card2, card1];
  }

  normalizeHand(hand) {
    if (!this.isValidHand(hand)) throw new Error(`Invalid hand: ${hand}`);
    const card1 = hand.substring(0, 2);
    const card2 = hand.substring(2, 4);
    const [high, low] = this.normalizeCardOrder(card1, card2);
    if (high[0] === low[0]) {
      const suits = [high[1], low[1]].sort();
      return high[0] + suits[0] + high[0] + suits[1];
    }
    return high + low;
  }

  _normalizeSegment(segment) {
    const trimmed = segment.trim();
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      return parts.map(p => {
        const lastChar = p.slice(-1).toLowerCase();
        if (lastChar === 's' || lastChar === 'o') return p.slice(0, -1).toUpperCase() + lastChar;
        return p.toUpperCase();
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

  getRankValue(rank) {
    if (rank === 'A') return 14;
    if (rank === 'K') return 13;
    if (rank === 'Q') return 12;
    if (rank === 'J') return 11;
    if (rank === 'T') return 10;
    return parseInt(rank, 10);
  }

  compareRanks(rank1, rank2) {
    const val1 = this.getRankValue(rank1);
    const val2 = this.getRankValue(rank2);
    if (val1 > val2) return 1;
    if (val1 < val2) return -1;
    return 0;
  }

  getAllRanksBetween(startRank, endRank) {
    const startIdx = VALID_RANKS.indexOf(startRank);
    const endIdx = VALID_RANKS.indexOf(endRank);
    if (startIdx === -1 || endIdx === -1) return [];
    if (startIdx <= endIdx) return VALID_RANKS.slice(startIdx, endIdx + 1);
    return VALID_RANKS.slice(endIdx, startIdx + 1).reverse();
  }

  getAllSuits() {
    return ['c', 'd', 'h', 's'];
  }

  // ============================================================================
  // PATTERN DETECTION METHODS
  // ============================================================================

  isPairNotation(segment) {
    if (!segment || typeof segment !== 'string') return false;
    if (/^([AKQJT2-9])\1\+$/.test(segment)) return true;
    if (/^([AKQJT2-9])\1$/.test(segment)) return true;
    if (!segment.includes('-')) return false;
    const parts = segment.split('-');
    if (parts.length !== 2) return false;
    return /^([AKQJT2-9])\1$/.test(parts[0]) && /^([AKQJT2-9])\1$/.test(parts[1]);
  }

  isSuitedNotation(segment) {
    if (!segment || typeof segment !== 'string') return false;
    if (/^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}s\+$/.test(segment)) return true;
    if (/^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}s-[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}s$/.test(segment)) return true;
    return /^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}s$/.test(segment);
  }

  isOffsuitNotation(segment) {
    if (!segment || typeof segment !== 'string') return false;
    if (/^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}o\+$/.test(segment)) return true;
    if (/^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}o-[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}o$/.test(segment)) return true;
    return /^[AKQJT2-9]{1,2}[AKQJT2-9]{1,2}o$/.test(segment);
  }

  isWildcardNotation(segment) {
    if (!segment || typeof segment !== 'string' || segment.length !== 4) return false;
    return segment.includes('x') || segment.includes('X');
  }

  isSpecificHandNotation(segment) {
    if (!segment || typeof segment !== 'string' || segment.length !== 4) return false;
    return this.isValidHand(segment);
  }

  detectNotationType(segment) {
    if (this.isPairNotation(segment)) return 'pair';
    if (this.isSuitedNotation(segment)) return 'suited';
    if (this.isOffsuitNotation(segment)) return 'offsuit';
    if (this.isWildcardNotation(segment)) return 'wildcard';
    if (this.isSpecificHandNotation(segment)) return 'specific';
    return null;
  }

  // ============================================================================
  // EXTRACTION METHODS
  // ============================================================================

  extractCardsFromHand(hand) {
    if (!hand || hand.length !== 4) return [];
    return [hand.substring(0, 2), hand.substring(2, 4)];
  }

  extractPairRanks(range) {
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

  extractSuitedRanks(range) {
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

  extractOffsuitRanks(range) {
    if (!range) return null;
    if (range.endsWith('+')) return this._extractOffsuitPlus(range);
    if (range.includes('-')) return this._extractOffsuitRange(range);
    return this._extractOffsuitSingle(range);
  }

  _extractCard1Wildcard(card1, result) {
    if (card1[1] === 'x') {
      result.card1SuitWildcard = true;
      result.card1ExcludeSuit = 's';
    } else {
      result.card1Suit = card1[1];
    }
  }

  _extractCard2Wildcard(card2, card1, result) {
    if (card2[0] === 'X') {
      result.card2RankWildcard = true;
      result.card2ExcludeRank = card1[0];
      if (card2[1] === 'x') result.card2SuitWildcard = true;
      else result.card2Suit = card2[1];
    } else {
      result.card2Rank = card2[0];
      result.card2Suit = card2[1];
    }
  }

  extractWildcardHand(hand) {
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
        combos.push(this.normalizeHand(rank + suits[i] + rank + suits[j]));
      }
    }
    return combos;
  }

  generatePairCombinations(rank) {
    return this._generatePairCombos(rank, this.getAllSuits());
  }

  generatePairRange(startRank, endRank) {
    const ranks = this.getAllRanksBetween(startRank, endRank);
    const hands = [];
    ranks.forEach(rank => {
      hands.push(...this.generatePairCombinations(rank));
    });
    return hands;
  }

  generateSuitedRange(rank1, rank2) {
    const suits = this.getAllSuits();
    return suits.map(suit => this.normalizeHand(rank1 + suit + rank2 + suit));
  }

  _generateOffsuitCombos(rank1, rank2, suits) {
    const hands = [];
    suits.forEach(suit1 => {
      suits.forEach(suit2 => {
        if (suit1 !== suit2) hands.push(this.normalizeHand(rank1 + suit1 + rank2 + suit2));
      });
    });
    return hands;
  }

  generateOffsuitRange(rank1, rank2) {
    return this._generateOffsuitCombos(rank1, rank2, this.getAllSuits());
  }

  generateSuitedCombination(rank1, suit1, rank2, suit2) {
    if (suit1 !== suit2) throw new Error('Suits must match for suited combination');
    return this.normalizeHand(rank1 + suit1 + rank2 + suit2);
  }

  generateOffsuitCombination(rank1, suit1, rank2, suit2) {
    if (suit1 === suit2) throw new Error('Suits must differ for offsuit combination');
    return this.normalizeHand(rank1 + suit1 + rank2 + suit2);
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
          if (!this.isValidHand(combo)) return;
          hands.push(this.normalizeHand(combo));
        });
      });
    });
    return hands;
  }

  generateWildcardCombinations(hand) {
    const info = this.extractWildcardHand(hand);
    if (!info) return [];
    const card1Suits = this._getCard1Suits(info);
    const card2Ranks = this._getCard2Ranks(info);
    const card2Suits = this._getCard2Suits(info);
    return this.deduplicateHands(this._generateCombosFromWildcard(info, card1Suits, card2Ranks, card2Suits));
  }

  // ============================================================================
  // PARSING METHODS
  // ============================================================================

  parseSpecificHand(hand) {
    if (!this.isValidHand(hand)) throw new Error(`Invalid hand: ${hand}`);
    return this.normalizeHand(hand);
  }

  parseWildcardHand(hand) {
    return this.generateWildcardCombinations(hand);
  }

  parsePairRange(range) {
    const [start, end] = this.extractPairRanks(range);
    if (!start || !end) throw new Error(`Invalid pair range: ${range}`);
    return this.generatePairRange(start, end);
  }

  _parseSuitedPlus(info) {
    const ranks = this.getAllRanksBetween(info.rank2, 'K').filter(r => r !== info.rank1);
    return ranks.flatMap(rank => this.generateSuitedRange(info.rank1, rank));
  }

  _parseSuitedRangeBetween(info, range) {
    if (info.rank1 !== info.endRank1) throw new Error(`Invalid suited range: ${range}`);
    const ranks = this.getAllRanksBetween(info.rank2, info.endRank2);
    return ranks.flatMap(rank => this.generateSuitedRange(info.rank1, rank));
  }

  _parseSuitedSingle(info) {
    return this.generateSuitedRange(info.rank1, info.rank2);
  }

  parseSuitedRange(range) {
    const info = this.extractSuitedRanks(range);
    if (!info) throw new Error(`Invalid suited range: ${range}`);
    if (info.isPlus) return this._parseSuitedPlus(info);
    if (info.endRank2) return this._parseSuitedRangeBetween(info, range);
    return this._parseSuitedSingle(info);
  }

  _parseOffsuitPlus(info) {
    const ranks = this.getAllRanksBetween(info.rank2, 'K').filter(r => r !== info.rank1);
    return ranks.flatMap(rank => this.generateOffsuitRange(info.rank1, rank));
  }

  _parseOffsuitRangeBetween(info, range) {
    if (info.rank1 !== info.endRank1) throw new Error(`Invalid offsuit range: ${range}`);
    const ranks = this.getAllRanksBetween(info.rank2, info.endRank2);
    return ranks.flatMap(rank => this.generateOffsuitRange(info.rank1, rank));
  }

  _parseOffsuitSingle(info) {
    return this.generateOffsuitRange(info.rank1, info.rank2);
  }

  parseOffsuitRange(range) {
    const info = this.extractOffsuitRanks(range);
    if (!info) throw new Error(`Invalid offsuit range: ${range}`);
    if (info.isPlus) return this._parseOffsuitPlus(info);
    if (info.endRank2) return this._parseOffsuitRangeBetween(info, range);
    return this._parseOffsuitSingle(info);
  }

  parseSegment(segment) {
    const type = this.detectNotationType(segment);
    if (type === 'pair') return this.parsePairRange(segment);
    if (type === 'suited') return this.parseSuitedRange(segment);
    if (type === 'offsuit') return this.parseOffsuitRange(segment);
    if (type === 'wildcard') return this.parseWildcardHand(segment);
    if (type === 'specific') return [this.parseSpecificHand(segment)];
    throw new Error(`Unrecognized notation: ${segment}`);
  }

  parseString(notation) {
    const normalized = this.normalizeNotation(notation);
    const segments = normalized.split(',').map(s => s.trim()).filter(s => s);
    const hands = [];
    segments.forEach(segment => {
      hands.push(...this.parseSegment(segment));
    });
    return this.deduplicateHands(hands);
  }

  parseArray(input) {
    if (!Array.isArray(input)) throw new Error('Input must be an array');
    if (input.length === 0) throw new Error('Array cannot be empty');
    const hands = [];
    input.forEach(hand => {
      if (!this.isValidHand(hand)) throw new Error(`Invalid hand in array: ${hand}`);
      hands.push(this.normalizeHand(hand));
    });
    return this.deduplicateHands(hands);
  }

  parse(input) {
    if (typeof input === 'string') return this.parseString(input);
    if (Array.isArray(input)) return this.parseArray(input);
    throw new Error('Input must be a string or array');
  }

  // ============================================================================
  // FILTERING METHODS
  // ============================================================================

  handContainsDeadCard(hand, deadCards) {
    if (!deadCards || deadCards.length === 0) return false;
    const [card1, card2] = this.extractCardsFromHand(hand);
    return deadCards.includes(card1) || deadCards.includes(card2);
  }

  exclude(deadCards) {
    if (!Array.isArray(deadCards)) throw new Error('Dead cards must be an array');
    const filtered = this.filteredHands.filter(hand => !this.handContainsDeadCard(hand, deadCards));
    const newInstance = Object.create(Object.getPrototypeOf(this));
    Object.assign(newInstance, this);
    newInstance.filteredHands = filtered;
    return newInstance;
  }

  normalizeCriteria(criteria) {
    if (!Array.isArray(criteria)) throw new Error('Criteria must be an array');
    return criteria.map(c => CRITERIA_MAPPING[c] || c);
  }

  async evaluateHandWithBoard(hand, boardCards) {
    if (!evaluateHandCache) {
      const module = await import('poker-extval');
      evaluateHandCache = module.evaluateHand;
    }
    const allCards = [...this.extractCardsFromHand(hand), ...boardCards];
    const uniqueCards = [...new Set(allCards)];
    if (uniqueCards.length < 5) throw new Error('Need at least 5 cards total');
    return evaluateHandCache(uniqueCards);
  }

  async handMatchesCriteria(hand, criteria, boardCards) {
    const evaluation = await this.evaluateHandWithBoard(hand, boardCards);
    const normalizedCriteria = this.normalizeCriteria(criteria);
    // Check all possible 5-card combinations, not just the first one
    return Object.values(evaluation).some(evalObj => 
      normalizedCriteria.some(c => evalObj[c] === true)
    );
  }

  async match(criteria, boardCards = []) {
    if (!Array.isArray(criteria)) throw new Error('Criteria must be an array');
    if (!boardCards || boardCards.length === 0) throw new Error('Board cards are required');
    const normalizedCriteria = this.normalizeCriteria(criteria);
    const invalidCriteria = normalizedCriteria.filter(c => !CRITERIA_MAPPING[c] && !c.startsWith('is'));
    if (invalidCriteria.length > 0) throw new Error(`Invalid criteria: ${invalidCriteria.join(', ')}`);
    const filtered = [];
    for (const hand of this.filteredHands) {
      if (await this.handMatchesCriteria(hand, criteria, boardCards)) filtered.push(hand);
    }
    const newInstance = Object.create(Object.getPrototypeOf(this));
    Object.assign(newInstance, this);
    newInstance.filteredHands = filtered;
    return newInstance;
  }

  async evaluateHand(hand, boardCards) {
    const evaluation = await this.evaluateHandWithBoard(hand, boardCards);
    return {
      is: (criteria) => this._filterEvaluation(evaluation, criteria, false),
      isAll: (criteria) => this._filterEvaluation(evaluation, criteria, true)
    };
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
    const normalized = this.normalizeHand(hand);
    return this.filteredHands.includes(normalized);
  }

  toString() {
    return this.groupHandsIntoNotation(this.filteredHands);
  }

  // ============================================================================
  // INTERNAL HELPER METHODS
  // ============================================================================

  deduplicateHands(hands) {
    return [...new Set(hands)];
  }

  mergeHands(handArrays) {
    const merged = handArrays.flat();
    return this.deduplicateHands(merged);
  }

  _categorizeHand(hand) {
    const [c1, c2] = this.extractCardsFromHand(hand);
    const [high, low] = this.normalizeCardOrder(c1, c2);
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

  groupHandsIntoNotation(hands) {
    if (hands.length === 0) return '';
    const categories = { pairs: [], suited: [], offsuit: [] };
    hands.forEach(hand => {
      const cat = this._categorizeHand(hand);
      categories[cat.type === 'pair' ? 'pairs' : cat.type === 'suited' ? 'suited' : 'offsuit'].push(cat.notation);
    });
    return this._buildNotationParts(categories);
  }
}

