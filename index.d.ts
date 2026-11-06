// Type definitions for poker-rangeman

import type {
  Evaluation as ExtvalEvaluation,
  Flag as ExtvalFlag,
  MadeHand,
  Street,
  VillainRange
} from 'poker-extval';

export type { MadeHand, Street, VillainRange };

/** A card: a rank (A, K, Q, J, T, 9-2) followed by a suit (s, h, d, c), e.g. 'Ah'. */
export type Card = string;

/** An exact two-card hand, e.g. 'AhKd'. Hands are stored high card first; pairs with suits in c, d, h, s order. */
export type Hand = string;

/**
 * Range notation ('AA,KQs,JTo', 'AT+', 'KXs', 'AhXs', with optional weights 'AA:0.5,AhKh:0.25'), an array of
 * exact hands ('AhKh', 'AhKh:0.5', ['AhKh', 0.4], { hand: 'AhKh', weight: 0.4 }), or an object of weights ({ AhKh: 0.4, QQ: 1 }).
 * A weight is 0 to 1; 0 removes the hand. Later entries override earlier ones.
 */
export type RangeInput = string | Array<Hand | string | [Hand, number] | { hand: Hand; weight?: number }> | Record<string, number>;

/** A dead card, exact ('Ah') or a wildcard ('Ax' every ace, 'Xh' every heart). */
export type DeadCard = string;

/** Flags from poker-extval, plus isMiddlingPair: a pocket pair between the highest and lowest board cards. */
export type Flag = ExtvalFlag | 'isMiddlingPair';

/** Display names accepted as criteria, mapped to flags. */
export type CriterionName =
  | 'Pair' | 'Two Pair' | 'Three of a Kind' | 'Straight' | 'Flush' | 'Full House'
  | 'Four of a Kind' | 'Straight Flush' | 'Royal Flush' | 'High Card'
  | 'Top Pair' | 'Middle Pair' | 'Bottom Pair'
  | 'Overpair' | 'Over Pair' | 'Underpair' | 'Under Pair' | 'Middling Pair'
  | 'Top And Middle Pair' | 'Top And Bottom Pair' | 'Middle And Bottom Pair'
  | 'Top Three Of A Kind' | 'Middle Three Of A Kind' | 'Bottom Three Of A Kind'
  | 'Flush Draw' | 'Backdoor Flush Draw' | 'Open Ended Straight Draw' | 'Inside Straight Draw'
  | 'Straight Draw' | 'Combo Draw'
  | 'Straight Wheel' | 'Open Ended Straight Draw Wheel' | 'Inside Straight Draw Wheel'
  | 'Overcard' | 'Two Overcards' | 'Overcard And Middle Card' | 'Overcard And Undercard'
  | 'Two Middle Cards' | 'Middle And Undercard' | 'Two Undercards';

/** A criterion: a display name, a flag, or 'isOverpair' (the earlier name of isOverPair). */
export type Criterion = CriterionName | Flag | 'isOverpair';

/** One 5-card evaluation from poker-extval, with isMiddlingPair added. */
export type Evaluation = ExtvalEvaluation & {
  isMiddlingPair: boolean;
  keyCards: Record<Flag, Card[]>;
  kickerCards: Record<Flag, Card[]>;
};

/** Evaluations keyed by 5-card hand. Strict mode has exactly one key. */
export type EvaluationResult = Record<string, Evaluation>;

export interface EvaluationOptions {
  /** Only the strongest made hand when true (default); every 5-card combination when false. */
  strict?: boolean;
  /** Overrides the street inferred from the card count, which decides which draws can still complete. */
  street?: Street | null;
  /** When true, a made hand that uses no hole card (e.g. AK "making" a pair on 8-8-3) does not count. */
  excludeBoardPlays?: boolean;
}

/** The legacy positional `strict` flag, or an options object. */
export type EvaluationOptionsArg = boolean | EvaluationOptions;

