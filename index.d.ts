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

  // Board evaluation
  makesHand(criteria: Criterion[], boardCards: Card[], options?: EvaluationOptionsArg): Promise<RangeManager>;
  hitsHand(criteria: Criterion[], boardCards: Card[], options?: EvaluationOptionsArg): Promise<RangeManager>;
  hitsHandBoth(criteria: Criterion[], boardCards: Card[], options?: EvaluationOptionsArg): Promise<RangeManager>;
  evaluateHand(hand: Hand, boardCards: Card[], options?: EvaluationOptionsArg): Promise<EvaluationQuery>;
  getObject(hand: Hand, boardCards: Card[], options?: EvaluationOptionsArg): Promise<EvaluationResult>;
  hasKicker(cards: DeadCard[], and?: boolean, handStrength?: Criterion | null): RangeManager;
  hasKeyCard(cards: DeadCard[], and?: boolean, handStrength?: Criterion | null): RangeManager;
  getKeyCards(handStrength?: Criterion | null): Card[];

  // Equity (board: [] preflop, or 3-5 cards)
  equity(villain: Villain, boardCards?: Card[], options?: EquityOptions): Promise<EquityResult>;
  equityByHand(villain: Villain, boardCards?: Card[], options?: EquityOptions): Promise<Record<Hand, EquityResult>>;
  equityAbove(min: Share, villain: Villain, boardCards?: Card[], options?: EquityOptions): Promise<RangeManager>;
  equityBelow(max: Share, villain: Villain, boardCards?: Card[], options?: EquityOptions): Promise<RangeManager>;
  equityBetween(min: Share, max: Share, villain: Villain, boardCards?: Card[], options?: EquityOptions): Promise<RangeManager>;

  // Strength, breakdown and blockers (board: 3-5 cards)
  rankHands(boardCards: Card[], options?: StreetOptions): Promise<RankedHand[]>;
  strongest(portion: Share, boardCards: Card[], options?: StreetOptions): Promise<RangeManager>;
  weakest(portion: Share, boardCards: Card[], options?: StreetOptions): Promise<RangeManager>;
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
