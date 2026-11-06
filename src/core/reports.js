// Range vs range reports from per-combo arrays: equity buckets, shapes, capping, effective nuts, hand classes, flags,
// advantages and reference comparisons. Pure functions over combo ids (in the order results should list them) and
// Float64Array(1326)s indexed by combo id, shared by the core's Matchup/Board and the RangeManager API, so both
// give the same numbers. Equity comes from poker-bitvaljs (src/core/bitval-equity.js); every report here is a few
// passes over its per-hand results, at most 1,326 combos.

import { COMBO_COUNT, COMBO_LO, COMBO_HI, HAND_STRINGS, RANK_CHARS } from './cards.js';
import { hasFlagAt } from './flags.js';

// Equity buckets (hand vs range equity, highest band first; a hand belongs to the first band whose min it reaches).
// 'acevedo' is Modern Poker Theory's Equity Buckets (Ch. 10, PDF p. 597): Strong >= 75%, Good >= 50%, Weak >= 33%.
export const BAND_PRESETS = {
  acevedo: [
    { name: 'strong', min: 0.75 }, { name: 'good', min: 0.5 }, { name: 'weak', min: 0.33 }, { name: 'trash', min: 0 }
  ],
  quartiles: [
    { name: 'strong', min: 0.75 }, { name: 'good', min: 0.5 }, { name: 'weak', min: 0.25 }, { name: 'trash', min: 0 }
  ]
};

// Modern Poker Theory's average equity buckets over all 1,755 flops, BB defending against an in-position
// opener with 20-40bb MTT ranges (PDF p. 600). A point of comparison only: it describes those ranges.
export const ACEVEDO_FLOP_AVERAGES = {
  source: 'Acevedo, Modern Poker Theory, Ch. 10 (PDF p. 600): average over all 1,755 flops, BB vs in-position opener, 20-40bb MTT ranges',
  bigBlind: { strong: 0.07, good: 0.25, weak: 0.23, trash: 0.45 },
  inPosition: { strong: 0.22, good: 0.43, weak: 0.29, trash: 0.06 }
};

// Hand classes in Modern Poker Theory's order (Ch. 1 "Post-flop Range Breakdown", Ch. 12): each combo goes into the
// first class it fits, made hands before draws, flush draws before straight draws. Pair positions count the board's
// distinct ranks from the top; the lowest is always bottomPair.
export const HAND_CLASSES = [
  'straightFlush', 'quads', 'fullHouse', 'flush', 'straight', 'set', 'trips', 'twoPair',
  'overpair', 'topPair', 'pocketPair12', 'secondPair', 'pocketPair23', 'thirdPair', 'pocketPair34', 'fourthPair',
  'pocketPair45', 'bottomPair', 'underpair',
  'flushDraw', 'oesd', 'gutshot', 'aceHigh', 'kingHigh', 'air'
];
const PAIR_POSITIONS = ['topPair', 'secondPair', 'thirdPair', 'fourthPair'];
const MADE_ORDER = ['isRoyalFlush', 'isStraightFlush', 'isFourOfAKind', 'isFullHouse', 'isFlush', 'isStraight', 'isThreeOfAKind', 'isTwoPair', 'isPair', 'isHighCard'];

/** A share of 0-1, as a number (0.8) or a percentage string ('80%'). */
export function parseShare(value, label = 'Equity') {
  let share = value;
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*%$/);
    if (!match) throw new Error(`${label} must be a number from 0 to 1 or a percentage like '80%', got '${value}'`);
    share = Number(match[1]) / 100;
  }
  if (typeof share !== 'number' || Number.isNaN(share) || share < 0 || share > 1) {
    throw new Error(`${label} must be a number from 0 to 1 or a percentage like '80%', got ${value}`);
  }
  return share;
}