/** A share from 0 to 1, or a percentage string such as '80%'. */
export type Share = number | `${number}%`;

/** Villain's range: notation, exact hands, two cards (['Ah', 'Kd']) or another RangeManager. */
export type Villain = RangeInput | [Card, Card] | RangeManager;

export interface EquityOptions {
  /** Extra cards out of play, added to the range's dead cards. Wildcards allowed. */
  deadCards?: DeadCard[];
  /** Monte Carlo samples per matchup, used preflop only. Default 10000. */
  iterations?: number;
}

export interface EquityResult {
  win: number;
  tie: number;
  lose: number;
  /** (win + tie / 2) / total, or null if no matchup was possible. */
  equity: number | null;
}

export interface RankedHand {
  hand: Hand;
  /** The made hand, e.g. 'isFlush'. */
  category: MadeHand;
  /** 10 (royal flush) down to 1 (high card). */
  strength: number;
  /** [strength, ...tiebreak ranks]; compare element by element, the higher array wins. */
  rank: number[];
  /** The same order as one integer (poker-bitvaljs's evaluateSuits): higher beats lower, equal values tie. */
  value: number;
  /** The hand's combo weight (1 unless weighted). */
  weight: number;
}

/** An equity band: hands with at least `min` equity against villain (and below the next band up). */
export interface Band {
  name: string;
  min: number;
}

/** 'acevedo' (default: Strong >= 75%, Good >= 50%, Weak >= 33%, Trash), 'quartiles', or custom bands. */
export type BandsOption = 'acevedo' | 'quartiles' | Array<{ name: string; min: Share }>;

export interface AgainstOptions extends EquityOptions {
  bands?: BandsOption;
  shape?: {
    /** The share at which an end of the range counts as fully present in the shape scores. Default 0.1. */
    enough?: Share;
    /** The score a shape needs to be named dominant. Default 0.5. */
    minDominant?: Share;
    /** The strongest share of combos that counts as the top end for capping. Default 0.05. */
    topEnd?: Share;
  };
  /** minEquity: the equity against the other range a hand needs to count as effective nuts. Default 0.9. */
  nuts?: { minEquity?: Share };
}

/** The villain, board and bands set by against() / getEquity(). */
export interface Matchup {
  villainHands: Hand[];
  /** Villain combos whose weight isn't 1. */
  villainWeights: Record<Hand, number>;
  /** Weights of the range at against() time. */
  parentWeights: Record<Hand, number>;
  board: Card[];
  deadCards: Card[];
  iterations: number;
  key: string;
  bands: Band[];
  shapeEnough: number;
  minDominant: number;
  topEnd: number;
  nutsMinEquity: number;
  /** The range at against() time, which later filters choose from. */
  parentHands: Hand[];
}

export interface BucketStats {
  count: number;
  /** Total combo weight. */
  weight: number;
  /** Share of the side's live combo weight (combos that can be dealt). */
  share: number;
  combos: Hand[];
}

/**
 * The three competing range shapes, each 0 to 1. polarized is the Bhatia-Davis ratio of each hand's equity;
 * linear and condensed come from the density (share / band width) of the range in the top
 * band (T), the bands between (M) and the bottom band (B), compared with an even spread. hollow(part, than) =
 * 1 - part / than. enough(x) = min(1, x / shape.enough), default 10%. Independent: they need not add up to 1.
 * See README "Range shape".
 */
