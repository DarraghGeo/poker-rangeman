import { BOARD_TEXTURE_SCALES } from '../src/boardTextureScales.js';
import { computeTextureScales, formatScales, suitDistinctBoards } from '../scripts/board-texture-scales.js';
import { readFileSync } from 'node:fs';

describe('board texture scaling constants', () => {
  test('there are 1755, 16432 and 134459 suit-distinct boards of 3, 4 and 5 cards', () => {
    expect([3, 4, 5].map(size => suitDistinctBoards(size).length)).toEqual([1755, 16432, 134459]);
  });

  // Reruns the whole script (about a minute on one core; split across worker threads)
  test('the stored constants match the script output', async () => {
    const scales = await computeTextureScales();
    expect(scales).toEqual(BOARD_TEXTURE_SCALES);
    const stored = readFileSync(new URL('../src/boardTextureScales.js', import.meta.url), 'utf8');
    expect(formatScales(scales)).toBe(stored);
  }, 600000);
});