/** 'acevedo' (default), 'quartiles', or [{ name, min }, ...] with min from 0 to 1 (or '75%'), highest first. */
export function resolveBands(bands) {
  if (bands === undefined || bands === null) return BAND_PRESETS.acevedo;
  if (typeof bands === 'string') {
    if (!Object.hasOwn(BAND_PRESETS, bands)) throw new Error(`Unknown bands preset: ${bands}. Use ${Object.keys(BAND_PRESETS).join(' or ')}, or an array of { name, min }`);
    return BAND_PRESETS[bands];
  }
  if (!Array.isArray(bands) || bands.length === 0) throw new Error('bands must be a preset name or a non-empty array of { name, min }');
  const resolved = bands.map(band => {
    if (!band || typeof band.name !== 'string' || band.name === '') throw new Error('Each band needs a name');
    return { name: band.name, min: parseShare(band.min, `Band ${band.name} min`) };
  }).sort((a, b) => b.min - a.min);
  if (new Set(resolved.map(b => b.name)).size !== resolved.length) throw new Error('Band names must be unique');
  if (resolved[resolved.length - 1].min !== 0) throw new Error('The lowest band must start at 0 so every hand has a band');
  return resolved;
}

export const bandOf = (equity, bands) => bands.find(band => equity >= band.min).name;

/** The shape and analysis options with their defaults, validated. */
export function analysisOptions(options = {}) {
  const enough = parseShare(options.shape?.enough ?? 0.1, 'shape.enough');
  if (enough === 0) throw new Error('shape.enough must be above 0');
  const topEnd = parseShare(options.shape?.topEnd ?? 0.05, 'shape.topEnd');
  if (topEnd === 0) throw new Error('shape.topEnd must be above 0');
  return {
    bands: resolveBands(options.bands),
    enough, topEnd,
    minDominant: parseShare(options.shape?.minDominant ?? 0.5, 'shape.minDominant'),
    nutsMinEquity: parseShare(options.nuts?.minEquity ?? 0.9, 'nuts.minEquity')
  };
}

/**
 * One side's summary: { combos, weight, equity, buckets: { name: { count, weight, share, combos } }, shape }.
 * side: { ids, weight, win, tie, lose, equity } (equity NaN for combos that can't be dealt). parent: the range the
 * side was chosen from ({ ids, weight }), for contiguity; null when the side is the whole range.
 */
export function sideSummary(side, { bands, enough = 0.1, minDominant = 0.5, parent = null }) {
  const { ids, weight, win, tie, lose, equity } = side;
  const buckets = Object.fromEntries(bands.map(band => [band.name, { count: 0, weight: 0, share: 0, combos: [] }]));
  let totalWeight = 0, sum = 0, sumSquares = 0, tw = 0, tt = 0, tl = 0, live = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const e = equity[id];
    if (Number.isNaN(e)) continue;
    live++;
    const w = weight[id];
    sum += e * w;
    sumSquares += e * e * w;
    tw += win[id] * w; tt += tie[id] * w; tl += lose[id] * w;
    const bucket = buckets[bandOf(e, bands)];
    bucket.combos.push(HAND_STRINGS[id]);
    bucket.weight += w;
    totalWeight += w;
  }
  for (const bucket of Object.values(buckets)) {
    bucket.count = bucket.combos.length;
    bucket.share = totalWeight ? bucket.weight / totalWeight : 0;
  }
  // The range's equity: poker-bitvaljs's per-hand counts summed by weight (its own totals formula)
  const counted = tw + tt + tl;
  const contiguity = contiguityOf(side, parent);
  const mean = totalWeight ? sum / totalWeight : 0;
  const variance = totalWeight ? Math.max(0, sumSquares / totalWeight - mean * mean) : 0;
  return {
    combos: live,
    weight: totalWeight,
    equity: counted ? (tw + tt / 2) / counted : null,
    buckets,
    shape: live ? shapeOf(buckets, bands, contiguity, enough, minDominant, mean, variance) : null
  };
}

