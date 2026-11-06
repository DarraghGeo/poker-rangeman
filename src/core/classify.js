// A board classified once by poker-extval's core: every combo's flag words (lo, hi), made-hand strength
// (10 royal flush ... 1 high card), score (higher wins, equal ties) and, on demand, its best five cards. Cached per
// board and street. Needs poker-extval loaded (load.js).

import { COMBO_COUNT, COMBO_LO, COMBO_HI, cardIndex } from './cards.js';
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
      pairs = new Uint8Array(COMBO_COUNT * 2);
      for (let id = 0; id < COMBO_COUNT; id++) { pairs[id * 2] = COMBO_LO[id]; pairs[id * 2 + 1] = COMBO_HI[id]; }
    }
    const core = extval.board(board, street ? { street } : undefined);
    const all = core.classifyAll(pairs);
    const fives = new Map();
    classified = {
      key,
      cards: board.map(cardIndex),
      lo: all.lo, hi: all.hi, strength: all.strength, score: all.score, blocked: all.blocked,
      layout: flagLayout(extval),
      /** The combo's best five cards (card numbers). */
      five(id) {
        let five = fives.get(id);
        if (!five) {
          five = core.classify([COMBO_LO[id], COMBO_HI[id]]).five.map(card => (typeof card === 'number' ? card : cardIndex(card)));
          fives.set(id, five);
        }
        return five;
      }
    };
    if (cache.size >= 64) cache.delete(cache.keys().next().value);
    cache.set(key, classified);
  }
  return classified;
}
