// Type-checked by `npm run test:types`; not executed.
import { RangeManager, RangeQuery, Range, Board, ready } from 'poker-rangeman';
import { Range as CoreRange, terminateWorkers, idOfHand, HAND_STRINGS } from 'poker-rangeman/core';
import type { Matchup, Side } from 'poker-rangeman/core';
import type {
  EquityResult, RankedHand, Breakdown, VillainRange, EvaluationResult, Hand,
  ComparisonReport, CompareToReport, BettingMath, Shape, HandClassesResult
} from 'poker-rangeman';

async function check(): Promise<void> {
  const rm = new RangeManager('TT+,AQs+,AK', ['Ah']);
  const board = ['Kh', '9h', '4d'];

  const chained: RangeManager = rm.exclude('AKo').include(['AhKd']).setDeadCards(['Xc']).hasSuit('s');
  const made: RangeManager = await chained.makesHand(['Top Pair', 'isOverPair', 'Two Overcards'], board);
  await rm.makesHand(['Pair'], board, false);
  await rm.hitsHand(['Flush Draw'], board, { strict: true, street: 'turn', excludeBoardPlays: true });
  const kickers: RangeManager = made.hasKicker(['Qx'], false, 'Top Pair');
  const keyCards: string[] = kickers.getKeyCards();

  const evaluation: EvaluationResult = await rm.getObject('AsKs', board, { street: 'flop' });
  const middling: boolean = Object.values(evaluation)[0].isMiddlingPair;
  const uses: boolean | null = Object.values(evaluation)[0].usesHoleCards;
  (await rm.evaluateHand('AsKs', board)).is('Pair');

  const total: EquityResult = await rm.equity('QQ+', board);
  const byHand: Record<Hand, EquityResult> = await rm.equityByHand(new RangeManager('JJ'), board, { iterations: 500 });
  const above: RangeManager = await rm.equityAbove('80%', ['Qc', 'Qd'], board);
  const between: RangeManager = await (await rm.equityBetween(0.7, '90%', 'QQ', board)).equityBelow(0.85, 'QQ', board);

  // Chaining async steps with one await
  const query: RangeQuery = rm.makesHand(['Pair'], board).hasSuit('s').getEquity('QQ+', board).equityAbove('60%');
  const asPromise: Promise<RangeManager> = query;
  const chainedRange: RangeManager = await query.strongest('50%', board).exclude('AA');
  const pendingSize: Promise<number> = rm.hitsHand(['Pair'], board).size();
  const pendingEquity: Promise<EquityResult> = rm.getEquity('QQ+', board).equity();
  const withEquity: RangeManager = await rm.getEquity('QQ+', board);
  const syncFiltered: RangeManager = withEquity.equityAbove('60%').equityBelow(0.9).hasSuit('h');
  const stored: Record<Hand, EquityResult> | null = syncFiltered.handEquity;
  const storedTotal: EquityResult = await syncFiltered.equity();

  // Range vs range analysis
  const spot: RangeManager = await rm.against('QQ+,AK', board, { bands: 'quartiles', iterations: 1000 });
  const goodSpades: RangeManager = await rm.against('QQ+', board).bucket('good', 'weak').hasSuit('s');
  const report: ComparisonReport = await spot.compare();
  const nut: number | null = report.advantage.nut;
  const airAdvantage: number | undefined = report.advantage.classes?.air;
  const strongAdvantage: number | undefined = report.advantage.bands.strong;
  const nutShare: number | null = report.hero.nuts.share;
  await rm.against('QQ+', board, { nuts: { minEquity: 0.9 } });
  const polarized: number | undefined = report.hero.shape?.polarized;
  const shape: Shape | null = report.villain.shape;
  const dominant: Shape['dominant'] | undefined = report.hero.shape?.dominant;
  const capped: number | null = report.hero.capped.relative;
  const absolute: number | null = report.villain.capped.absolute;
  const air: number | undefined = report.handClasses?.air.hero;
  const topPairFlag: number | undefined = report.flags?.isTopPair?.villain;
  const classes: HandClassesResult = await rm.handClasses(board, { highCards: false });
  const setShare: number = classes.classes.set.share;
  const pendingClasses: Promise<HandClassesResult> = rm.against('QQ+', board).handClasses(board);
  await rm.against('QQ+', board, { shape: { minDominant: 0.4, topEnd: '5%' } });
  await rm.against('QQ+', board, { shape: { enough: '15%' } });
  const strongShare: number = (await spot.buckets()).villain.buckets.strong.share;
  const vsReference: CompareToReport = await spot.compareTo('TT+,AK');
  const distance: number | null = vsReference.distance;
  const math: BettingMath = spot.bettingMath({ pot: 10, bet: 5 });
  const defending: RangeManager = spot.defend({ pot: 10, bet: 5, by: 'mdf', realization: 0.9 });
  const bluffs: RangeManager = await spot.bluffCandidates({ pot: 10, bet: 7.5, value: ['strong', 'good'] });
  const bands: Record<Hand, string | null> = spot.bandsByHand();
  const custom: RangeManager = await rm.against('QQ+', board, { bands: [{ name: 'value', min: '70%' }, { name: 'rest', min: 0 }] });
  const pendingReport: Promise<ComparisonReport> = rm.against('QQ+', board).compare();

  const ranked: RankedHand[] = await rm.rankHands(board);
  const top: RangeManager = await rm.strongest('20%', board, { street: 'river' });
  const bottom: RangeManager = await rm.weakest(0.1, board);
  const breakdown: Breakdown = await rm.breakdown(board);
  const pairs: number | undefined = breakdown.flags.isPair?.count;
  const blockers: VillainRange = await rm.blockers(board, ['Ah', 'Js']);
  const unblocked: string[] = blockers.allBlocks.unblocked;

  // Combo weights
  const weighted = new RangeManager('AA,KK:0.5,AhKh:0.25');
  new RangeManager(['AhKh', 'QsQh:0.5', ['JsJh', 0.4], { hand: 'AsKs', weight: 0.25 }]);
  new RangeManager({ AhKh: 0.4, TT: 1 });
  const halved: RangeManager = weighted.scale(0.5).setWeight('AA', 0.75).include({ QsQh: 0.3 }).exclude([['KsKd', 0.5]]);
  const w: Record<Hand, number> = halved.weights();
  const one: number = halved.weightOf('AsAd') + halved.weightedSize();
  const isW: boolean = halved.isWeighted();
  const stored2: Record<Hand, number> = halved.handWeights;
  const pendingW: Promise<number> = rm.hitsHand(['Pair'], board).scale(0.5).weightedSize();
  await weighted.against('QQ+:0.5', board);
  const bucketWeight: number = (await spot.buckets()).hero.buckets.strong.weight;
  const nutWeight: number = report.hero.nuts.weight;
  const classWeight: number = classes.classes.air.weight;
  const rankedWeight: number | undefined = (await weighted.rankHands(board))[0]?.weight;
  void [w, one, isW, stored2, pendingW, bucketWeight, nutWeight, classWeight, rankedWeight];

  // Core API
  const coreHero: Range = Range.from('AA,KK:0.5', { dead: ['Ah'] }).include(['AhKh:0.5']).withSuit('s');
  const sameClass: typeof CoreRange = Range;
  const matchup: Matchup = await coreHero.vs('QQ+', board, { workers: false, seed: 1 });
  const side: Side = matchup.villain;
  const perCombo: number = matchup.hero.equity[idOfHand('AsKs')] + side.win[0];
  const strongCore: Range = matchup.hero.above(0.6).filter((id, weight) => weight > 0.5 && HAND_STRINGS[id] !== 'AsAd');
  const coreBoard: Board = await Board.from(board, { street: 'flop' });
  const topPairs: Range = coreBoard.matching(coreHero, ['Top Pair', 'isOverPair']);
  const rankedIds: number[] = coreBoard.rank(coreHero);
  const exactShare: Range = coreBoard.strongest(coreHero, 0.25, { ties: 'split' });
  const exactCompat: RangeManager = await rm.strongest('25%', board, { ties: 'split', street: 'flop' });
  // @ts-expect-error: ties is 'keep' or 'split'
  coreBoard.weakest(coreHero, 0.25, { ties: 'half' });
  void [exactShare, exactCompat];
  await ready();
  const synced: number | null = coreHero.vsSync('QQ', board).hero.total().equity;
  terminateWorkers();
  void [sameClass, perCombo, strongCore, topPairs, rankedIds, synced];

  const notation: string = top.toNotation();
  const size: number = bottom.size();
  void [keyCards, middling, uses, total, byHand, above, between, ranked, pairs, unblocked, notation, size,
    asPromise, chainedRange, pendingSize, pendingEquity, stored, storedTotal,
    goodSpades, nut, airAdvantage, strongAdvantage, nutShare, polarized, shape, dominant, capped, absolute, air, topPairFlag, setShare, pendingClasses, strongShare, distance, math, defending, bluffs, bands, custom, pendingReport];
}

void check;

// @ts-expect-error: criteria must be known names or flags
new RangeManager('AA').makesHand(['Bogus'], ['Kh', '9h', '4d']);
// @ts-expect-error: a share is a number or a percentage string
new RangeManager('AA').equityAbove('eighty', 'KK');
// @ts-expect-error: a pending chain is not a RangeManager until awaited
const notAwaited: RangeManager = new RangeManager('AA').makesHand(['Pair'], ['Kh', '9h', '4d']);
void notAwaited;