// Share of the side's weight among the parent range's top slice by equity (as much weight as the side holds; ties
// with the slice's last combo count too). 1 means no gaps: the side is a top slice of what it was chosen from.
function contiguityOf(side, parent) {
  const { ids, weight, equity } = side;
  let mine = 0, live = 0;
  for (const id of ids) if (!Number.isNaN(equity[id])) { mine += weight[id]; live++; }
  if (!parent || live === 0) return 1;
  const ranked = [];
  let parentTotal = 0;
  for (const id of parent.ids) {
    if (Number.isNaN(equity[id])) continue;
    ranked.push(id);
    parentTotal += parent.weight[id];
  }
  if (mine >= parentTotal - 1e-9) return 1;
  // Stable descending sort by equity, as Array.prototype.sort on the parent's order
  ranked.sort((a, b) => equity[b] - equity[a]);
  let cumulative = 0;
  let cutoff = equity[ranked[ranked.length - 1]];
  for (const id of ranked) {
    cumulative += parent.weight[id];
    if (cumulative >= mine - 1e-9) { cutoff = equity[id]; break; }
  }
  let inSlice = 0;
  for (const id of ids) if (!Number.isNaN(equity[id]) && equity[id] >= cutoff) inSlice += weight[id];
  return inSlice / mine;
}

/**
 * The three competing range shapes of Modern Poker Theory (Ch. 1, Range Morphology), each 0 to 1:
 * polarized = Var(e) / (mean(e)(1 - mean(e))) (Bhatia-Davis: 1 only for nuts and air), linear = enough(T) x
 * hollow(bottom, middle) x contiguity, condensed = hollow(thicker end, middle); densities are share / band width.
 */
function shapeOf(buckets, bands, contiguity, enough, minDominant, mean, variance) {
  const top = buckets[bands[0].name].share;
  const bottom = bands.length > 1 ? buckets[bands[bands.length - 1].name].share : 0;
  // Summed from the middle bands (not 1 - top - bottom) so an empty middle is exactly 0
  const middle = bands.slice(1, -1).reduce((s, band) => s + buckets[band.name].share, 0);
  const widths = bandWidths(bands);
  const density = (share, width) => (width > 0 ? share / width : 0);
  const dTop = density(top, widths.top);
  const dMiddle = density(middle, widths.middle);
  const dBottom = density(bottom, widths.bottom);
  const present = share => Math.min(1, share / enough);
  const hollow = (part, than) => (than <= 0 ? (part <= 0 ? 1 : 0) : Math.max(0, Math.min(1, 1 - part / than)));
  const scores = {
    // Rounded so floating-point noise doesn't turn a perfect 1 into 0.9999999999999999
    polarized: mean > 0 && mean < 1 ? Math.round(Math.min(1, variance / (mean * (1 - mean))) * 1e12) / 1e12 : 0,
    linear: present(top) * hollow(dBottom, dMiddle) * contiguity,
    condensed: middle > 0 ? hollow(Math.max(dTop, dBottom), dMiddle) : 0
  };
  const best = Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a));
  return {
    ...scores,
    dominant: best[1] > 0 && best[1] >= minDominant ? best[0] : null,
    contiguity, top, middle, bottom,
    density: { top: dTop, middle: dMiddle, bottom: dBottom },
    equity: { mean, sd: Math.sqrt(variance) }
  };
}

// Equity width of the top band, the bands between, and the bottom band
function bandWidths(bands) {
  const topMin = bands[0].min;
  const bottomMax = bands.length > 1 ? bands[bands.length - 2].min : 0;
  return { top: 1 - topMin, middle: Math.max(0, topMin - bottomMax), bottom: bottomMax };
}

/** Effective nuts: combos with at least minEquity equity against the other range. */
export function nutsOf(side, minEquity) {
  const { ids, weight, equity } = side;
  let count = 0, nutWeight = 0, total = 0, live = 0;
  for (const id of ids) {
    const e = equity[id];
    if (Number.isNaN(e)) continue;
    live++;
    total += weight[id];
    if (e >= minEquity) { count++; nutWeight += weight[id]; }
  }
  if (live === 0) return { count: 0, weight: 0, share: null };
  return { count, weight: nutWeight, share: nutWeight / total };
}

const absoluteTops = new Map();

/**
 * How much of the top end a range is missing, 0 (uncapped) to 1 (capped), by made-hand score on the board:
 * relative (top end = the strongest topEnd share of both ranges' combos) and absolute (of every combo that can be
 * dealt). score: Int32Array by combo id; blocked: Uint8Array(52) of board and dead cards; boardKey keys a cache.
 */
