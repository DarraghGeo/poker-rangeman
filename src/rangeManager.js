const VALID_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const VALID_SUITS = ['s', 'h', 'd', 'c'];
const RANK_VALUES = { A: 14, K: 13, Q: 12, J: 11, T: 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2 };

import { handEquity } from './core/bitval-equity.js';
import { COMBO_COUNT, COMBO_LO, COMBO_HI, idOfHand, cardIndex } from './core/cards.js';
import * as notation from './core/notation.js';
import { loadBitVal, loadExtVal } from './core/load.js';
import { flagLayout, flagMasks } from './core/flags.js';
import { classifyBoard } from './core/classify.js';
import {
  resolveBands, parseShare, bandOf, sideSummary, cappedOf, nutsOf, handClassesOf, breakdownOf,
  compareReport, earthMoversDistance, equityPairs
} from './core/reports.js';
import { CRITERIA_MAPPING, CRITERIA_LOOKUP, VALID_CRITERIA, MADE_HANDS } from './core/criteria.js';

// poker-extval and poker-bitvaljs are loaded lazily on first use (see _loadEvaluator, _loadBitVal)
let extval = null;
let bitval = null;

const STREETS = new Set(['flop', 'turn', 'river']);
// Draws a villain combo can hold, for blockers()
const VILLAIN_DRAWS = [
  'isFlushDraw', 'isBackdoorFlushDraw', 'isOpenEndedStraightDraw', 'isInsideStraightDraw', 'isStraightDraw', 'isComboDraw'
];


