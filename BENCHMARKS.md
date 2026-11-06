# Benchmarks

poker-rangeman 3.8.0 against this version, v22.23.4, 4 cores, median of 5 runs after a
warm-up. Each run uses fresh instances, single-threaded (no workers). Regenerate with `npm run bench -- --write`.

Notation strings are remembered once parsed, so "same string" mostly measures the cache; "different strings" parses
input it hasn't seen (its notation segments can still be cached). Range totals (`equity()`) use poker-bitvaljs's
whole-range call in both versions.

| Operation | 3.8.0 | This version | Faster |
| --- | --- | --- | --- |
| Parse notation ×100 (same string) | 29.0 ms | 0.09 ms | 320.8× |
| Parse notation ×100 (different strings) | 12.8 ms | 5.35 ms | 2.4× |
| toNotation ×100 | 33.0 ms | 1.22 ms | 27.2× |
| include/exclude/intersect ×100 | 72.3 ms | 20.5 ms | 3.5× |
| makesHand Pair, flop | 21.3 ms | 0.39 ms | 54.3× |
| hitsHand Flush Draw, turn | 25.6 ms | 10.5 ms | 2.4× |
| makesHand non-strict, flop | 4.73 ms | 3.03 ms | 1.6× |
| rankHands, river | 21.4 ms | 2.61 ms | 8.2× |
| strongest 20%, flop | 18.4 ms | 1.39 ms | 13.3× |
| handClasses, flop | 18.4 ms | 0.57 ms | 32.4× |
| breakdown, flop | 19.1 ms | 1.78 ms | 10.8× |
| blockers, flop | 1.10 ms | 0.49 ms | 2.3× |
| equity (range total), flop | 16.8 ms | 14.3 ms | 1.2× |
| equity (range total), turn | 1.35 ms | 0.82 ms | 1.6× |
| getEquity per hand, flop | 693 ms | 31.0 ms | 22.4× |
| getEquity per hand, turn | 40.3 ms | 2.98 ms | 13.5× |
| getEquity per hand, river | 13.4 ms | 1.77 ms | 7.6× |
| getEquity per hand, wide vs wide, flop | 6127 ms | 70.8 ms | 86.6× |
| against + compare(), flop | 1435 ms | 31.0 ms | 46.3× |
| against + compare(), turn | 112 ms | 5.07 ms | 22.1× |
| against + compare(), river | 57.1 ms | 3.87 ms | 14.7× |
| against + compare(), weighted, flop | 1363 ms | 27.7 ms | 49.2× |
| compareTo, flop | 1062 ms | 53.0 ms | 20.0× |
| getEquity per hand, preflop (1,000 boards) | 109 ms | 17.3 ms | 6.3× |