export interface Shape {
  /**
   * Var(e) / (mean(e) x (1 - mean(e))) over each hand's equity e against villain (weighted). 1 = perfectly
   * polarized (every hand 0% or 100%), 0 = every hand the same equity. No bands involved.
   */
  polarized: number;
  /** enough(T) x hollow(bottom, middle) x contiguity: the top, then medium hands, no gaps. */
  linear: number;
  /** hollow(thicker end, middle): the top and bottom removed. */
  condensed: number;
  /** The highest of the three, or null when all are 0. */
  dominant: 'polarized' | 'linear' | 'condensed' | null;
  /** Share of the hands in the top N of the range at against() (N = their count); 1 = no gaps. */
  contiguity: number;
  /** T, M and B themselves. */
  top: number;
  middle: number;
  bottom: number;
  /** Share / band width for each part: 1 = as many hands as an even spread across equity. */
  density: { top: number; middle: number; bottom: number };
  /** Mean and standard deviation of the hands' equity (weighted), behind polarized. */
  equity: { mean: number; sd: number };
}

export interface SideSummary {
  combos: number;
  /** Total live combo weight. */
  weight: number;
  equity: number | null;
  buckets: Record<string, BucketStats>;
  /** null when no hand can be dealt. */
  shape: Shape | null;
  /** How much of the top end the range is missing, 0 to 1 (null preflop). Describes the top, separate from the shape. */
  capped: Capped;
  /** Effective nuts: the range's combos with at least nuts.minEquity (default 90%) equity against the other range. */
  nuts: { count: number; weight: number; share: number | null };
}

/**
 * Capping from made hands on the board. relative: the top end is the strongest 5% (shape.topEnd) of both ranges'
 * combos, against the range's share of all their combos. absolute: the top end is the strongest 5% of every combo
 * that can be dealt on the board, against a random range. 0 = holds at least its fair share, 1 = holds none.
 */
export interface Capped {
  relative: number | null;
  absolute: number | null;
}

/** Hand classes, each combo in exactly one, in Modern Poker Theory's order. */
export type HandClass =
  | 'straightFlush' | 'quads' | 'fullHouse' | 'flush' | 'straight' | 'set' | 'trips' | 'twoPair'
  | 'overpair' | 'topPair' | 'pocketPair12' | 'secondPair' | 'pocketPair23' | 'thirdPair' | 'pocketPair34'
  | 'fourthPair' | 'pocketPair45' | 'bottomPair' | 'underpair'
  | 'flushDraw' | 'oesd' | 'gutshot' | 'aceHigh' | 'kingHigh' | 'air';

export interface HandClassesResult {
  /** Combos that can be dealt on the board. */
  total: number;
  /** Total combo weight. */
  weight: number;
  /** Every class, shares (by weight) adding up to 1. */
  classes: Record<HandClass, { count: number; weight: number; share: number; combos: Hand[] }>;
}

export interface HandClassesOptions extends StreetOptions {
  /** Default true. false counts ace-high and king-high as air (the book's Ch. 1 breakdown). */
  highCards?: boolean;
}

export interface SideBySide {
  hero: number;
  villain: number;
  heroCount: number;
  villainCount: number;
}

export interface BucketsReport {
  bands: Band[];
  hero: SideSummary;
  villain: SideSummary;
}

export interface ReferenceAverages {
  source: string;
  bigBlind: Record<'strong' | 'good' | 'weak' | 'trash', number>;
  inPosition: Record<'strong' | 'good' | 'weak' | 'trash', number>;
}

export interface ComparisonReport extends BucketsReport {
  board: Card[];
  /** Each hero minus villain. */
  advantage: Advantage;
  /** Each combo in exactly one class, so each side's shares add up to 1 (null preflop). */
  handClasses: Record<HandClass, SideBySide> | null;
  /** Share of each side holding each poker-extval flag; a combo can hold several (null preflop). Most common first. */
  flags: Record<string, SideBySide> | null;
  /** Modern Poker Theory's flop averages, with the default bands only. */
  reference: ReferenceAverages | null;
}

export interface Advantage {
  /** Equity: Modern Poker Theory's "range vs range equity advantage". */
  range: number | null;
  /** Share of effective nuts (90%+ equity): "the effective nut hands make up a larger portion of his range". */
  nut: number | null;
  /** shape.polarized, hero minus villain. */
  polarization: number | null;
  /** Share of each equity band; positive = hero has more of it (not necessarily better, e.g. trash). */
  bands: Record<string, number>;
  /** Share of each hand class, e.g. air; positive = hero has more of it. null preflop. */
  classes: Record<HandClass, number> | null;
}