export function cappedOf(mine, theirs, score, blocked, topEnd, boardKey) {
  const none = { relative: null, absolute: null };
  if (!score) return none;
  const isLive = id => !blocked[COMBO_LO[id]] && !blocked[COMBO_HI[id]];
  const mineIds = mine.ids.filter(isLive);
  if (mineIds.length === 0) return none;
  const theirIds = theirs.ids.filter(isLive);
  const ratioToCap = ratio => Math.max(0, 1 - ratio);

  // Relative: both ranges' combos, each side counted separately, by weight (stable sort: mine first, as listed)
  const all = [];
  for (const id of mineIds) all.push({ rank: score[id], mine: true, weight: mine.weight[id] });
  for (const id of theirIds) all.push({ rank: score[id], mine: false, weight: theirs.weight[id] });
  all.sort((a, b) => b.rank - a.rank);
  const sum = list => list.reduce((total, x) => total + x.weight, 0);
  const allWeight = sum(all);
  let cumulative = 0;
  let relCutoff = all[all.length - 1].rank;
  for (const x of all) {
    cumulative += x.weight;
    if (cumulative >= topEnd * allWeight - 1e-9) { relCutoff = x.rank; break; }
  }
  const relTop = all.filter(x => x.rank >= relCutoff);
  const mineWeight = sum(all.filter(x => x.mine));
  const relative = ratioToCap((sum(relTop.filter(x => x.mine)) / sum(relTop)) / (mineWeight / allWeight));

  // Absolute: every combo that can be dealt on this board
  const absKey = `${boardKey}|${topEnd}`;
  let abs = absoluteTops.get(absKey);
  if (!abs) {
    const ranks = [];
    for (let id = 0; id < COMBO_COUNT; id++) if (isLive(id)) ranks.push(score[id]);
    ranks.sort((a, b) => b - a);
    const cutoff = ranks[Math.max(1, Math.ceil(topEnd * ranks.length - 1e-9)) - 1];
    let inTop = 0;
    for (const rank of ranks) if (rank >= cutoff) inTop++;
    abs = { cutoff, share: inTop / ranks.length };
    if (absoluteTops.size >= 256) absoluteTops.delete(absoluteTops.keys().next().value);
    absoluteTops.set(absKey, abs);
  }
  let mineInTop = 0;
  for (const id of mineIds) if (score[id] >= abs.cutoff) mineInTop += mine.weight[id];
  return { relative, absolute: ratioToCap(mineInTop / mineWeight / abs.share) };
}

/**
 * Each combo in exactly one hand class: { total, weight, classes: { name: { count, weight, share, combos } } }.
 * A made hand counts only when it uses a hole card. highCards false counts ace-high and king-high as air.
 */