// Flag criteria as bit masks over classifiedBoard's (lo, hi) words, in poker-extval's own layout
function criteriaMasks(criteria) {
  const layout = flagLayout(extval);
  const masks = flagMasks(layout, criteria.filter(c => c !== 'isMiddlingPair'));
  masks.middling = criteria.includes('isMiddlingPair');
  masks.middlePair = flagMasks(layout, ['isMiddlePair']);
  return masks;
}

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
    // Evaluation keys a filter has covered without building the evaluation objects (see makesHand's fast path);
    // shared like evaluationCache, so later key-card lookups build them on demand
    this.evaluatedKeys = new Set();
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

  normalizeNotation(input) {
    return notation.normalizeNotation(input);
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

  // ============================================================================
  // PATTERN DETECTION METHODS
  // ============================================================================

  // ============================================================================
  // EXTRACTION METHODS
  // ============================================================================

  _extractCardsFromHand(hand) {
    if (!hand || hand.length !== 4) return [];
    return [hand.substring(0, 2), hand.substring(2, 4)];
  }

  // ============================================================================
  // GENERATION METHODS
  // ============================================================================

  // ============================================================================
  // PARSING METHODS
  // ============================================================================

  // Parses notation, an array or an object into { hands, weights }. Later entries override earlier ones, and a
  // weight of 0 removes the combo. weights holds only combos whose weight is not 1.
  //   string: 'AA,AKs:0.5,TT+:0.25,AhKh:0.4'
  //   array:  exact combos, each 'AhKh', 'AhKh:0.4' or ['AhKh', 0.4]
  //   object: { AhKh: 0.4, AsKs: 1 } (exact combos)
  _parseWeighted(input) {
    return notation.parseWeighted(input);
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
    extval = await loadExtVal();
    return extval;
  }

  async _loadBitVal() {
    bitval = await loadBitVal();
    return bitval;
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
    if (options.strict && board.length >= 3 && board.length <= 5) {
      // Fast path: poker-extval's core classifies every combo on the board at once, as flag bits. With
      // excludeBoardPlays a made hand counts only when it uses a hole card (the core's usesHoleCards)
      const classified = classifyBoard(board, options.street);
      const { lo, hi } = classified;
      const made = criteriaMasks(normalizedCriteria.filter(c => MADE_HANDS.has(c)));
      const other = criteriaMasks(normalizedCriteria.filter(c => !MADE_HANDS.has(c)));
      const filtered = this.filteredHands.filter(hand => {
        const handCards = this._extractCardsFromHand(hand);
        if (handCards.some(card => boardSet.has(card))) return false;
        this.evaluatedKeys.add(this._cacheKey(hand, boardKey, true, options.street));
        const id = idOfHand(hand);
        if ((lo[id] & other.lo) !== 0 || (hi[id] & other.hi) !== 0) return true;
        if (other.middling && ((lo[id] & other.middlePair.lo) !== 0 || (hi[id] & other.middlePair.hi) !== 0) && hand[0] === hand[2]) return true;
        if ((lo[id] & made.lo) === 0 && (hi[id] & made.hi) === 0) return false;
        return !options.excludeBoardPlays || classified.usesHoleCards(id);
      });
      return this._createEvaluatedInstance(filtered, board, normalizedCriteria, options);
    }
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
      const key = this._cacheKey(hand, boardKey, this.lastStrict, street);
      const cached = this.evaluationCache.get(key);
      if (cached) return cached;
      // Covered by makesHand's fast path: build the evaluation now
      return this.evaluatedKeys.has(key) ? this._getCachedOrEvaluate(hand, boardCards, boardKey, this.lastStrict, street) : null;
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

  _weightKey(hands, weights) {
    return hands.map(hand => (weights[hand] === undefined ? hand : `${hand}:${weights[hand]}`)).sort().join(',');
  }

  // A share of 0-1, as a number (0.8) or a percentage string ('80%')
  _parseShare(value, label = 'Equity') {
    return parseShare(value, label);
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
    // A range total needs no per-hand counts: poker-bitvaljs's whole-range call is the fastest way to it
    const bv = await this._loadBitVal();
    const entries = (hands, weights) => hands.map(hand => (weights[hand] === undefined ? hand : { hand, weight: weights[hand] }));
    const result = await bv.compareRange(entries(this.filteredHands, this.handWeights), entries(villainHands, villainWeights), board, deadCards, 5, iterations, true, null, 100, false);
    return this._equityResult(result.win, result.tie, result.lose);
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
    await this._fillHandEquity(this.filteredHands, prepared);
    return Object.fromEntries(this.filteredHands.map(hand => [hand, this.equityCache.get(`${hand}|${prepared.key}`)]));
  }

  // Per-hand { win, tie, lose } arrays for hero's hands (and villain's against hero), aligned with the hand lists,
  // from one poker-bitvaljs compareRangeHands call
  async _bitvalHandEquity(heroHands, heroWeights, villainHands, villainWeights, board, deadCards, iterations) {
    const bv = await this._loadBitVal();
    const ids = hands => hands.map(idOfHand);
    const weightArray = (hands, list, weights) => {
      const array = new Float64Array(COMBO_COUNT);
      hands.forEach((hand, i) => { array[list[i]] = weights[hand] ?? 1; });
      return array;
    };
    const heroIds = ids(heroHands), villainIds = ids(villainHands);
    const result = await handEquity(bv, {
      heroIds, villainIds,
      heroWeight: weightArray(heroHands, heroIds, heroWeights),
      villainWeight: weightArray(villainHands, villainIds, villainWeights),
      board, dead: deadCards, iterations
    });
    const aligned = (side, list) => ({
      win: Float64Array.from(list, id => side.win[id]),
      tie: Float64Array.from(list, id => side.tie[id]),
      lose: Float64Array.from(list, id => side.lose[id])
    });
    return { hero: aligned(result.hero, heroIds), villain: aligned(result.villain, villainIds) };
  }

  // Computes and caches the equity of every hand not cached yet, in one poker-bitvaljs call
  // withVillain: when every hand is computed in this pass, also cache villain's per-hand equity against these hands
  // (poker-bitvaljs gives both sides at once), as _villainEquityByHand() would compute it
  async _fillHandEquity(hands, { board, villainHands, villainWeights, deadCards, iterations, key }, withVillain = false) {
    const missing = hands.filter(hand => !this.equityCache.has(`${hand}|${key}`));
    if (missing.length === 0) return;
    const blockedCards = new Set([...board, ...deadCards]);
    const isBlocked = hand => this._extractCardsFromHand(hand).some(c => blockedCards.has(c));
    const live = villainHands.length === 0 ? [] : missing.filter(hand => !isBlocked(hand));
    const none = () => ({ win: 0, tie: 0, lose: 0, equity: null });
    for (const hand of missing) this.equityCache.set(`${hand}|${key}`, none());
    if (live.length === 0) return;
    const both = withVillain && missing.length === hands.length;
    // Villain's side plays against every hero hand off the board, including those holding an extra dead card
    // (dead cards only leave the deck, as in _villainEquityByHand); hero's own results are kept for live hands
    const onBoard = new Set(board);
    const bitvalHands = both ? missing.filter(hand => !this._extractCardsFromHand(hand).some(c => onBoard.has(c))) : live;
    const { hero, villain } = await this._bitvalHandEquity(bitvalHands, this.handWeights, villainHands, villainWeights, board, deadCards, iterations);
    const liveSet = new Set(live);
    bitvalHands.forEach((hand, i) => {
      if (liveSet.has(hand)) this.equityCache.set(`${hand}|${key}`, this._equityResult(hero.win[i], hero.tie[i], hero.lose[i]));
    });
    if (both) {
      const results = {};
      villainHands.forEach((hand, i) => {
        results[hand] = isBlocked(hand) ? none() : this._equityResult(villain.win[i], villain.tie[i], villain.lose[i]);
      });
      this.equityCache.set(`villain|${key}|${this._weightKey(hands, this.handWeights)}`, results);
    }
  }

  _equityResult(win, tie, lose) {
    const total = win + tie + lose;
    return { win, tie, lose, equity: total ? (win + tie / 2) / total : null };
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
    // Villain's side comes out of the same poker-bitvaljs call, ready for buckets()/compare()
    await this._fillHandEquity(this.filteredHands, prepared, true);
    const handEquity = {};
    for (const hand of this.filteredHands) handEquity[hand] = this.equityCache.get(`${hand}|${prepared.key}`);
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

  /**
   * Every hand that can be dealt on this board, strongest first, with its made hand:
   * [{ hand, category, strength, rank, value, weight }]. rank compares element by element (higher is better);
   * value is the same order as one integer (sorted by it);
   * it reflects the made hand only, not draws.
   */
  async rankHands(boardCards, options = {}) {
    const board = this._requireEvaluationBoard(boardCards);
    const street = this._validateStreet(options.street);
    await Promise.all([this._loadEvaluator(), this._loadBitVal()]);
    const boardSet = new Set(board);
    const ranked = [];
    for (const hand of this.filteredHands) {
      const handCards = this._extractCardsFromHand(hand);
      if (handCards.some(c => boardSet.has(c))) continue;
      ranked.push({ ...this._rankSync(hand, board, street), value: this._handValue(hand, board), weight: this._weight(hand) });
    }
    return ranked.sort((a, b) => b.value - a.value);
  }

  // The made hand's strength as one integer (poker-bitvaljs's evaluateSuits value, which poker-extval's core
  // returns for every combo of a board at once): higher beats lower, equal ties. Needs _loadEvaluator() first.
  _handValue(hand, board) {
    return classifyBoard(board, null).score[idOfHand(hand)];
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

  // The given share of hands (by weight) from one end of the ranking. options.ties: 'keep' (default) keeps every hand
  // tied with the last one taken, so the result can exceed the share by the whole tied group; 'split' gives each
  // tied hand the same fraction of its weight, so the result holds exactly the share.
  async _takeByStrength(portion, boardCards, options, fromTop) {
    const share = this._parseShare(portion, 'Portion');
    const ties = options?.ties ?? 'keep';
    if (ties !== 'keep' && ties !== 'split') throw new Error(`ties must be 'keep' or 'split', got ${ties}`);
    const ranked = await this.rankHands(boardCards, options);
    if (fromTop === false) ranked.reverse();
    // By weight: take hands from this end until they hold the given share of the range's weight
    const target = share * ranked.reduce((sum, r) => sum + r.weight, 0);
    if (ranked.length === 0 || target <= 1e-12) return this._createFilteredInstance([]);
    let cumulative = 0;
    let cutoff = ranked[ranked.length - 1].value;
    for (const r of ranked) {
      cumulative += r.weight;
      if (cumulative >= target - 1e-9) { cutoff = r.value; break; }
    }
    const beyond = r => (fromTop ? r.value > cutoff : r.value < cutoff);
    if (ties === 'split') {
      const above = ranked.filter(beyond).reduce((sum, r) => sum + r.weight, 0);
      const group = ranked.filter(r => r.value === cutoff).reduce((sum, r) => sum + r.weight, 0);
      const factor = Math.min(1, (target - above) / group);
      const weights = new Map(ranked.map(r => [r.hand, beyond(r) ? r.weight : r.value === cutoff ? r.weight * factor : 0]));
      return this._withWeightMap(this.filteredHands.filter(hand => weights.has(hand)).map(hand => [hand, weights.get(hand)]));
    }
    const kept = new Set(ranked.filter(r => beyond(r) || r.value === cutoff).map(r => r.hand));
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
   * How the range hits the board: { total, weight, flags: { flag: { count, weight, share, combos } } }, every flag
   * held by at least one hand, most common first. Hands that share a card with the board are left out.
   */
  async breakdown(boardCards, options = {}) {
    const board = this._requireEvaluationBoard(boardCards);
    const street = this._validateStreet(options.street);
    await this._loadEvaluator();
    return breakdownOf(this.filteredHands.map(idOfHand), this._weightArray(), classifyBoard(board, street));
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

  _resolveBands(bands) {
    return resolveBands(bands);
  }

  _requireMatchup() {
    if (!this.matchup) throw new Error('No matchup yet: call against(villain, board) first');
    return this.matchup;
  }

  _bandOf(equity, bands) {
    return bandOf(equity, bands);
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
      const blockedCards = new Set([...board, ...deadCards]);
      const live = heroHands.length === 0 ? [] : villainHands.filter(hand => !this._extractCardsFromHand(hand).some(c => blockedCards.has(c)));
      for (const hand of villainHands) results[hand] = { win: 0, tie: 0, lose: 0, equity: null };
      if (live.length) {
        // Villain's hands against hero's current range, every hand in one poker-bitvaljs call
        const { hero: side } = await this._bitvalHandEquity(live, {}, heroHands, this.handWeights, board, deadCards, iterations);
        live.forEach((hand, i) => { results[hand] = this._equityResult(side.win[i], side.tie[i], side.lose[i]); });
      }
      this.equityCache.set(cacheKey, results);
    }
    return this.equityCache.get(cacheKey);
  }

  // The arrays the core's reports take (core/reports.js), for hands in the given order: ids, weights and per-combo
  // results by combo id (equity NaN for hands that can't be dealt)
  _reportSide(hands, weights, equityByHand) {
    const weight = new Float64Array(COMBO_COUNT);
    const win = new Float64Array(COMBO_COUNT), tie = new Float64Array(COMBO_COUNT), lose = new Float64Array(COMBO_COUNT);
    const equity = new Float64Array(COMBO_COUNT).fill(NaN);
    for (const hand in equityByHand || {}) {
      const result = equityByHand[hand];
      if (!result || result.equity === null) continue;
      const id = idOfHand(hand);
      win[id] = result.win; tie[id] = result.tie; lose[id] = result.lose; equity[id] = result.equity;
    }
    const ids = hands.map(idOfHand);
    hands.forEach((hand, i) => { weight[ids[i]] = weights[hand] ?? 1; });
    return { ids, weight, win, tie, lose, equity };
  }

  // This range's weights by combo id
  _weightArray() {
    const weight = new Float64Array(COMBO_COUNT);
    for (const hand of this.filteredHands) weight[idOfHand(hand)] = this._weight(hand);
    return weight;
  }

  // Hands and weights as the reports' { ids, weight }
  _parentSide(hands, weights) {
    const weight = new Float64Array(COMBO_COUNT);
    const ids = hands.map(idOfHand);
    hands.forEach((hand, i) => { weight[ids[i]] = weights[hand] ?? 1; });
    return { ids, weight };
  }




  /** Equity bucket shares for both sides: { bands, hero, villain }, each { combos, equity, buckets, shape }. */
  async buckets() {
    const { bands, board, deadCards, shapeEnough, minDominant, topEnd, nutsMinEquity } = this._requireMatchup();
    const villainEquity = await this._villainEquityByHand();
    await this._loadEvaluator();
    const { hero, villain, parent } = this._reportSides(villainEquity);
    const options = { bands, enough: shapeEnough, minDominant };
    const heroSummary = sideSummary(hero, { ...options, parent });
    const villainSummary = sideSummary(villain, options);
    const { score, blocked, boardKey } = this._cappingContext(board, deadCards);
    heroSummary.capped = cappedOf(hero, villain, score, blocked, topEnd, boardKey);
    villainSummary.capped = cappedOf(villain, hero, score, blocked, topEnd, boardKey);
    heroSummary.nuts = nutsOf(hero, nutsMinEquity);
    villainSummary.nuts = nutsOf(villain, nutsMinEquity);
    return { bands, hero: heroSummary, villain: villainSummary };
  }

  // Both sides' report arrays for the stored matchup, and hero's parent range (for contiguity)
  _reportSides(villainEquity) {
    const { parentHands, parentWeights, villainHands, villainWeights } = this.matchup;
    return {
      hero: this._reportSide(this.filteredHands, this.handWeights, this.handEquity),
      villain: this._reportSide(villainHands, villainWeights, villainEquity),
      parent: this._parentSide(parentHands, parentWeights)
    };
  }

  // Made-hand scores of every combo on the board (null preflop), the board and dead cards, and a cache key
  _cappingContext(board, deadCards) {
    const blocked = new Uint8Array(52);
    for (const card of [...board, ...deadCards]) blocked[cardIndex(card)] = 1;
    return {
      score: board.length >= 3 ? classifyBoard(board, null).score : null,
      blocked,
      boardKey: `${board.join(',')}|${[...deadCards].sort().join(',')}`
    };
  }


  _cappedFor(hands, otherHands, board, deadCards, topEnd, weights = {}, otherWeights = {}) {
    const { score, blocked, boardKey } = this._cappingContext(board, deadCards);
    return cappedOf(this._parentSide(hands, weights), this._parentSide(otherHands, otherWeights), score, blocked, topEnd, boardKey);
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
    await this._loadEvaluator();
    return handClassesOf(this.filteredHands.map(idOfHand), this._weightArray(), classifyBoard(board, street), { highCards: options.highCards ?? true });
  }


  /**
   * Range vs range report: both sides' equity, buckets, shape, capping and effective nuts; advantage, each
   * hero minus villain: range (equity, Modern Poker Theory's "range vs range equity advantage"), nut (share of
   * effective nuts, hands with 90%+ equity against the other range: the book's "effective nut hands make up a
   * larger portion of his range"), polarization (shape.polarized), and the share of each equity band and hand
   * class (positive = hero has more of it); hand classes side by side, exclusive (handClasses, adding up to 1)
   * and overlapping flags (flags), flop, turn or river only; capped (relative and absolute) per side; and the
   * book's flop averages as a reference when the default bands are used. Computed by core/reports.js from
   * per-combo arrays.
   */
  async compare() {
    const { bands, board, deadCards, shapeEnough, minDominant, topEnd, nutsMinEquity, villainHands } = this._requireMatchup();
    const villainEquity = await this._villainEquityByHand();
    await this._loadEvaluator();
    const { hero, villain, parent } = this._reportSides(villainEquity);
    // Villain's hand classes and flags leave out combos holding a dead card
    const dead = new Set(deadCards);
    villain.classIds = villainHands.filter(hand => !this._extractCardsFromHand(hand).some(c => dead.has(c))).map(idOfHand);
    const { blocked, boardKey } = this._cappingContext(board, deadCards);
    return compareReport({
      hero, villain, parent, blocked, boardKey, boardCards: board,
      classified: board.length >= 3 ? classifyBoard(board, null) : null,
      options: { bands, enough: shapeEnough, minDominant, topEnd, nutsMinEquity }
    });
  }

  _villainRange() {
    const { villainHands, villainWeights, deadCards } = this._requireMatchup();
    return new RangeManager(villainHands.map(hand => [hand, villainWeights[hand] ?? 1]), deadCards);
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
    this._requireStoredEquity();
    await this._loadEvaluator();
    const mySide = this._reportSide(this.filteredHands, this.handWeights, this.handEquity);
    const ref = this._reportSide(referenceWithEquity.filteredHands, referenceWithEquity.handWeights, referenceWithEquity.handEquity);
    const villain = this._parentSide(villainHands, villainWeights);
    const summary = { bands, enough: shapeEnough, minDominant };
    const rangeSummary = sideSummary(mySide, { ...summary, parent: this._parentSide(parentHands, parentWeights) });
    const referenceSummary = sideSummary(ref, summary);
    const { score, blocked, boardKey } = this._cappingContext(board, deadCards);
    rangeSummary.capped = cappedOf(mySide, villain, score, blocked, topEnd, boardKey);
    referenceSummary.capped = cappedOf(ref, villain, score, blocked, topEnd, boardKey);
    report.equity = { range: rangeSummary.equity, reference: referenceSummary.equity };
    report.buckets = { range: rangeSummary, reference: referenceSummary };
    report.distance = earthMoversDistance(equityPairs(mySide), equityPairs(ref));
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
    return notation.weightedNotation(this.filteredHands, hand => this._weight(hand), notation.classNotation);
  }

  /** Abbreviated notation; weighted combos get their weight after a colon: 'QQ+,AKs:0.5'. */
  toNotation() {
    // Instances don't change after they are made, so the notation is worked out once per hand list and weights
    if (this._notationSource !== this.filteredHands || this._notationWeights !== this.handWeights) {
      this._notation = notation.weightedNotation(this.filteredHands, hand => this._weight(hand));
      this._notationSource = this.filteredHands;
      this._notationWeights = this.handWeights;
    }
    return this._notation;
  }

  // ============================================================================
  // INTERNAL HELPER METHODS
  // ============================================================================

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

// The core API: ranges as typed arrays, boards classified once, per-combo equity for both sides (also available
// as 'poker-rangeman/core')
export { Range, Board, ready, terminateWorkers } from './core/index.js';
