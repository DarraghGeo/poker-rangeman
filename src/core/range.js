// The core API: ranges as weight arrays indexed by combo id, boards classified once, and matchups that hold every
// combo's equity for both sides. Browser-safe.

import { COMBO_COUNT, COMBO_LO, COMBO_HI, HAND_STRINGS, idOfAnyHand, cardIndex } from './cards.js';
import { parseWeighted, expandCards, isValidCard, isValidConcreteCard, isValidSuit, weightedNotation, classNotation } from './notation.js';
import { criterionFlag, VALID_CRITERIA } from './criteria.js';
import { handEquity, handEquitySync } from './bitval-equity.js';
import { loadBitVal, loadExtVal, loaded } from './load.js';
import { flagLayout, hasFlagAt, flagMasks } from './flags.js';
import { classifyBoard } from './classify.js';
import { analysisOptions, compareReport, sideSummary, cappedOf, nutsOf, handClassesOf, breakdownOf, earthMoversDistance, equityPairs } from './reports.js';

const SUIT_INDEX = { s: 0, h: 1, d: 2, c: 3 };

/** Card strings (wildcards allowed: 'Ax', 'Xh') to card numbers. */
function cardNumbers(cards, label = 'card') {
  if (!Array.isArray(cards)) throw new Error(`${label}s must be an array`);
  for (const card of cards) if (!isValidCard(card)) throw new Error(`Invalid ${label}: ${card}`);
  return [...new Set(expandCards(cards).map(cardIndex))];
}

/**
 * An immutable weighted range. `weights[id]` is the weight (0 to 1) of combo `id`; 0 means not in the range.
 * Every method returns a new Range.
 */
export class Range {
  #weights;
  #ids = null;

  /** Use Range.from(); the constructor takes ownership of a Float64Array(1326) of weights. */
  constructor(weights) {
    if (!(weights instanceof Float64Array) || weights.length !== COMBO_COUNT) throw new Error('Range needs a Float64Array(1326) of weights; use Range.from()');
    this.#weights = weights;
  }

  /**
   * A range from notation ('AA,KQs:0.5,AxKh'), an array of exact hands ('AhKh', 'AhKh:0.4', ['AhKh', 0.4],
   * { hand, weight }), an object ({ AhKh: 0.4 }), or another Range. options.dead removes the combos holding
   * those cards (wildcards allowed).
   */
  static from(input, options = {}) {
    let range;
    if (input instanceof Range) range = input;
    else {
      if (!input) throw new Error('Input is required');
      const { hands, weights } = parseWeighted(input);
      const array = new Float64Array(COMBO_COUNT);
      for (const hand of hands) array[idOfAnyHand(hand)] = weights[hand] ?? 1;
      range = new Range(array);
    }
    return options.dead && options.dead.length ? range.withoutCards(options.dead) : range;
  }

  /** A range from combo ids (weight 1, or the matching entry of weights). */
  static fromIds(ids, weights = null) {
    const array = new Float64Array(COMBO_COUNT);
    ids.forEach((id, i) => { array[id] = weights ? weights[i] : 1; });
    return new Range(array);
  }

