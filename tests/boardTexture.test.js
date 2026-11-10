import { RangeManager } from '../src/rangeManager.js';
import { loadEvaluator, rawTexture } from '../src/boardTexture.js';
import { BOARD_TEXTURE_SCALES } from '../src/boardTextureScales.js';

const boardTexture = (board, dead) => RangeManager.boardTexture(board, dead);
const SCORES = ['suitedness', 'pairedness', 'height', 'connectedness', 'wetness', 'dynamism'];

const expectScoresInRange = texture => {
  for (const name of SCORES) {
    const score = texture.scores[name];
    if (name === 'dynamism' && texture.board.length === 5) {
      expect(score).toBeNull();
      continue;
    }
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  }
};

describe('RangeManager.boardTexture', () => {
  test('is a static async method returning the report', async () => {
    const pending = RangeManager.boardTexture(['Jh', 'Th', '9c']);
    expect(pending).toBeInstanceOf(Promise);
    const texture = await pending;
    expect(texture.board).toEqual(['Jh', 'Th', '9c']);
    expect(texture.suits).toBe('twoTone');
    expect(texture.pairing).toBe('unpaired');
    expect(texture.highCard).toBe('J');
    expect(texture.combos).toBe(1176);
  });

  test('normalizes card case', async () => {
    const texture = await RangeManager.boardTexture(['jh', 'tH', '9C']);
    expect(texture.board).toEqual(['Jh', 'Th', '9c']);
  });

  test.each([
    [['Ah', 'Kd'], /3, 4 or 5/],
    [['Ah', 'Kd', 'Qs', 'Jc', 'Th', '9d'], /3, 4 or 5/],
    [['Ah', 'Ah', 'Kd'], /unique/],
    [['Ah', 'Zz', 'Kd'], /Invalid board card/],
    ['AhKdQs', /array/]
  ])('rejects board %p', async (board, message) => {
    await expect(RangeManager.boardTexture(board)).rejects.toThrow(message);
  });

  test('rejects dead cards on the board and invalid dead cards', async () => {
    await expect(RangeManager.boardTexture(['Ah', 'Kd', '2c'], ['Ah'])).rejects.toThrow(/board/);
    await expect(RangeManager.boardTexture(['Ah', 'Kd', '2c'], ['Zz'])).rejects.toThrow(/Invalid card/);
    await expect(RangeManager.boardTexture(['Ah', 'Kd', '2c'], 'Qs')).rejects.toThrow(/array/);
  });

  test('null dead cards mean none, as in the constructor', async () => {
    expect((await RangeManager.boardTexture(['Ah', 'Kd', '2c'], null)).combos).toBe(1176);
  });

  test('a wildcard dead card skips the board cards it covers', async () => {
    // 'Ax' on an ace-high board means the other three aces
    const texture = await RangeManager.boardTexture(['Ah', 'Kd', '2c'], ['Ax']);
    expect(texture.combos).toBe(46 * 45 / 2);
  });

  test('wetness: JhTh9c > Ks7d2c', async () => {
    const wet = await boardTexture(['Jh', 'Th', '9c']);
    const dry = await boardTexture(['Ks', '7d', '2c']);
    expect(wet.scores.wetness).toBeGreaterThan(dry.scores.wetness);
    expect(wet.scores.connectedness).toBeGreaterThan(dry.scores.connectedness);
  });

  test('suitedness: monotone 1, two-tone 0.5, rainbow 0', async () => {
    const monotone = await boardTexture(['Kh', '7h', '2h']);
    const twoTone = await boardTexture(['Kh', '7h', '2c']);
    const rainbow = await boardTexture(['Kh', '7d', '2c']);
    expect(monotone.scores.suitedness).toBe(1);
    expect(twoTone.scores.suitedness).toBe(0.5);
    expect(rainbow.scores.suitedness).toBe(0);
    expect([monotone.suits, twoTone.suits, rainbow.suits]).toEqual(['monotone', 'twoTone', 'rainbow']);
  });

  test('pairedness: unpaired 0 < paired 0.5 < trips 1', async () => {
    const unpaired = await boardTexture(['Kh', '7d', '2c']);
    const paired = await boardTexture(['Kh', 'Kd', '2c']);
    const trips = await boardTexture(['Kh', 'Kd', 'Kc']);
    expect(unpaired.scores.pairedness).toBe(0);
    expect(paired.scores.pairedness).toBe(0.5);
    expect(trips.scores.pairedness).toBe(1);
    expect([unpaired.pairing, paired.pairing, trips.pairing]).toEqual(['unpaired', 'paired', 'trips']);
  });

  test('pairedness reaches 1 on quads (4 cards) and a full house or quads (5 cards)', async () => {
    const quads4 = await boardTexture(['Kh', 'Kd', 'Kc', 'Ks']);
    const fullHouse = await boardTexture(['Kh', 'Kd', 'Kc', '2s', '2h']);
    const quads5 = await boardTexture(['Kh', 'Kd', 'Kc', 'Ks', '2h']);
    expect(quads4.scores.pairedness).toBe(1);
    expect(fullHouse.scores.pairedness).toBe(1);
    expect(quads5.scores.pairedness).toBe(1);
    expect([quads4.pairing, fullHouse.pairing, quads5.pairing]).toEqual(['quads', 'fullHouse', 'quads']);
    const twoPair = await boardTexture(['Kh', 'Kd', '7c', '7s']);
    expect(twoPair.pairing).toBe('twoPair');
    expect(twoPair.scores.pairedness).toBeCloseTo(2 / 3, 10);
  });

  test('height: deuces 0, aces 1', async () => {
    expect((await boardTexture(['2h', '2d', '2c'])).scores.height).toBe(0);
    expect((await boardTexture(['Ah', 'Ad', 'Ac', 'As'])).scores.height).toBe(1);
    expect((await boardTexture(['Ah', '8d', '2c'])).scores.height).toBe(0.5);
  });

  test('dynamism: 7s4d2c > AsAd7c (dry but dynamic)', async () => {
    const dynamic = await boardTexture(['7s', '4d', '2c']);
    const staticBoard = await boardTexture(['As', 'Ad', '7c']);
    expect(dynamic.scores.dynamism).toBeGreaterThan(staticBoard.scores.dynamism);
    // 7-4-2 is not wet, so dynamism is not a copy of wetness
    const wet = await boardTexture(['Jh', 'Th', '9c']);
    expect(dynamic.scores.wetness).toBeLessThan(wet.scores.wetness);
  });

  test('dynamism is null on a 5-card board', async () => {
    const texture = await boardTexture(['Ks', '7d', '2c', '9h', '4s']);
    expect(texture.scores.dynamism).toBeNull();
    expect(texture.raw.dynamism).toBeNull();
  });

  test('turn: a four-flush scores higher on suitedness and wetness than a rainbow turn', async () => {
    const fourFlush = await boardTexture(['Kh', '7h', '2h', '9h']);
    const rainbow = await boardTexture(['Kh', '7d', '2c', '9s']);
    expect(fourFlush.suits).toBe('fourFlush');
    expect(rainbow.suits).toBe('rainbow');
    expect(fourFlush.scores.suitedness).toBe(1);
    expect(rainbow.scores.suitedness).toBe(0);
    expect(fourFlush.scores.wetness).toBeGreaterThan(rainbow.scores.wetness);
  });

  test('turn: the same orderings hold on 4 cards', async () => {
    const wet = await boardTexture(['Jh', 'Th', '9c', '8d']);
    const dry = await boardTexture(['Ks', '7d', '2c', '2h']);
    expect(wet.scores.wetness).toBeGreaterThan(dry.scores.wetness);
    expect(wet.scores.connectedness).toBeGreaterThan(dry.scores.connectedness);
    const paired = await boardTexture(['Kh', 'Kd', '7c', '2s']);
    const unpaired = await boardTexture(['Kh', 'Qd', '7c', '2s']);
    expect(paired.scores.pairedness).toBeGreaterThan(unpaired.scores.pairedness);
    const dynamic = await boardTexture(['7s', '4d', '2c', '3h']);
    const staticBoard = await boardTexture(['As', 'Ad', '7c', '7h']);
    expect(dynamic.scores.dynamism).toBeGreaterThan(staticBoard.scores.dynamism);
  });

  test('river: the same orderings hold on 5 cards', async () => {
    const fiveFlush = await boardTexture(['Kh', '7h', '2h', '9h', '4h']);
    const fourFlush = await boardTexture(['Kh', '7h', '2h', '9h', '4c']);
    const twoTone = await boardTexture(['Kh', '7h', '2c', '9d', '4s']);
    expect(fiveFlush.suits).toBe('fiveFlush');
    expect(fourFlush.suits).toBe('fourFlush');
    expect(fiveFlush.scores.suitedness).toBe(1);
    expect(fourFlush.scores.suitedness).toBe(0.75);
    expect(twoTone.scores.suitedness).toBe(0.25);
    expect(fourFlush.scores.wetness).toBeGreaterThan(twoTone.scores.wetness);
    const connected = await boardTexture(['Jh', 'Th', '9c', '8d', '2s']);
    const dry = await boardTexture(['Ks', '7d', '2c', '2h', 'Kd']);
    expect(connected.scores.connectedness).toBeGreaterThan(dry.scores.connectedness);
    expect(connected.scores.wetness).toBeGreaterThan(dry.scores.wetness);
  });

  test('every score stays between 0 and 1 at each size', async () => {
    const boards = [
      ['Jh', 'Th', '9c'], ['Ks', '7d', '2c'], ['2h', '2d', '2c'], ['Ah', 'Kh', 'Qh'], ['5s', '4s', '3s'],
      ['Jh', 'Th', '9c', '8h'], ['Ks', 'Kd', 'Kc', 'Kh'], ['Ah', 'Kh', 'Qh', 'Jh'], ['7s', '4d', '2c', '2h'],
      ['Jh', 'Th', '9c', '8h', '7h'], ['Ks', 'Kd', 'Kc', 'Kh', 'Ah'], ['As', 'Ks', 'Qs', 'Js', 'Ts'], ['7s', '4d', '2c', '9h', 'Kd']
    ];
    for (const board of boards) expectScoresInRange(await boardTexture(board));
  });

  test('scores stay between 0 and 1 with dead cards', async () => {
    const texture = await boardTexture(['Jh', 'Th', '9c'], ['Qh', 'Qd', 'Qc', 'Qs', '8h', '8d', '8c', '8s']);
    expectScoresInRange(texture);
  });

  test('suit-isomorphic boards give the same results', async () => {
    const a = await boardTexture(['Jh', 'Th', '9c']);
    const b = await boardTexture(['Ts', '9d', 'Js']);
    const { board: boardA, ...restA } = a;
    const { board: boardB, ...restB } = b;
    expect(boardA).not.toEqual(boardB);
    expect(restB).toEqual(restA);
    const c = await boardTexture(['Kh', '8h', '8d', '3c']);
    const d = await boardTexture(['8s', '3h', 'Ks', '8c']);
    const { board: boardC, ...restC } = c;
    const { board: boardD, ...restD } = d;
    expect(restD).toEqual(restC);
  });

  test('counts: combos, straights, draws and made hands', async () => {
    const texture = await boardTexture(['Jh', 'Th', '9c']);
    expect(texture.combos).toBe(1176);
    // 7-J, 8-Q, 9-K straights need two hole cards at most; T-A needs Q-K-A, three cards; 6-T needs 6-7-8
    // Straights: 7-8-9-T-J, 8-9-T-J-Q, 9-T-J-Q-K
    expect(texture.straights).toBe(3);
    // Two of the 11 remaining hearts
    expect(texture.flushDraws).toBe(55);
    const dry = await boardTexture(['Ks', '7d', '2c']);
    expect(dry.straights).toBe(0);
    expect(dry.flushDraws).toBe(0);
    // No five-rank window holds two of K, 7 and 2, so two hole cards can't make four to a straight
    expect(dry.straightDraws).toBe(0);
    expect(texture.straightDraws).toBeGreaterThan(0);
    // Two pair or better on K-7-2 rainbow: sets (3 x 3), two pair (3 x 3 x 3), no straights or flushes
    expect(dry.madeHands).toBe(9 + 27);
  });

  test('a draw counts when the hand would beat the straight the board makes with that card', async () => {
    // On J-T-9-8 a queen gives everyone 8-Q, but a king in the hand then makes 9-K: K-x draws, 2-2 does not.
    // Without a 7 or Q (those are made straights): 4 kings x 36 other cards + 6 K-K combos
    const texture = await boardTexture(['Jh', 'Th', '9c', '8d']);
    expect(texture.straightDraws).toBe(4 * 36 + 6);
  });

  test('a flush that beats a five-card flush board counts as a made hand', async () => {
    // Every hand holding one of the 8 remaining hearts makes a higher flush: 1081 - C(39, 2)
    const texture = await boardTexture(['Kh', '7h', '2h', '9h', '4h']);
    expect(texture.madeHands).toBe(1081 - 741);
    // On K-K-7-7-2 the board's own two pair doesn't count, nor a better kicker. Full houses do: any hand
    // with one of the two kings or two sevens left (1081 - C(43, 2)), plus the 3 combos of 2-2. So does a
    // pocket pair above the sevens, which makes a better two pair: 8-8 to A-A but not K-K, 6 ranks x 6
    const twoPair = await boardTexture(['Ks', 'Kd', '7c', '7h', '2s']);
    expect(twoPair.madeHands).toBe(1081 - 903 + 3 + 36);
    // Likewise on K-K-7-7: full houses (1128 - C(44, 2)) and the 36 higher pocket pairs
    const turn = await boardTexture(['Ks', 'Kd', '7c', '7h']);
    expect(turn.madeHands).toBe(1128 - 946 + 36);
  });

  test('board cards and dead cards are left out of every count', async () => {
    const board = ['Jh', 'Th', '9c'];
    const plain = await boardTexture(board);
    const dead = await boardTexture(board, ['Qh', '2s']);
    // 52 - 3 - 2 = 47 cards left
    expect(dead.combos).toBe(47 * 46 / 2);
    // Dead Qh removes the Qh flush-draw combos and a heart from every count
    expect(dead.flushDraws).toBe(45);
    expect(dead.flushDraws).toBeLessThan(plain.flushDraws);
    await loadEvaluator();
    const raw = rawTexture(board, ['Qh', '2s']);
    expect(raw.combos).toBe(dead.combos);
    // Wildcard dead cards expand like the constructor's
    const allQueens = await boardTexture(board, ['Qx']);
    expect(allQueens.combos).toBe(45 * 44 / 2);
    // Without any queen, 8-Q and 9-K straights are gone; only 7-J is left
    expect(allQueens.straights).toBe(1);
  });

  test('a draw needs a live card to complete it', async () => {
    // With every queen and seven dead, J-T-2 has no straight left to draw to
    const noStraights = await boardTexture(['Jh', 'Th', '2c'], ['Qx', '7x']);
    expect(noStraights.straights).toBe(0);
    expect(noStraights.straightDraws).toBe(0);
    // With every other heart but the ace and deuce dead, Ah2h has four hearts and no heart to come
    const noHearts = await boardTexture(['Kh', '7h', '2c'], ['3h', '4h', '5h', '6h', '8h', '9h', 'Th', 'Jh', 'Qh']);
    expect(noHearts.flushDraws).toBe(0);
  });

  test('raw values are the unscaled shares and mean change', async () => {
    const texture = await boardTexture(['Jh', 'Th', '9c']);
    for (const key of ['connectedness', 'wetness', 'dynamism']) {
      expect(texture.raw[key]).toBeGreaterThan(0);
      expect(texture.raw[key]).toBeLessThan(1);
    }
    const { min, max } = BOARD_TEXTURE_SCALES[3].wetness;
    expect(texture.scores.wetness).toBeCloseTo((texture.raw.wetness - min) / (max - min), 12);
  });

  test('a report takes under ~200 ms on each board size', async () => {
    await boardTexture(['Jh', 'Th', '9c']);
    for (const board of [['Jh', 'Th', '9c'], ['Jh', 'Th', '9c', '2d'], ['Jh', 'Th', '9c', '2d', '2s']]) {
      const start = performance.now();
      await boardTexture(board);
      expect(performance.now() - start).toBeLessThan(200);
    }
  });
});
