// hitsHand / hitsHandBoth and the key-card lookups read poker-extval's core; they must match evaluateHand with the
// board first (the order the core classifies in), card for card.
import { RangeManager } from '../src/rangeManager.js';

const RANKS = 'AKQJT98765432', SUITS = 'shdc';
const DECK = [...RANKS].flatMap(r => [...SUITS].map(s => r + s));
const WIDE = '22+,A2s+,K2s+,Q2s+,J2s+,T2s+,92s+,82s+,72s+,62s+,52s+,42s+,32s,A2o+,K2o+,Q5o+,J7o+,T7o+,97o+,86o+,76o,65o';
const CRITERIA = [['Straight'], ['Straight Draw'], ['Flush Draw', 'Backdoor Flush Draw'], ['Top Pair', 'Middling Pair'], ['Two Pair', 'Three of a Kind'],
  ['Open Ended Straight Draw', 'Inside Straight Draw'], ['Pair'], ['Combo Draw'], ['Straight Wheel'], ['Full House', 'Flush']];

function rng(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

// The reference: evaluateHand with the board first, criteria and key cards as RangeManager defines them
async function expected(hands, board, criteria, minHandCards, options) {
  const { evaluateHand } = await import('poker-extval');
  const flags = criteria.map(c => new RangeManager('AA')._toCriterionKey(c));
  const made = new Set(['isRoyalFlush', 'isStraightFlush', 'isFourOfAKind', 'isFullHouse', 'isFlush', 'isStraight', 'isThreeOfAKind', 'isTwoPair', 'isPair', 'isHighCard']);
  return hands.filter(hand => {
    const cards = [hand.slice(0, 2), hand.slice(2)];
    if (cards.some(c => board.includes(c))) return false;
    const [e] = Object.values(evaluateHand([...board, ...cards], { strict: true, holeCards: cards, street: options.street }));
    return flags.some(flag => {
      const middling = flag === 'isMiddlingPair';
      const f = middling ? 'isMiddlePair' : flag;
      if (!e[f] || (middling && hand[0] !== hand[2])) return false;
      if (options.excludeBoardPlays && made.has(flag) && e.usesHoleCards === false) return false;
      return cards.filter(c => e.keyCards[f].includes(c)).length >= minHandCards;
    });
  });
}

describe('key cards from the core', () => {
  it('hitsHand and hitsHandBoth match evaluateHand (board first) on random spots', async () => {
    const random = rng(21);
    let checked = 0;
    for (let i = 0; i < 60; i++) {
      const deck = [...DECK].sort(() => random() - 0.5);
      const board = deck.slice(0, 3 + (i % 3));
      const criteria = CRITERIA[i % CRITERIA.length];
      const options = { strict: true, street: i % 7 === 0 ? 'river' : undefined, excludeBoardPlays: i % 5 === 0 };
      const range = new RangeManager(WIDE);
      expect((await range.hitsHand(criteria, board, options)).toArray()).toEqual(await expected(range.toArray(), board, criteria, 1, options));
      expect((await range.hitsHandBoth(criteria, board, options)).toArray()).toEqual(await expected(range.toArray(), board, criteria, 2, options));
      checked++;
    }
    expect(checked).toBe(60);
  });

  it('getKeyCards and hasKicker after makesHand match evaluateHand (board first)', async () => {
    const { evaluateHand } = await import('poker-extval');
    const board = ['Ah', 'Jd', '7c', '4s'];
    const made = await new RangeManager(WIDE).makesHand(['Top Pair'], board);
    const keys = new Set();
    for (const hand of made.toArray()) {
      const cards = [hand.slice(0, 2), hand.slice(2)];
      const [e] = Object.values(evaluateHand([...board, ...cards], { strict: true, holeCards: cards }));
      e.keyCards.isTopPair.forEach(c => keys.add(c));
    }
    expect(made.getKeyCards()).toEqual([...keys].sort());
    const withKing = made.hasKicker(['Kx']).toArray();
    expect(withKing.length).toBeGreaterThan(0);
    for (const hand of made.toArray()) {
      const cards = [hand.slice(0, 2), hand.slice(2)];
      const [e] = Object.values(evaluateHand([...board, ...cards], { strict: true, holeCards: cards }));
      expect(withKing.includes(hand)).toBe(e.kickerCards.isTopPair.some(c => c[0] === 'K'));
    }
  });
});