export function handClassesOf(ids, weight, classified, { highCards = true } = {}) {
  const { layout, cards } = classified;
  const boardRanks = [...new Set(cards.map(c => c >> 2))].sort((a, b) => b - a);
  // On an unpaired board of 3-4 cards every made hand uses a hole card; elsewhere the board can play
  const boardCanPlay = cards.length === 5 || boardRanks.length !== cards.length;
  const onBoard = new Uint8Array(52);
  for (const c of cards) onBoard[c] = 1;
  const classes = Object.fromEntries(HAND_CLASSES.map(name => [name, { count: 0, weight: 0, share: 0, combos: [] }]));
  const has = (id, name) => hasFlagAt(layout, classified, id, name);
  let total = 0, totalWeight = 0;
  for (const id of ids) {
    if (onBoard[COMBO_LO[id]] || onBoard[COMBO_HI[id]]) continue;
    total++;
    const w = weight[id];
    totalWeight += w;
    const entry = classes[classOf(id)];
    entry.combos.push(HAND_STRINGS[id]);
    entry.weight += w;
  }
  for (const entry of Object.values(classes)) {
    entry.count = entry.combos.length;
    entry.share = totalWeight ? entry.weight / totalWeight : 0;
  }
  return { total, weight: totalWeight, classes };

  function classOf(id) {
    const made = MADE_ORDER.find(flag => has(id, flag));
    const r1 = COMBO_HI[id] >> 2, r2 = COMBO_LO[id] >> 2;
    const pocketPair = r1 === r2;
    // A pair or better on an unpaired board of 3-4 cards always uses a hole card; elsewhere ask poker-extval
    const usesHole = !boardCanPlay || made === 'isHighCard' || classified.usesHoleCards(id);
    if (usesHole) {
      if (made === 'isRoyalFlush' || made === 'isStraightFlush') return 'straightFlush';
      if (made === 'isFourOfAKind') return 'quads';
      if (made === 'isFullHouse') return 'fullHouse';
      if (made === 'isFlush') return 'flush';
      if (made === 'isStraight') return 'straight';
      if (made === 'isThreeOfAKind') return pocketPair ? 'set' : 'trips';
      if (made === 'isTwoPair') return 'twoPair';
      if (made === 'isPair') {
        if (pocketPair) {
          const above = boardRanks.filter(r => r > r1).length;
          if (above === 0) return 'overpair';
          if (above === boardRanks.length) return 'underpair';
          return `pocketPair${above}${above + 1}`;
        }
        const paired = [r1, r2].find(r => boardRanks.includes(r));
        const position = boardRanks.indexOf(paired);
        if (position === 0) return 'topPair';
        if (position === boardRanks.length - 1) return 'bottomPair';
        return PAIR_POSITIONS[position];
      }
    }
    if (has(id, 'isFlushDraw')) return 'flushDraw';
    if (has(id, 'isOpenEndedStraightDraw') || has(id, 'isOpenEndedStraightDrawWheel')) return 'oesd';
    if (has(id, 'isInsideStraightDraw') || has(id, 'isInsideStraightDrawWheel')) return 'gutshot';
    if (highCards && (r1 === 12 || r2 === 12)) return 'aceHigh';
    if (highCards && (r1 === 11 || r2 === 11)) return 'kingHigh';
    return 'air';
  }
}

/** Every flag held by at least one combo: { total, weight, flags: { flag: { count, weight, share, combos } } }. */
export function breakdownOf(ids, weight, classified) {
  const { layout, cards } = classified;
  const onBoard = new Uint8Array(52);
  for (const c of cards) onBoard[c] = 1;
  const byFlag = new Map();
  let total = 0, totalWeight = 0;
  for (const id of ids) {
    if (onBoard[COMBO_LO[id]] || onBoard[COMBO_HI[id]]) continue;
    total++;
    totalWeight += weight[id];
    let middle = false;
    for (const name of layout.names) {
      if (!hasFlagAt(layout, classified, id, name)) continue;
      if (name === 'isMiddlePair') middle = true;
      if (!byFlag.has(name)) byFlag.set(name, []);
      byFlag.get(name).push(id);
    }
    // isMiddlingPair: a pocket pair between the board's highest and lowest cards
    if (middle && COMBO_LO[id] >> 2 === COMBO_HI[id] >> 2) {
      if (!byFlag.has('isMiddlingPair')) byFlag.set('isMiddlingPair', []);
      byFlag.get('isMiddlingPair').push(id);
    }
  }
  const flags = {};
  [...byFlag.entries()]
    .map(([flag, list]) => [flag, list, list.reduce((sum, id) => sum + weight[id], 0)])
    .sort((a, b) => b[2] - a[2])
    .forEach(([flag, list, w]) => { flags[flag] = { count: list.length, weight: w, share: w / totalWeight, combos: list.map(id => HAND_STRINGS[id]) }; });
  return { total, weight: totalWeight, flags };
}

/**
 * The full range vs range report from both sides' arrays. hero/villain: sides as in sideSummary, plus `classIds`
 * (the combos to classify; default ids). parent: hero's parent range for contiguity. classified: the board's
 * classification (null preflop). blocked: board and dead cards (Uint8Array(52)). boardCards: the board as strings.
 */
