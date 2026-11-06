// Worker entry: runs a slice of an equity job (see pool.js) and sends back the counts.
import { listen, reply } from '#pool-backend';
import { rangeEquity } from './equity.js';
import { loadBitVal } from './load.js';

listen(async ({ id, job }) => {
  try {
    const result = rangeEquity(await loadBitVal(), job);
    const arrays = [result.hero.win, result.hero.tie, result.hero.lose];
    if (result.villain) arrays.push(result.villain.win, result.villain.tie, result.villain.lose);
    reply({ id, result }, arrays.map(a => a.buffer));
  } catch (error) {
    reply({ id, error: error.message });
  }
});
