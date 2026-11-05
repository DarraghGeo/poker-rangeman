// Type-checked by `npm run test:types`; not executed.
import { RangeManager } from 'poker-rangeman';
import type { EquityResult, RankedHand, Breakdown, VillainRange, EvaluationResult, Hand } from 'poker-rangeman';

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

  const ranked: RankedHand[] = await rm.rankHands(board);
  const top: RangeManager = await rm.strongest('20%', board, { street: 'river' });
  const bottom: RangeManager = await rm.weakest(0.1, board);
  const breakdown: Breakdown = await rm.breakdown(board);
  const pairs: number | undefined = breakdown.flags.isPair?.count;
  const blockers: VillainRange = await rm.blockers(board, ['Ah', 'Js']);
  const unblocked: string[] = blockers.allBlocks.unblocked;

  const notation: string = top.toNotation();
  const size: number = bottom.size();
  void [keyCards, middling, uses, total, byHand, above, between, ranked, pairs, unblocked, notation, size];
}

void check;

// @ts-expect-error: criteria must be known names or flags
new RangeManager('AA').makesHand(['Bogus'], ['Kh', '9h', '4d']);
// @ts-expect-error: a share is a number or a percentage string
new RangeManager('AA').equityAbove('eighty', 'KK');