  /** Weight by combo id. Don't modify it: ranges share arrays. */
  get weights() { return this.#weights; }

  /** The combo ids in the range, ascending. */
  get ids() {
    if (!this.#ids) {
      const ids = [];
      for (let id = 0; id < COMBO_COUNT; id++) if (this.#weights[id] > 0) ids.push(id);
      this.#ids = Uint16Array.from(ids);
    }
    return this.#ids;
  }

  get size() { return this.ids.length; }

  get weightedSize() {
    let sum = 0;
    for (const id of this.ids) sum += this.#weights[id];
    return sum;
  }

  get isWeighted() {
    for (const id of this.ids) if (this.#weights[id] !== 1) return true;
    return false;
  }

  has(hand) { return this.weightOf(hand) > 0; }

  weightOf(hand) {
    const id = typeof hand === 'number' ? hand : idOfAnyHand(hand);
    if (id < 0) throw new Error(`Invalid hand: ${hand}`);
    return this.#weights[id];
  }

  /** The hands as strings ('AhKd', pairs 'AcAs'), strongest first card first. */
  hands() {
    const ids = this.ids;
    const out = new Array(ids.length);
    for (let i = 0; i < ids.length; i++) out[i] = HAND_STRINGS[ids[ids.length - 1 - i]];
    return out;
  }

  /** { hand: weight } for every combo. */
  toObject() {
    return Object.fromEntries(this.hands().map(hand => [hand, this.#weights[idOfAnyHand(hand)]]));
  }

  /** Abbreviated notation with weights: 'QQ+,AKs:0.5'. Parses back to the same range. */
  toNotation() {
    return weightedNotation(this.hands(), hand => this.#weights[idOfAnyHand(hand)]);
  }

  /** Every hand class written out: 'QQ,KK,AA,AKs'. */
  toClassNotation() {
    return weightedNotation(this.hands(), hand => this.#weights[idOfAnyHand(hand)], classNotation);
  }

  toString() { return this.toNotation(); }

  #map(fn) {
    const out = new Float64Array(COMBO_COUNT);
    const w = this.#weights;
    for (let id = 0; id < COMBO_COUNT; id++) {
      const value = fn(w[id], id);
      out[id] = value > 1 ? 1 : value > 1e-12 ? value : 0;
    }
    return new Range(out);
  }

  /** Adds combos; a combo in both keeps the larger weight. */
  include(input) {
    const other = Range.from(input).weights;
    return this.#map((w, id) => (other[id] > w ? other[id] : w));
  }

  /** Removes that share of each combo: excluding 'AKs:0.25' keeps 75% of AKs. */
  exclude(input) {
    const other = Range.from(input).weights;
    return this.#map((w, id) => w * (1 - other[id]));
  }

  /** Keeps combos in both, weights multiplied. */
  intersect(input) {
    const other = Range.from(input).weights;
    return this.#map((w, id) => w * other[id]);
  }

  /** Multiplies every weight (capped at 1). */
  scale(factor) {
    if (typeof factor !== 'number' || !Number.isFinite(factor) || factor < 0) throw new Error('scale needs a number of 0 or more');
    return this.#map(w => w * factor);
  }

  /** Sets the weight of the given combos that are in the range; 0 removes them. */
  setWeight(input, weight) {
    if (typeof weight !== 'number' || !(weight >= 0 && weight <= 1)) throw new Error(`Invalid weight: ${weight}. Weights are numbers from 0 to 1`);
    const targets = Range.from(input).weights;
    return this.#map((w, id) => (w > 0 && targets[id] > 0 ? weight : w));
  }

  /** Keeps the combos for which fn(id, weight) is true. */
  filter(fn) {
    return this.#map((w, id) => (w > 0 && fn(id, w) ? w : 0));
  }

  /** Removes every combo holding one of the cards (wildcards allowed: 'Ax', 'Xh'). */
  withoutCards(cards) {
    const blocked = new Uint8Array(52);
    for (const c of cardNumbers(cards)) blocked[c] = 1;
    return this.#map((w, id) => (blocked[COMBO_LO[id]] || blocked[COMBO_HI[id]] ? 0 : w));
  }

  /** Combos with at least one card of the suit. */
  withSuit(suit) {
    if (!isValidSuit(suit)) throw new Error(`Invalid suit: ${suit}`);
    const s = SUIT_INDEX[suit.toLowerCase()];
    return this.#map((w, id) => ((COMBO_LO[id] & 3) === s || (COMBO_HI[id] & 3) === s ? w : 0));
  }

  /** Combos with both cards of the suit. */
  suitedOf(suit) {
    if (!isValidSuit(suit)) throw new Error(`Invalid suit: ${suit}`);
    const s = SUIT_INDEX[suit.toLowerCase()];
    return this.#map((w, id) => ((COMBO_LO[id] & 3) === s && (COMBO_HI[id] & 3) === s ? w : 0));
  }

  /**
   * Every combo's equity against villain on the board, both sides, from one poker-bitvaljs compareRangeHands call
   * (exact postflop, Monte Carlo preflop unless its preflop table is loaded). options: { dead, iterations (preflop
   * boards, default 10000), workers (poker-bitvaljs's Web Workers, browsers only; default false) }.
   */
  async vs(villain, board = [], options = {}) {
    const [bitval] = await Promise.all([loadBitVal(), loadExtVal()]);
    const job = this.#matchupJob(villain, board, options);
    return new Matchup(job, await handEquity(bitval, job), bitval);
  }

  /** vs() synchronously, from poker-bitvaljs's compareRangeHandsSync; needs `await ready()` first. No workers. */
  vsSync(villain, board = [], options = {}) {
    const { bitval } = loaded('bitval', 'extval');
    const job = this.#matchupJob(villain, board, options);
    return new Matchup(job, handEquitySync(bitval, job), bitval);
  }

  #matchupJob(villain, board, options) {
    const boardCards = Array.isArray(board) ? board : board instanceof Board ? board.cards : null;
    if (!boardCards) throw new Error('Board must be an array of cards or a Board');
    const boardNumbers = boardCards.map(card => {
      if (typeof card === 'number') return card;
      if (!isValidConcreteCard(card)) throw new Error(`Invalid board card: ${card}`);
      return cardIndex(card);
    });
    if (new Set(boardNumbers).size !== boardNumbers.length) throw new Error('Board cards must be unique');
    if (![0, 3, 4, 5].includes(boardNumbers.length)) throw new Error(`Board must have 0 or 3 to 5 cards, got ${boardNumbers.length}`);
    const dead = options.dead ? cardNumbers(options.dead, 'dead card') : [];
    const iterations = options.iterations ?? 10000;
    if (!Number.isInteger(iterations) || iterations < 1) throw new Error('iterations must be a positive integer');
    const hero = dead.length ? this.withoutCards(dead.map(c => cardStringOf(c))) : this;
    let villainRange = villain instanceof Range ? villain : Array.isArray(villain) && villain.length === 2 && villain.every(c => isValidConcreteCard(c))
      ? Range.from([villain.join('')]) : Range.from(villain);
    if (dead.length) villainRange = villainRange.withoutCards(dead.map(c => cardStringOf(c)));
    return {
      hero, villain: villainRange,
      heroIds: hero.ids, villainIds: villainRange.ids, heroWeight: hero.weights, villainWeight: villainRange.weights,
      board: boardNumbers, dead, iterations, workers: options.workers ?? false
    };
  }
}

const cardStringOf = n => 'AKQJT98765432'[12 - (n >> 2)] + 'shdc'[n & 3];

/** One side of a matchup: its range and every combo's result against the other side (indexed by combo id). */
class Side {
  // counts: poker-bitvaljs's per-hand rows by combo id (src/core/bitval-equity.js)
  constructor(range, counts) {
    this.range = range;
    this.win = counts.win;
    this.tie = counts.tie;
    this.lose = counts.lose;
    /** Equity by combo id: (win + tie / 2) / total; NaN for combos not in the range or that meet nothing. */
    this.equity = new Float64Array(COMBO_COUNT).fill(NaN);
    for (const id of range.ids) {
      const total = this.win[id] + this.tie[id] + this.lose[id];
      if (total > 0) this.equity[id] = (this.win[id] + this.tie[id] / 2) / total;
    }
  }

  /** The range's equity: each combo's counts times its weight. */
  total() {
    let win = 0, tie = 0, lose = 0;
    const weights = this.range.weights;
    for (const id of this.range.ids) {
      const w = weights[id];
      win += this.win[id] * w; tie += this.tie[id] * w; lose += this.lose[id] * w;
    }
    const total = win + tie + lose;
    return { win, tie, lose, equity: total ? (win + tie / 2) / total : null };
  }

  /** The combos with equity from min (inclusive) to max (exclusive), as a Range. */
  between(min, max = Infinity) {
    const equity = this.equity;
    return this.range.filter(id => equity[id] >= min && (max === Infinity ? true : max >= 1 ? equity[id] <= max : equity[id] < max));
  }

  above(min) { return this.between(min); }
  below(max) { return this.range.filter(id => this.equity[id] < max); }

  /** { hand: equity } for the combos that can be dealt. */
  byHand() {
    const out = {};
    for (const hand of this.range.hands()) {
      const e = this.equity[idOfAnyHand(hand)];
      if (!Number.isNaN(e)) out[hand] = e;
    }
    return out;
  }
}

/** Both ranges' per-combo equity on one board, and the range vs range reports built from it. */
export class Matchup {
  #dead;
  #iterations;
  #workers;
  #bitval;

  constructor(job, result, bitval) {
    this.board = job.board.map(cardStringOf);
    this.hero = new Side(job.hero, result.hero);
    this.villain = new Side(job.villain, result.villain);
    this.#dead = job.dead;
    this.#iterations = job.iterations;
    this.#workers = job.workers;
    this.#bitval = bitval;
  }

  // Board and dead cards, the board's classification (null preflop) and the analysis options
  #context(options = {}) {
    const blocked = new Uint8Array(52);
    for (const card of this.board) blocked[cardIndex(card)] = 1;
    for (const card of this.#dead) blocked[card] = 1;
    return {
      blocked,
      boardKey: `${this.board.join(',')}|${[...this.#dead].sort((a, b) => a - b).join(',')}`,
      classified: this.board.length >= 3 ? classifyBoard(this.board, options.street ?? null) : null,
      options: analysisOptions(options)
    };
  }

  /**
   * Equity buckets, shape, capping and effective nuts for both sides: { bands, hero, villain }. options: { bands,
   * shape: { enough, minDominant, topEnd }, nuts: { minEquity } } with the RangeManager defaults.
   */
  buckets(options = {}) {
    const { blocked, boardKey, classified, options: opts } = this.#context(options);
    const hero = sideOf(this.hero), villain = sideOf(this.villain);
    const summary = side => sideSummary(side, opts);
    const heroSummary = summary(hero), villainSummary = summary(villain);
    heroSummary.capped = cappedOf(hero, villain, classified && classified.score, blocked, opts.topEnd, boardKey);
    villainSummary.capped = cappedOf(villain, hero, classified && classified.score, blocked, opts.topEnd, boardKey);
    heroSummary.nuts = nutsOf(hero, opts.nutsMinEquity);
    villainSummary.nuts = nutsOf(villain, opts.nutsMinEquity);
    return { bands: opts.bands, hero: heroSummary, villain: villainSummary };
  }

  /**
   * The full range vs range report, as RangeManager's compare(): both sides' buckets, shape, capping and nuts;
   * advantages (range, nut, polarization, per band and hand class); hand classes and flags side by side (postflop);
   * the book's flop averages with the default bands. Same options as buckets(), plus { street }.
   */
  compare(options = {}) {
    const { blocked, boardKey, classified, options: opts } = this.#context(options);
    return compareReport({
      hero: sideOf(this.hero), villain: sideOf(this.villain), classified, blocked, boardKey,
      boardCards: this.board, options: opts
    });
  }

  /**
   * Compares hero's range with a reference range against the same villain and board: combos in common, missing and
   * extra, weighted overlap, both ranges' summaries (buckets, shape, capping) and the earth mover's distance between
   * their equity distributions. One more poker-bitvaljs call, for the reference's equity.
   */
  async compareTo(reference, options = {}) {
    const ref = this.#reference(reference);
    return this.#compareToWith(ref, await handEquity(this.#bitval, this.#referenceJob(ref)), options);
  }

  /** compareTo() synchronously, from poker-bitvaljs's compareRangeHandsSync. */
  compareToSync(reference, options = {}) {
    const ref = this.#reference(reference);
    return this.#compareToWith(ref, handEquitySync(this.#bitval, this.#referenceJob(ref)), options);
  }

  #reference(reference) {
    return Range.from(reference, { dead: this.#dead.map(cardStringOf) });
  }

  // The reference against the same villain, board and dead cards
  #referenceJob(ref) {
    return {
      heroIds: ref.ids, villainIds: this.villain.range.ids, heroWeight: ref.weights, villainWeight: this.villain.range.weights,
      board: this.board, dead: this.#dead, iterations: this.#iterations, workers: this.#workers
    };
  }

  #compareToWith(ref, result, options) {
    const { blocked, boardKey, classified, options: opts } = this.#context(options);
    const mine = this.hero.range;
    const refSide = sideOf(new Side(ref, result.hero));
    const mySide = sideOf(this.hero);
    const villain = sideOf(this.villain);
    const rangeSummary = sideSummary(mySide, opts);
    const referenceSummary = sideSummary(refSide, opts);
    rangeSummary.capped = cappedOf(mySide, villain, classified && classified.score, blocked, opts.topEnd, boardKey);
    referenceSummary.capped = cappedOf(refSide, villain, classified && classified.score, blocked, opts.topEnd, boardKey);
    const a = mine.weights, b = ref.weights;
    let shared = 0, union = 0;
    const common = [], missing = [], extra = [];
    for (let id = COMBO_COUNT - 1; id >= 0; id--) {
      shared += Math.min(a[id], b[id]);
      union += Math.max(a[id], b[id]);
      if (a[id] > 0 && b[id] > 0) common.push(id);
      else if (b[id] > 0) missing.push(id);
      else if (a[id] > 0) extra.push(id);
    }
    const asRange = ids => Range.fromIds(ids, ids.map(id => (a[id] > 0 ? a[id] : b[id])));
    return {
      combos: { range: mine.size, reference: ref.size },
      common: asRange(common), missing: asRange(missing), extra: asRange(extra),
      overlap: union ? shared / union : 1,
      equity: { range: rangeSummary.equity, reference: referenceSummary.equity },
      buckets: { range: rangeSummary, reference: referenceSummary },
      distance: earthMoversDistance(equityPairs(mySide), equityPairs(refSide))
    };
  }
}

// A Side as the reports take it: ids (strongest card first, as Range#hands), weights and per-combo results
function sideOf(side) {
  const ids = Array.from(side.range.ids).reverse();
  return { ids, weight: side.range.weights, win: side.win, tie: side.tie, lose: side.lose, equity: side.equity };
}

/**
 * A board classified once: every combo's poker-extval flags, made-hand strength (10 royal flush ... 1 high card)
 * and score (higher wins, equal ties), indexed by combo id.
 */
export class Board {
  constructor(cards, street, classified, FLAGS, layout) {
    this.classified = classified;
    this.cards = cards;
    this.street = street;
    this.lo = classified.lo;
    this.hi = classified.hi;
    this.strength = classified.strength;
    this.score = classified.score;
    this.blocked = classified.blocked;
    this.FLAGS = FLAGS;
    this.layout = layout;
  }

  /** options.street: 'flop' | 'turn' | 'river' (default: from the number of cards). */
  static async from(cards, options = {}) {
    await loadExtVal();
    return Board.fromSync(cards, options);
  }

  /** Board.from() after `await ready()`. */
  static fromSync(cards, options = {}) {
    const { extval } = loaded('extval');
    if (!Array.isArray(cards) || cards.length < 3 || cards.length > 5) throw new Error('A board has 3 to 5 cards');
    const normalized = cards.map(card => {
      if (!isValidConcreteCard(card)) throw new Error(`Invalid board card: ${card}`);
      return card[0].toUpperCase() + card[1].toLowerCase();
    });
    if (new Set(normalized).size !== normalized.length) throw new Error('Board cards must be unique');
    const classified = classifyBoard(normalized, options.street ?? null);
    return new Board(normalized, options.street ?? null, classified, extval.FLAGS, flagLayout(extval));
  }

  /** Whether combo id holds a flag ('isTopPair', or a criterion name such as 'Top Pair'). */
  has(id, flag) {
    const name = criterionFlag(flag);
    if (this.FLAGS[name] === undefined) throw new Error(`Unknown flag: ${flag}`);
    return hasFlagAt(this.layout, this, id, name);
  }

  /** The combos of the range holding any of the criteria (all of them with { all: true }). */
  matching(range, criteria, { all = false } = {}) {
    const list = (Array.isArray(criteria) ? criteria : [criteria]).map(criterionFlag);
    for (const flag of list) {
      if (!VALID_CRITERIA.has(flag) && this.FLAGS[flag] === undefined) throw new Error(`Invalid criteria: ${flag}`);
    }
    const middling = list.includes('isMiddlingPair');
    const flags = list.filter(flag => flag !== 'isMiddlingPair');
    const { lo, hi } = flagMasks(this.layout, flags);
    const isMiddling = id => hasFlagAt(this.layout, this, id, 'isMiddlePair') && COMBO_LO[id] >> 2 === COMBO_HI[id] >> 2;
    return range.filter(id => {
      if (this.blocked[id]) return false;
      if (all) return flags.every(flag => hasFlagAt(this.layout, this, id, flag)) && (!middling || isMiddling(id));
      return (this.lo[id] & lo) !== 0 || (this.hi[id] & hi) !== 0 || (middling && isMiddling(id));
    });
  }

  /**
   * Each combo of the range in exactly one hand class (Modern Poker Theory's order), as RangeManager's
   * handClasses(): { total, weight, classes: { name: { count, weight, share, combos } } }. options: { highCards }.
   */
  handClasses(range, options = {}) {
    return handClassesOf(Array.from(range.ids).reverse(), range.weights, this.classified, options);
  }

  /** Every flag the range's combos hold, as RangeManager's breakdown(): { total, weight, flags }. */
  breakdown(range) {
    return breakdownOf(Array.from(range.ids).reverse(), range.weights, this.classified);
  }

  /** The range's combos that can be dealt, strongest made hand first (combo ids). */
  rank(range) {
    const ids = [...range.ids].filter(id => !this.blocked[id]);
    return ids.sort((a, b) => this.score[b] - this.score[a]);
  }

  /**
   * The strongest share of the range by weight. options.ties: 'keep' (default) keeps every combo tied with the last
   * one taken, so the result can exceed the share by the whole tied group; 'split' gives each tied combo the same
   * fraction of its weight, so the result holds exactly the share.
   */
  strongest(range, share, options = {}) { return this.#take(range, share, true, options.ties ?? 'keep'); }

  /** The weakest share of the range by weight; options.ties as in strongest(). */
  weakest(range, share, options = {}) { return this.#take(range, share, false, options.ties ?? 'keep'); }

  #take(range, share, top, ties) {
    if (ties !== 'keep' && ties !== 'split') throw new Error(`ties must be 'keep' or 'split', got ${ties}`);
    const ranked = this.rank(range);
    if (!top) ranked.reverse();
    const w = range.weights;
    const target = share * ranked.reduce((sum, id) => sum + w[id], 0);
    if (ranked.length === 0 || target <= 1e-12) return range.filter(() => false);
    let cumulative = 0, cutoff = this.score[ranked[ranked.length - 1]];
    for (const id of ranked) {
      cumulative += w[id];
      if (cumulative >= target - 1e-9) { cutoff = this.score[id]; break; }
    }
    const beyond = id => (top ? this.score[id] > cutoff : this.score[id] < cutoff);
    if (ties === 'keep') return range.filter(id => !this.blocked[id] && (beyond(id) || this.score[id] === cutoff));
    let above = 0, group = 0;
    for (const id of ranked) {
      if (beyond(id)) above += w[id];
      else if (this.score[id] === cutoff) group += w[id];
    }
    const factor = Math.min(1, (target - above) / group);
    const out = new Float64Array(w.length);
    for (const id of ranked) {
      if (beyond(id)) out[id] = w[id];
      else if (this.score[id] === cutoff) out[id] = w[id] * factor;
    }
    return new Range(out);
  }
}

