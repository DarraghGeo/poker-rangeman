// poker-rangeman core: ranges as typed arrays, boards classified once, per-combo equity for both sides.
export { Range, Board, Matchup } from './range.js';
export { ready } from './load.js';
export { terminateWorkers, setWorkerUrl, AUTO_WORK } from './pool.js';
export { rangeEquity, runoutCount } from './equity.js';
export { COMBO_COUNT, HAND_STRINGS, CARD_STRINGS, cardIndex, cardString, idOfHand, idOfAnyHand, comboOf } from './cards.js';
export { parseWeighted, normalizeNotation, normalizeHand, weightedNotation } from './notation.js';
export { CRITERIA_MAPPING, criterionFlag } from './criteria.js';
