# Benchmarks

poker-rangeman 3.8.0 against this version, v22.23.4, 4 cores, median of 5 runs after a
warm-up. Each run uses fresh instances, single-threaded (no workers). Regenerate with `npm run bench -- --write`.

Notation strings are remembered once parsed, so "same string" mostly measures the cache; "different strings" parses
input it hasn't seen (its notation segments can still be cached). Range totals (`equity()`) use poker-bitvaljs's
whole-range call in both versions.

| Operation | 3.8.0 | This version | Faster |
| --- | --- | --- | --- |
| Parse notation ×100 (same string) | 32.1 ms | 0.09 ms | 344.9× |
| Parse notation ×100 (different strings) | 9.03 ms | 4.62 ms | 2.0× |
| toNotation ×100 | 37.6 ms | 1.77 ms | 21.3× |
| include/exclude/intersect ×100 | 72.3 ms | 18.2 ms | 4.0× |
| makesHand Pair, flop | 33.8 ms | 0.65 ms | 51.7× |
| hitsHand Flush Draw, turn | 31.2 ms | 11.6 ms | 2.7× |
| makesHand non-strict, flop | 6.73 ms | 2.80 ms | 2.4× |
| rankHands, river | 18.4 ms | 2.52 ms | 7.3× |
| strongest 20%, flop | 15.4 ms | 1.42 ms | 10.9× |
| handClasses, flop | 18.5 ms | 1.85 ms | 10.0× |
| breakdown, flop | 18.3 ms | 1.40 ms | 13.1× |
| blockers, flop | 0.68 ms | 0.34 ms | 2.0× |
| equity (range total), flop | 16.8 ms | 14.5 ms | 1.2× |
| equity (range total), turn | 1.37 ms | 1.03 ms | 1.3× |
| getEquity per hand, flop | 665 ms | 22.9 ms | 29.1× |
| getEquity per hand, turn | 42.0 ms | 2.46 ms | 17.1× |
| getEquity per hand, river | 14.3 ms | 2.04 ms | 7.0× |
| getEquity per hand, wide vs wide, flop | 6214 ms | 60.1 ms | 103.5× |
| against + compare(), flop | 1437 ms | 45.8 ms | 31.4× |
| against + compare(), turn | 141 ms | 11.8 ms | 12.0× |
| against + compare(), weighted, flop | 1426 ms | 42.5 ms | 33.6× |
| compareTo, flop | 1124 ms | 40.5 ms | 27.8× |
| getEquity per hand, preflop (1,000 boards) | 113 ms | 15.8 ms | 7.2× |
