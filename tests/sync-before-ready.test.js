// A fresh module state (Jest isolates modules per file): the *Sync methods need `await ready()` first.
import { RangeManager, Range } from '../src/rangeManager.js';

it('sync equity methods throw before ready()', () => {
  expect(() => new RangeManager('AA').equitySync('KK', ['2c', '7d', '9h'])).toThrow('await ready()');
  expect(() => new RangeManager('AA').againstSync('KK', ['2c', '7d', '9h'])).toThrow('await ready()');
  expect(() => Range.from('AA').vsSync('KK', ['2c', '7d', '9h'])).toThrow('await ready()');
});