export interface CompareToReport {
  combos: { range: number; reference: number };
  common: Hand[];
  /** In the reference only. */
  missing: Hand[];
  /** In this range only. */
  extra: Hand[];
  notation: { common: string; missing: string; extra: string };
  /** common / union, 0 to 1. */
  overlap: number;
  /** The following need against() first, otherwise null. */
  equity: { range: number | null; reference: number | null } | null;
  buckets: { range: SideSummary; reference: SideSummary } | null;
  /** Earth mover's distance between the two equity distributions: 0 = same shape. */
  distance: number | null;
}

export interface BetOptions {
  pot: number;
  bet: number;
}

export interface BettingMath {
  /** bet / (pot + bet): how often a bluff must work. */
  alpha: number;
  /** pot / (pot + bet). */
  mdf: number;
  /** bet / (pot + 2 bet): equity a call needs. */
  potOdds: number;
  /** Bluff share of a balanced river betting range (equals potOdds). */
  bluffShare: number;
  /** Value combos per bluff: (pot + bet) / bet. */
  valueToBluff: number;
}

export interface DefendOptions extends BetOptions {
  /** 'equity' (default): equity x realization >= pot odds. 'mdf': the strongest MDF share. */
  by?: 'equity' | 'mdf';
  /** Default 1. Modern Poker Theory: about 0.9 out of position, 1.1 in position. */
  realization?: number;
}

export interface BluffOptions extends BetOptions {
  /** Band(s) counted as value. Default: the top band. */
  value?: string | string[];
}

export interface StreetOptions {
  street?: Street | null;
}

export interface Breakdown {
  /** Hands counted (hands sharing a card with the board are left out). */
  total: number;
  /** Total combo weight. */
  weight: number;
  /** Every flag held by at least one hand, most common first. Shares are by weight. */
  flags: Partial<Record<Flag, { count: number; weight: number; share: number; combos: Hand[] }>>;
}

export interface EvaluationQuery {
  /** Evaluations matching any of the criteria. */
  is(criteria: Criterion | Criterion[]): EvaluationResult;
  /** Evaluations matching all of the criteria. */
  isAll(criteria: Criterion | Criterion[]): EvaluationResult;
}

/** Methods that return a range; on a RangeQuery they queue another step and return a RangeQuery. */
type ChainedRangeMethods = {
  [K in 'exclude' | 'include' | 'intersect' | 'scale' | 'setWeight' | 'hasSuit' | 'suitedOf' | 'setDeadCards' | 'hasKicker' | 'hasKeyCard'
    | 'makesHand' | 'hitsHand' | 'hitsHandBoth' | 'getEquity' | 'strongest' | 'weakest'
    | 'against' | 'bucket' | 'defend' | 'bluffCandidates']:
    (...args: Parameters<RangeManager[K]>) => RangeQuery;
};

/** Methods that return a value; on a RangeQuery they return a Promise of the value. */
type ChainedValueMethods = {
  [K in 'toArray' | 'getHands' | 'size' | 'contains' | 'toNotation' | 'getKeyCards' | 'normalizeNotation'
    | 'handContainsDeadCard' | 'handHasSuit' | 'handSuitedOf' | 'evaluateHand' | 'getObject'
    | 'equity' | 'equityByHand' | 'rankHands' | 'breakdown' | 'blockers'
    | 'bandsByHand' | 'buckets' | 'compare' | 'compareTo' | 'bettingMath' | 'handClasses'
    | 'weights' | 'weightOf' | 'weightedSize' | 'isWeighted']:
    (...args: Parameters<RangeManager[K]>) => Promise<Awaited<ReturnType<RangeManager[K]>>>;
};

