// Types for poker-rangeman/core (also exported from 'poker-rangeman').

/** A card: rank (A K Q J T 9-2) and suit (s h d c), e.g. 'Ah'. */
export type Card = string;
/** A card or a wildcard: 'Ax' (every ace), 'Xh' (every heart). */
export type DeadCard = string;
/** An exact two-card hand, e.g. 'AhKd'. */
export type Hand = string;
/** A combo id, 0 to 1325. */
export type ComboId = number;
/** A share from 0 to 1, or a percentage string such as '80%'. */
export type Share = number | `${number}%`;

/**
 * Range notation ('AA,KQs:0.5,AxKh'), an array of exact hands ('AhKh', 'AhKh:0.4', ['AhKh', 0.4],
 * { hand: 'AhKh', weight: 0.4 }), or an object of weights ({ AhKh: 0.4 }).
 */
export type RangeSource = string | Array<Hand | [Hand, number] | { hand: Hand; weight?: number }> | Record<Hand, number>;

export interface VsOptions {
  /** Cards out of play; combos holding one are removed from both ranges. */
  dead?: DeadCard[];
  /** Boards sampled preflop (default 10000). Postflop every runout is counted. */
  iterations?: number;
  /** Preflop sampling seed, for reproducible results. */
  seed?: number;
  /**
   * Worker threads: false (none), true (all but one core), a count, or undefined (automatic: used only for jobs of
   * about AUTO_WORK combo evaluations or more, such as preflop runs; small jobs run on this thread).
   */
  workers?: boolean | number;
}

/** An immutable weighted range. Every method returns a new Range. */
export class Range {
  /** Takes ownership of a Float64Array(1326) of weights by combo id. Prefer Range.from(). */
  constructor(weights: Float64Array);
  static from(input: RangeSource | Range, options?: { dead?: DeadCard[] }): Range;
  /** Combo ids, weight 1 (or weights[i]). */
  static fromIds(ids: ArrayLike<ComboId>, weights?: ArrayLike<number> | null): Range;

  /** Weight by combo id (0 = not in the range). Don't modify it. */
  readonly weights: Float64Array;
  /** The combo ids in the range, ascending. */
  readonly ids: Uint16Array;
  readonly size: number;
  readonly weightedSize: number;
  readonly isWeighted: boolean;

  has(hand: Hand | ComboId): boolean;
  weightOf(hand: Hand | ComboId): number;
  hands(): Hand[];
  toObject(): Record<Hand, number>;
  /** Abbreviated notation with weights, e.g. 'QQ+,AKs:0.5'. */
  toNotation(): string;
  /** Every hand class written out, e.g. 'QQ,KK,AA,AKs'. */
  toClassNotation(): string;
  toString(): string;

  /** Adds combos; a combo in both keeps the larger weight. */
  include(input: RangeSource | Range): Range;
  /** Removes that share of each combo. */
  exclude(input: RangeSource | Range): Range;
  /** Keeps combos in both, weights multiplied. */
  intersect(input: RangeSource | Range): Range;
  scale(factor: number): Range;
  setWeight(input: RangeSource | Range, weight: number): Range;
  filter(fn: (id: ComboId, weight: number) => boolean): Range;
  withoutCards(cards: DeadCard[]): Range;
  withSuit(suit: string): Range;
  suitedOf(suit: string): Range;

  /** Every combo's equity against villain, both sides, in one pass. */
  vs(villain: RangeSource | Range | [Card, Card], board?: Card[] | Board, options?: VsOptions): Promise<Matchup>;
  /** vs() on this thread, after `await ready()`. */
  vsSync(villain: RangeSource | Range | [Card, Card], board?: Card[] | Board, options?: Omit<VsOptions, 'workers'>): Matchup;
}

export interface EquityTotal {
  win: number;
  tie: number;
  lose: number;
  equity: number | null;
}

/** One side of a matchup; arrays are indexed by combo id. */
export interface Side {
  readonly range: Range;
  /** Weighted runout counts against the other side. */
  readonly win: Float64Array;
  readonly tie: Float64Array;
  readonly lose: Float64Array;
  /** (win + tie / 2) / total; NaN for combos not in the range or that can't be dealt. */
  readonly equity: Float64Array;
  /** The range's equity: each combo's counts times its weight. */
  total(): EquityTotal;
  /** Combos with equity from min (inclusive) to max (exclusive; inclusive when max is 1). */
  between(min: number, max?: number): Range;
  above(min: number): Range;
  below(max: number): Range;
  byHand(): Record<Hand, number>;
}

