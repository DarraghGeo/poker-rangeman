// Scenarios run both in Node and, bundled, in a browser (tests/browser/run.mjs); their results must match.
// Everything returned is plain JSON.
export async function scenarios({ RangeManager, Range, Board, ready }) {
  const opener = '66+,A9s+,KTs+,QTs+,JTs,T9s,ATo+,KJo+';
  const defender = '22-88,A2s-A8s,K9s,Q9s+,J9s+,T8s+,97s+,87s,76s,A9o-AJo,KTo-KQo,QJo';
  const flop = ['Ad', '7c', '6h'];
  const turn = [...flop, '2s'];
  const round = x => (typeof x === 'number' ? Math.round(x * 1e9) / 1e9 : x);
  const out = {};

  const rm = new RangeManager('AA,KK:0.5,AKs,AxKh,Xh2c:0.25');
  out.notation = rm.toNotation();
  out.weights = rm.weights();
  out.makesHand = (await new RangeManager(opener).makesHand(['Top Pair', 'Overpair'], flop)).toNotation();
  out.hitsHand = (await new RangeManager(opener).hitsHand(['Flush Draw'], ['Ah', '7h', '2c'])).toNotation();
  out.ranked = (await new RangeManager(opener).rankHands(turn)).slice(0, 5).map(r => [r.hand, r.category, r.value]);
  const spot = await new RangeManager(opener).against(defender, turn);
  const report = await spot.compare();
  out.compare = JSON.parse(JSON.stringify(report, (k, v) => round(v)));
  out.equity = await new RangeManager(opener).equity(defender, flop);

  const hero = Range.from(opener);
  const single = await hero.vs(defender, flop, { workers: false });
  const pooled = await hero.vs(defender, flop, { workers: true });
  out.coreTotal = single.hero.total();
  out.coreVillainTotal = single.villain.total();
  out.workersMatch = Array.from(single.hero.win).every((w, i) => w === pooled.hero.win[i])
    && Array.from(single.villain.tie).every((t, i) => t === pooled.villain.tie[i]);
  // Preflop is Monte Carlo: compare a rounded estimate
  out.preflop = Math.round((await Range.from('AA,KK').vs('QQ', [], { iterations: 20000 })).hero.total().equity * 50) / 50;
  // Synchronous twins (poker-bitvaljs's compareRangeHandsSync) after ready(): same as the async results
  await ready();
  out.syncMatches = JSON.stringify(new RangeManager(opener).againstSync(defender, turn).compareSync()) === JSON.stringify(report)
    && JSON.stringify(Range.from(opener).vsSync(defender, flop).hero.total()) === JSON.stringify(out.coreTotal);
  const board = await Board.from(turn);
  out.board = [board.matching(hero, ['Pair']).toNotation(), board.strongest(hero, 0.25).toNotation()];
  return out;
}
