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

/** Range notation ('AA,KQs,JTo', 'AT+', 'KXs', 'AhXs') or an array of exact hands. */
export type RangeInput = string | Hand[];

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
  /** enough: the share at which an end of the range counts as fully present in the shape scores (default 0.1). */
  shape?: { enough?: Share };
}

/** The villain, board and bands set by against() / getEquity(). */
export interface Matchup {
  villainHands: Hand[];
  board: Card[];
  deadCards: Card[];
  iterations: number;
  key: string;
  bands: Band[];
  shapeEnough: number;
  /** The range at against() time, which later filters choose from. */
  parentHands: Hand[];
}

export interface BucketStats {
  count: number;
  /** Share of the side's live combos (those that can be dealt). */
  share: number;
  combos: Hand[];
}

/**
 * The three competing range shapes, each 0 to 1, from the shares of the range in the top band (T), the bottom
 * band (B) and the bands between (M). enough(x) = min(1, x / shape.enough), default 10%. Independent: they need
 * not add up to 1. See README "Range shape".
 */
export interface Shape {
  /** enough(T) x enough(B) x B / (M + B): both ends, no middle. */
  polarized: number;
  /** enough(T) x M / (M + B) x contiguity: the top, then medium hands, no gaps. */
  linear: number;
  /** M x (1 - enough(T)): medium hands without the top. */
  condensed: number;
  /** The highest of the three, or null when all are 0. */
  dominant: 'polarized' | 'linear' | 'condensed' | null;
  /** Share of the hands in the top N of the range at against() (N = their count); 1 = no gaps. */
  contiguity: number;
  /** T, M and B themselves. */
  top: number;
  middle: number;
  bottom: number;
}

export interface SideSummary {
  combos: number;
  equity: number | null;
  buckets: Record<string, BucketStats>;
  /** null when no hand can be dealt. */
  shape: Shape | null;
  /** How much of the top is missing, 1 - enough(T): describes the top, separate from the shape. */
  capped: number | null;
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
  /** Hero equity minus villain equity. */
  rangeAdvantage: number | null;
  /** Hero's top-band share minus villain's. */
  nutAdvantage: number;
  /** Share of each side holding each flag (null preflop), most common first. */
  handClasses: Record<string, { hero: number; villain: number; heroCount: number; villainCount: number }> | null;
  /** Modern Poker Theory's flop averages, with the default bands only. */
  reference: ReferenceAverages | null;
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
  /** Every flag held by at least one hand, most common first. */
  flags: Partial<Record<Flag, { count: number; share: number; combos: Hand[] }>>;
}

export interface EvaluationQuery {
  /** Evaluations matching any of the criteria. */
  is(criteria: Criterion | Criterion[]): EvaluationResult;
  /** Evaluations matching all of the criteria. */
  isAll(criteria: Criterion | Criterion[]): EvaluationResult;
}

/** Methods that return a range; on a RangeQuery they queue another step and return a RangeQuery. */
type ChainedRangeMethods = {
  [K in 'exclude' | 'include' | 'intersect' | 'hasSuit' | 'suitedOf' | 'setDeadCards' | 'hasKicker' | 'hasKeyCard'
    | 'makesHand' | 'hitsHand' | 'hitsHandBoth' | 'getEquity' | 'strongest' | 'weakest'
    | 'against' | 'bucket' | 'defend' | 'bluffCandidates']:
    (...args: Parameters<RangeManager[K]>) => RangeQuery;
};

/** Methods that return a value; on a RangeQuery they return a Promise of the value. */
type ChainedValueMethods = {
  [K in 'toArray' | 'getHands' | 'size' | 'contains' | 'toNotation' | 'getKeyCards' | 'normalizeNotation'
    | 'handContainsDeadCard' | 'handHasSuit' | 'handSuitedOf' | 'evaluateHand' | 'getObject'
    | 'equity' | 'equityByHand' | 'rankHands' | 'breakdown' | 'blockers'
    | 'bandsByHand' | 'buckets' | 'compare' | 'compareTo' | 'bettingMath']:
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
  exclude(input: RangeInput | DeadCard[]): RangeManager;
  include(input: RangeInput): RangeManager;
  intersect(input: RangeInput): RangeManager;
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
  blockers(boardCards: Card[], heroCards?: Hand | [Card, Card] | null, options?: StreetOptions): Promise<VillainRange>;

  // Queries
  toArray(): Hand[];
  getHands(): Hand[];
  size(): number;
  contains(hand: Hand): boolean;
  toString(): string;
  toNotation(): string;
}
