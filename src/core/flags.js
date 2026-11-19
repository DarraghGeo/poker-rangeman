// Where poker-extval's core keeps each flag. Its board().classifyAll packs an evaluation's flags into two words
// (lo, hi); the layout is poker-extval's own, so it is read through its hasFlag() once instead of assumed.

const layouts = new WeakMap();

/**
 * { names, word, bit, index } for the loaded poker-extval: names in evaluation order, and for each flag name the
 * word (0 = lo, 1 = hi) and bit mask that hold it.
 */
export function flagLayout(extval) {
  let layout = layouts.get(extval.FLAGS);
  if (!layout) {
    const names = Object.keys(extval.FLAGS);
    const word = {}, bit = {};
    for (const name of names) {
      const flag = extval.FLAGS[name];
      for (let b = 0; b < 32 && word[name] === undefined; b++) {
        const mask = 1 << b;
        if (extval.hasFlag(mask, 0, flag)) { word[name] = 0; bit[name] = mask; }
        else if (extval.hasFlag(0, mask, flag)) { word[name] = 1; bit[name] = mask; }
      }
      if (word[name] === undefined) throw new Error(`poker-extval flag ${name} has no bit`);
    }
    layout = { names, word, bit };
    layouts.set(extval.FLAGS, layout);
  }
  return layout;
}

/** Whether combo `id` of a classified board holds the flag. */
export function hasFlagAt(layout, classified, id, name) {
  return ((layout.word[name] ? classified.hi[id] : classified.lo[id]) & layout.bit[name]) !== 0;
}

/** Bit masks over (lo, hi) for any of the flags. */
export function flagMasks(layout, names) {
  const masks = { lo: 0, hi: 0 };
  for (const name of names) {
    if (layout.word[name]) masks.hi |= layout.bit[name]; else masks.lo |= layout.bit[name];
  }
  return masks;
}
