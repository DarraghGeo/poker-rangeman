// A board classified once by poker-extval's core: every combo's flag words (lo, hi), made-hand strength
// (10 royal flush ... 1 high card), score (higher wins, equal ties) and, on demand, whether its made hand uses a hole
// card and its key and kicker cards. Cached per board and street. Needs poker-extval 6.0.0-beta.5+ loaded (load.js).

import { COMBO_COUNT, HAND_STRINGS, cardIndex } from './cards.js';
import { loaded } from './load.js';
import { flagLayout } from './flags.js';

const cache = new Map();
let pairs = null;

/** board: normalized card strings ('Ah'); street: 'flop' | 'turn' | 'river' | null. */
export function classifyBoard(board, street = null) {
  const key = `${board.join(',')}|${street ?? ''}`;
  let classified = cache.get(key);
  if (!classified) {
    const { extval } = loaded('extval');
    if (!pairs) {
      // Hole cards in the order of the hand strings ('AhKd'), the order RangeManager passes to evaluateHand, so key
      // and kicker card lists match it exactly
      pairs = new Uint8Array(COMBO_COUNT * 2);
      for (let id = 0; id < COMBO_COUNT; id++) {
        pairs[id * 2] = cardIndex(HAND_STRINGS[id].slice(0, 2));
        pairs[id * 2 + 1] = cardIndex(HAND_STRINGS[id].slice(2, 4));
      }
    }
    const core = extval.board(board, street ? { street } : undefined);
    const all = core.classifyAll(pairs);
    classified = {
      key,
      cards: board.map(cardIndex),
      lo: all.lo, hi: all.hi, strength: all.strength, score: all.score, blocked: all.blocked,
      layout: flagLayout(extval),
      /** Whether the combo's made hand uses a hole card (poker-extval's usesHoleCards). */
      usesHoleCards: id => all.usesHoleCards(id),
      /** The combo's key cards, every flag's or one flag's, as evaluateHand([...board, ...hole]) gives them. */
      keyCards: (id, flag) => all.keyCards(id, flag),
      /** The combo's kicker cards, likewise. */
      kickerCards: (id, flag) => all.kickerCards(id, flag)
    };
    if (cache.size >= 64) cache.delete(cache.keys().next().value);
    cache.set(key, classified);
  }
  return classified;
}