export class Matchup {
  readonly board: Card[];
  /** Runouts counted (postflop) or boards sampled (preflop). */
  readonly runouts: number;
  readonly hero: Side;
  /** Villain's combos against hero's range. */
  readonly villain: Side;
}

/** A board classified once (poker-extval's core); arrays are indexed by combo id. */
export class Board {
  static from(cards: Card[], options?: { street?: 'flop' | 'turn' | 'river' }): Promise<Board>;
  /** Board.from() after `await ready()`. */
  static fromSync(cards: Card[], options?: { street?: 'flop' | 'turn' | 'river' }): Board;
  readonly cards: Card[];
  readonly street: 'flop' | 'turn' | 'river' | null;
  /** poker-extval flag bits: flag i is bit (i % 32) of lo (flags 0-31) or hi (32+). */
  readonly lo: Int32Array;
  readonly hi: Int32Array;
  /** 10 royal flush ... 1 high card. */
  readonly strength: Uint8Array;
  /** Higher wins, equal ties (poker-bitvaljs's evaluateSuits value). */
  readonly score: Int32Array;
  /** 1 for combos sharing a card with the board. */
  readonly blocked: Uint8Array;
  readonly FLAGS: Record<string, number>;
  /** Whether a combo holds a flag ('isTopPair', or a criterion name such as 'Top Pair'). */
  has(id: ComboId, flag: string): boolean;
  /** The range's combos holding any of the criteria (all of them with { all: true }). */
  matching(range: Range, criteria: string | string[], options?: { all?: boolean }): Range;
  /** Combo ids that can be dealt, strongest made hand first. */
  rank(range: Range): ComboId[];
  /**
   * The strongest share of the range by weight. ties: 'keep' (default) keeps every combo tied with the last one taken,
   * so the result can exceed the share by the whole tied group; 'split' gives each tied combo the same fraction of its
   * weight, so the result holds exactly the share.
   */
  strongest(range: Range, share: number, options?: { ties?: 'keep' | 'split' }): Range;
  weakest(range: Range, share: number, options?: { ties?: 'keep' | 'split' }): Range;
}

/** Loads the evaluators; afterwards Board.fromSync and Range#vsSync work. */
export function ready(): Promise<void>;
/** Stops the worker pool (it restarts on the next pooled job). */
export function terminateWorkers(): void;
/** The worker script's URL, for bundlers that don't bundle `new Worker(new URL(...))` themselves. */
export function setWorkerUrl(url: string | URL): void;
/** Combo evaluations above which `workers: undefined` uses the pool. */
export const AUTO_WORK: number;

export const COMBO_COUNT: 1326;
/** Combo id -> hand ('AhKd'; pairs 'AcAs'). */
export const HAND_STRINGS: readonly Hand[];
/** Card number (rank * 4 + suit, '2s' = 0 ... 'Ac' = 51) -> card. */
export const CARD_STRINGS: readonly Card[];
export function cardIndex(card: Card): number;
export function cardString(card: number): Card;
/** A normalized hand ('AhKd', 'AcAs') to its id, or -1. */
export function idOfHand(hand: Hand): ComboId;
/** Any two cards ('KdAh') to the combo id, or -1. */
export function idOfAnyHand(hand: string): ComboId;
export function comboOf(card1: number, card2: number): ComboId;
export function parseWeighted(input: RangeSource): { hands: Hand[]; weights: Record<Hand, number> };
export function normalizeNotation(notation: string): string;
export function normalizeHand(hand: string): Hand;
export function weightedNotation(hands: Hand[], weightOf: (hand: Hand) => number, write?: (hands: Hand[]) => string): string;
export const CRITERIA_MAPPING: Record<string, string>;
export function criterionFlag(criterion: string): string;

export interface EngineJob {
  heroIds: ArrayLike<ComboId>;
  villainIds: ArrayLike<ComboId>;
  heroWeight: Float64Array;
  villainWeight: Float64Array;
  board: number[];
  dead?: number[];
  iterations?: number;
  both?: boolean;
  seed?: number;
  from?: number;
  to?: number;
}
export interface EngineCounts { win: Float64Array; tie: Float64Array; lose: Float64Array }
/** The equity engine itself: counts aligned with heroIds (and villainIds with both). */
export function rangeEquity(bitval: unknown, job: EngineJob): { hero: EngineCounts; villain: EngineCounts | null; runouts: number };
export function runoutCount(board: number[], dead?: number[]): number;