export function compareReport({ hero, villain, parent = null, classified, blocked, boardCards, boardKey, options }) {
  const { bands, enough, minDominant, topEnd, nutsMinEquity } = options;
  const heroSummary = sideSummary(hero, { bands, enough, minDominant, parent });
  const villainSummary = sideSummary(villain, { bands, enough, minDominant });
  const score = classified ? classified.score : null;
  heroSummary.capped = cappedOf(hero, villain, score, blocked, topEnd, boardKey);
  villainSummary.capped = cappedOf(villain, hero, score, blocked, topEnd, boardKey);
  heroSummary.nuts = nutsOf(hero, nutsMinEquity);
  villainSummary.nuts = nutsOf(villain, nutsMinEquity);
  const report = {
    board: boardCards,
    bands,
    hero: heroSummary,
    villain: villainSummary,
    advantage: {
      range: heroSummary.equity !== null && villainSummary.equity !== null ? heroSummary.equity - villainSummary.equity : null,
      nut: heroSummary.nuts.share !== null && villainSummary.nuts.share !== null ? heroSummary.nuts.share - villainSummary.nuts.share : null,
      polarization: heroSummary.shape && villainSummary.shape ? heroSummary.shape.polarized - villainSummary.shape.polarized : null,
      bands: Object.fromEntries(bands.map(band => [band.name, heroSummary.buckets[band.name].share - villainSummary.buckets[band.name].share])),
      classes: null
    },
    handClasses: null,
    flags: null,
    reference: bands === BAND_PRESETS.acevedo ? ACEVEDO_FLOP_AVERAGES : null
  };
  if (classified) {
    const heroClasses = handClassesOf(hero.classIds ?? hero.ids, hero.weight, classified);
    const villainClasses = handClassesOf(villain.classIds ?? villain.ids, villain.weight, classified);
    report.handClasses = Object.fromEntries(HAND_CLASSES.map(name => [name, {
      hero: heroClasses.classes[name].share,
      villain: villainClasses.classes[name].share,
      heroCount: heroClasses.classes[name].count,
      villainCount: villainClasses.classes[name].count
    }]));
    report.advantage.classes = Object.fromEntries(HAND_CLASSES.map(name => [name, heroClasses.classes[name].share - villainClasses.classes[name].share]));
    const heroFlags = breakdownOf(hero.classIds ?? hero.ids, hero.weight, classified).flags;
    const villainFlags = breakdownOf(villain.classIds ?? villain.ids, villain.weight, classified).flags;
    const flags = new Set([...Object.keys(heroFlags), ...Object.keys(villainFlags)]);
    const rows = [...flags].map(flag => [flag, {
      hero: heroFlags[flag]?.share ?? 0,
      villain: villainFlags[flag]?.share ?? 0,
      heroCount: heroFlags[flag]?.count ?? 0,
      villainCount: villainFlags[flag]?.count ?? 0
    }]);
    rows.sort((a, b) => Math.max(b[1].hero, b[1].villain) - Math.max(a[1].hero, a[1].villain));
    report.flags = Object.fromEntries(rows);
  }
  return report;
}

/** Area between two weighted equity CDFs on [0, 1]: 0 for identical distributions, up to 1. Lists of [equity, weight]. */
export function earthMoversDistance(a, b) {
  if (a.length === 0 || b.length === 0) return null;
  const xs = [...a].sort((x, y) => x[0] - y[0]);
  const ys = [...b].sort((x, y) => x[0] - y[0]);
  const totalX = xs.reduce((sum, x) => sum + x[1], 0);
  const totalY = ys.reduce((sum, y) => sum + y[1], 0);
  const points = [...new Set([...xs, ...ys].map(p => p[0]))].sort((x, y) => x - y);
  let i = 0, j = 0, cx = 0, cy = 0, area = 0;
  for (let k = 0; k < points.length - 1; k++) {
    while (i < xs.length && xs[i][0] <= points[k]) cx += xs[i++][1];
    while (j < ys.length && ys[j][0] <= points[k]) cy += ys[j++][1];
    area += Math.abs(cx / totalX - cy / totalY) * (points[k + 1] - points[k]);
  }
  return area;
}

/** [equity, weight] for every combo of a side that can be dealt, in id order given. */
export function equityPairs(side) {
  const out = [];
  for (const id of side.ids) if (!Number.isNaN(side.equity[id])) out.push([side.equity[id], side.weight[id]]);
  return out;
}

export { RANK_CHARS };