/**
 * A pending range from an async filter. Await it (or use then/catch/finally) for the RangeManager.
 * Range methods chain another step; value methods return a Promise of the value. toString is not overridden.
 */
export interface RangeQuery extends Promise<RangeManager>, ChainedRangeMethods, ChainedValueMethods {
  // Overloaded, so declared here (a mapped type would keep only the last overload)
  equityAbove(min: Share, villain?: Villain, boardCards?: Card[], options?: EquityOptions): RangeQuery;
  equityBelow(max: Share, villain?: Villain, boardCards?: Card[], options?: EquityOptions): RangeQuery;
  equityBetween(min: Share, max: Share, villain?: Villain, boardCards?: Card[], options?: EquityOptions): RangeQuery;
}
export const RangeQuery: {
  new (promise: RangeManager | PromiseLike<RangeManager>): RangeQuery;
  readonly prototype: RangeQuery;
};

export class RangeManager {
  constructor(input: RangeInput, deadCards?: DeadCard[]);

  readonly rawInput: RangeInput;
  /** Dead cards, wildcards expanded. */
  deadCards: Card[];
  /** Every hand parsed from the input. */
  hands: Hand[];
  /** The hands currently in the range. */
  filteredHands: Hand[];
  /** Weights of hands whose weight isn't 1 (hands not listed weigh 1). */
  handWeights: Record<Hand, number>;
  lastBoardCards: Card[] | null;
  lastHandStrength: Flag[] | null;
  lastStrict: boolean | null;
  lastStreet: Street | null;
  /** Per-hand equity stored by getEquity() / against(), or null. */
  handEquity: Record<Hand, EquityResult> | null;
  /** The villain, board and bands set by against() / getEquity(), or null. */
  matchup: Matchup | null;

  normalizeNotation(notation: string): string;

  // Filtering (each returns a new instance)
  /** Removes hands, or with weights scales each by (1 - weight). */
  exclude(input: RangeInput | DeadCard[] | RangeManager): RangeManager;
  /** Adds hands; a hand in both keeps the higher weight. */
  include(input: RangeInput | RangeManager): RangeManager;
  /** Keeps hands in both; weights multiply. */
  intersect(input: RangeInput | RangeManager): RangeManager;

  // Combo weights
  /** Every hand's weight, including those at 1. */
  weights(): Record<Hand, number>;
  /** A hand's weight (0 if not in the range). */
  weightOf(hand: Hand): number;
  /** Sum of the weights. */
  weightedSize(): number;
  isWeighted(): boolean;
  /** Multiplies every weight by factor (capped at 1; 0 empties the range). */
  scale(factor: number): RangeManager;
  /** Sets the weight of the given hands that are in the range (0 removes them). */
  setWeight(input: RangeInput, weight: number): RangeManager;
  hasSuit(suit: string): RangeManager;
  suitedOf(suit: string): RangeManager;
  setDeadCards(deadCards: DeadCard[]): RangeManager;
  handContainsDeadCard(hand: Hand, deadCards: DeadCard[]): boolean;
  handHasSuit(hand: Hand, suit: string): boolean;
  handSuitedOf(hand: Hand, suit: string): boolean;

  // Board evaluation (async: returns a chainable RangeQuery)
  makesHand(criteria: Criterion[], boardCards: Card[], options?: EvaluationOptionsArg): RangeQuery;
  hitsHand(criteria: Criterion[], boardCards: Card[], options?: EvaluationOptionsArg): RangeQuery;
  hitsHandBoth(criteria: Criterion[], boardCards: Card[], options?: EvaluationOptionsArg): RangeQuery;
  evaluateHand(hand: Hand, boardCards: Card[], options?: EvaluationOptionsArg): Promise<EvaluationQuery>;
  getObject(hand: Hand, boardCards: Card[], options?: EvaluationOptionsArg): Promise<EvaluationResult>;
  hasKicker(cards: DeadCard[], and?: boolean, handStrength?: Criterion | null): RangeManager;
  hasKeyCard(cards: DeadCard[], and?: boolean, handStrength?: Criterion | null): RangeManager;
  getKeyCards(handStrength?: Criterion | null): Card[];

