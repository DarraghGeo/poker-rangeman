# Benchmarks

poker-rangeman 3.8.0 against this version, v22.23.4, 4 cores, median of 5 runs after a
warm-up. Each run uses fresh instances, single-threaded (no workers). Regenerate with `npm run bench -- --write`.

Notation strings are remembered once parsed, so "same string" mostly measures the cache; "different strings" parses
input it hasn't seen (its notation segments can still be cached). Range totals (`equity()`) use poker-bitvaljs's
whole-range call in both versions.

| Operation | 3.8.0 | This version | Faster |
| --- | --- | --- | --- |
| Parse notation ×100 (same string) | 30.9 ms | 0.09 ms | 343.2× |
| Parse notation ×100 (different strings) | 12.9 ms | 5.81 ms | 2.2× |
| toNotation ×100 | 32.8 ms | 1.28 ms | 25.6× |
| include/exclude/intersect ×100 | 69.9 ms | 19.9 ms | 3.5× |
| makesHand Pair, flop | 23.8 ms | 0.38 ms | 62.2× |
| hitsHand Flush Draw, turn | 23.6 ms | 12.5 ms | 1.9× |
| makesHand non-strict, flop | 5.15 ms | 5.09 ms | 1.0× |
| rankHands, river | 21.3 ms | 2.95 ms | 7.2× |
| strongest 20%, flop | 16.5 ms | 1.52 ms | 10.9× |
| handClasses, flop | 17.0 ms | 0.53 ms | 32.0× |
| breakdown, flop | 19.7 ms | 2.67 ms | 7.4× |
| blockers, flop | 0.79 ms | 0.37 ms | 2.1× |
| equity (range total), flop | 16.8 ms | 14.7 ms | 1.1× |
| equity (range total), turn | 1.46 ms | 0.85 ms | 1.7× |
| getEquity per hand, flop | 693 ms | 21.4 ms | 32.4× |
| getEquity per hand, turn | 39.8 ms | 3.11 ms | 12.8× |
| getEquity per hand, river | 22.2 ms | 3.48 ms | 6.4× |
| getEquity per hand, wide vs wide, flop | 6171 ms | 47.8 ms | 129.1× |
| against + compare(), flop | 1397 ms | 24.3 ms | 57.4× |
| against + compare(), turn | 113 ms | 4.90 ms | 23.0× |
| against + compare(), river | 55.9 ms | 4.82 ms | 11.6× |
| against + compare(), weighted, flop | 1341 ms | 21.7 ms | 61.8× |
| compareTo, flop | 1063 ms | 39.6 ms | 26.8× |
| getEquity per hand, preflop (1,000 boards) | 102 ms | 13.3 ms | 7.7× |
