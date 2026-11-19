// Benchmarks this checkout. Each operation runs on fresh RangeManager instances, so per-instance caches don't carry over
// between runs.
// Usage: node bench/run.mjs [--runs 5] [--write]   (--write saves BENCHMARKS.md)
import { writeFileSync } from 'node:fs';
import { RangeManager as V4 } from '../src/rangeManager.js';

const args = process.argv.slice(2);
const RUNS = Number(args[args.indexOf('--runs') + 1]) || 5;
const WRITE = args.includes('--write');

const OPENER = '66+,A9s+,KTs+,QTs+,JTs,T9s,ATo+,KJo+';
const DEFENDER = '22-88,A2s-A8s,K9s,Q9s+,J9s+,T8s+,97s+,87s,76s,A9o-AJo,KTo-KQo,QJo';
const WIDE = '22+,A2s+,K2s+,Q2s+,J4s+,T6s+,96s+,86s+,75s+,65s,54s,A2o+,K8o+,Q9o+,J9o+,T9o';
const FLOP = ['Ad', '7c', '6h'];
const TURN = [...FLOP, '2s'];
const RIVER = [...TURN, 'Kd'];
const RANKS = 'AKQJT98765432';
// Notation strings never seen before (a fresh exact combo in each), so a parse cache can't help
const CARDS = [...RANKS].flatMap(r => [...'shdc'].map(s => r + s));
let uniqueCounter = 0;
const unique = () => Array.from({ length: 100 }, (_, i) => {
  const n = uniqueCounter++;
  const a = CARDS[n % 52], b = CARDS[(n * 7 + 1 + Math.floor(n / 52)) % 52];
  const exact = a === b ? '' : `,${a}${b}`;
  return `${RANKS[i % 12]}${RANKS[(i % 12) + 1]}s+,${RANKS[(i * 7) % 13]}${RANKS[(i * 7) % 13]}+,A${RANKS[1 + (i % 11)]}o+${exact}:0.${1 + (n % 9)}`;
});

const ops = [
  ['Parse notation ×100 (same string)', async RM => { for (let i = 0; i < 100; i++) new RM(`${OPENER},${DEFENDER}`); }],
  ['Parse notation ×100 (different strings)', async RM => { for (const n of unique()) new RM(n); }],
  ['toNotation ×100', async RM => { const r = new RM(WIDE).exclude('AKo'); for (let i = 0; i < 100; i++) r.toNotation(); }],
  ['include/exclude/intersect ×100', async RM => { let r = new RM(WIDE); for (let i = 0; i < 100; i++) r = r.exclude('AKs:0.5').include('AKs').intersect(WIDE); }],
  ['makesHand Pair, flop', async RM => { await new RM(WIDE).makesHand(['Pair'], FLOP); }],
  ['hitsHand Flush Draw, turn', async RM => { await new RM(WIDE).hitsHand(['Flush Draw'], TURN); }],
  ['makesHand non-strict, flop', async RM => { await new RM(OPENER).makesHand(['Pair'], FLOP, false); }],
  ['rankHands, river', async RM => { await new RM(WIDE).rankHands(RIVER); }],
  ['strongest 20%, flop', async RM => { await new RM(WIDE).strongest('20%', FLOP); }],
  ['handClasses, flop', async RM => { await new RM(WIDE).handClasses(FLOP); }],
  ['breakdown, flop', async RM => { await new RM(WIDE).breakdown(FLOP); }],
  ['blockers, flop', async RM => { await new RM(DEFENDER).blockers(FLOP, ['Ah', 'Kd']); }],
  ['equity (range total), flop', async RM => { await new RM(OPENER).equity(DEFENDER, FLOP); }],
  ['equity (range total), turn', async RM => { await new RM(OPENER).equity(DEFENDER, TURN); }],
  ['getEquity per hand, flop', async RM => { await new RM(OPENER).getEquity(DEFENDER, FLOP); }],
  ['getEquity per hand, turn', async RM => { await new RM(OPENER).getEquity(DEFENDER, TURN); }],
  ['getEquity per hand, river', async RM => { await new RM(OPENER).getEquity(DEFENDER, RIVER); }],
  ['getEquity per hand, wide vs wide, flop', async RM => { await new RM(WIDE).getEquity(WIDE, FLOP); }],
  ['against + compare(), flop', async RM => { await (await new RM(OPENER).against(DEFENDER, FLOP)).compare(); }],
  ['against + compare(), turn', async RM => { await (await new RM(OPENER).against(DEFENDER, TURN)).compare(); }],
  ['against + compare(), river', async RM => { await (await new RM(OPENER).against(DEFENDER, RIVER)).compare(); }],
  ['against + compare(), weighted, flop', async RM => { await (await new RM('66+:0.5,A9s+,KTs+:0.75,QTs+,JTs,T9s:0.25,ATo+,KJo+').against('22-88:0.6,A2s-A8s,K9s,Q9s+,J9s+:0.5,T8s+,97s+,87s,76s,A9o-AJo,KTo-KQo,QJo', FLOP)).compare(); }],
  ['compareTo, flop', async RM => { await (await new RM(OPENER).against(DEFENDER, FLOP)).compareTo('77+,ATs+,KQs,AJo+'); }],
  ['getEquity per hand, preflop (1,000 boards)', async RM => { await new RM('AA,KK,QQ,AKs').getEquity(DEFENDER, [], { iterations: 1000 }); }]
];

const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
async function time(fn, RM) {
  await fn(RM); // warm-up: loads poker-extval / poker-bitvaljs and JIT
  const samples = [];
  for (let i = 0; i < RUNS; i++) {
    const t = performance.now();
    await fn(RM);
    samples.push(performance.now() - t);
  }
  return median(samples);
}

const fmt = ms => (ms >= 100 ? ms.toFixed(0) : ms >= 10 ? ms.toFixed(1) : ms.toFixed(2));
const rows = [];
for (const [name, fn] of ops) {
  const ms = await time(fn, V4);
  rows.push({ name, ms });
  console.log(`${name.padEnd(46)} ${fmt(ms).padStart(9)} ms`);
}

if (WRITE) {
  const table = rows.map(r => `| ${r.name} | ${fmt(r.ms)} ms |`).join('\n');
  writeFileSync(new URL('../BENCHMARKS.md', import.meta.url), `# Benchmarks

This version, ${process.version}, ${(await import('node:os')).cpus().length} cores, median of ${RUNS} runs after a warm-up. Each run uses fresh
instances, single-threaded. Regenerate with \`npm run bench -- --write\`.

Notation strings are remembered once parsed, so "same string" mostly measures the cache; "different strings" parses
input it hasn't seen (its notation segments can still be cached). All equity comes from poker-bitvaljs.

| Operation | Time |
| --- | --- |
${table}
`);
  console.log('Wrote BENCHMARKS.md');
}