  // Equity (board: [] preflop, or 3-5 cards)
  /** Runs equity once per hand and stores it on the returned range for the equity filters. */
  getEquity(villain: Villain, boardCards?: Card[], options?: AgainstOptions): RangeQuery;
  /** With no arguments, totals the equity stored by getEquity(). */
  equity(villain?: Villain, boardCards?: Card[], options?: EquityOptions): Promise<EquityResult>;
  /** With no arguments, the equity stored by getEquity(). */
  equityByHand(villain?: Villain, boardCards?: Card[], options?: EquityOptions): Promise<Record<Hand, EquityResult>>;
  /** Filters on the equity stored by getEquity(). */
  equityAbove(min: Share): RangeManager;
  /** 3.6.0 form: runs getEquity(villain, boardCards, options) first. */
  equityAbove(min: Share, villain: Villain, boardCards?: Card[], options?: EquityOptions): RangeQuery;
  equityBelow(max: Share): RangeManager;
  equityBelow(max: Share, villain: Villain, boardCards?: Card[], options?: EquityOptions): RangeQuery;
  equityBetween(min: Share, max: Share): RangeManager;
  equityBetween(min: Share, max: Share, villain: Villain, boardCards?: Card[], options?: EquityOptions): RangeQuery;

  // Range vs range analysis
  /** Sets villain and board (and equity bands), runs hero's equity once. Same as getEquity(). */
  against(villain: Villain, boardCards?: Card[], options?: AgainstOptions): RangeQuery;
  /** Each hand's band against villain (null when it cannot be dealt). */
  bandsByHand(): Record<Hand, string | null>;
  /** Hands in the named band(s). */
  bucket(...names: Array<string | string[]>): RangeManager;
  /** Band shares, equity and shape for both sides. */
  buckets(): Promise<BucketsReport>;
  /** Full range vs range report. */
  compare(): Promise<ComparisonReport>;
  /** Compare with a reference range; equity, buckets and distance after against(). */
  compareTo(reference: RangeInput | RangeManager): Promise<CompareToReport>;
  bettingMath(options: BetOptions): BettingMath;
  /** As the defender facing villain's bet: the hands that continue. */
  defend(options: DefendOptions): RangeManager;
  /** As the bettor: bluffs to pair with the value hands at this bet size. */
  bluffCandidates(options: BluffOptions): RangeQuery;

  // Strength, breakdown and blockers (board: 3-5 cards)
  rankHands(boardCards: Card[], options?: StreetOptions): Promise<RankedHand[]>;
  strongest(portion: Share, boardCards: Card[], options?: StreetOptions): RangeQuery;
  weakest(portion: Share, boardCards: Card[], options?: StreetOptions): RangeQuery;
  breakdown(boardCards: Card[], options?: StreetOptions): Promise<Breakdown>;
  /** Each combo in exactly one hand class on the board; shares add up to 1. */
  handClasses(boardCards: Card[], options?: HandClassesOptions): Promise<HandClassesResult>;
  blockers(boardCards: Card[], heroCards?: Hand | [Card, Card] | null, options?: StreetOptions): Promise<VillainRange>;

  // Queries
  toArray(): Hand[];
  getHands(): Hand[];
  size(): number;
  contains(hand: Hand): boolean;
  toString(): string;
  toNotation(): string;
}

// The core API (also 'poker-rangeman/core'): ranges as typed arrays, boards classified once, per-combo equity
export { Range, Board, ready, terminateWorkers, setWorkerUrl } from './core.js';
export type { Side, VsOptions, RangeSource, ComboId } from './core.js';
