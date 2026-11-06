# Benchmarks

poker-rangeman 3.8.0 against this version, v22.23.4, 4 cores, median of 5 runs after a
warm-up. Each run uses fresh instances, single-threaded (no workers). Regenerate with `npm run bench -- --write`.

Notation strings are remembered once parsed, so "same string" mostly measures the cache; "different strings" parses
input it hasn't seen (its notation segments can still be cached). Range totals (`equity()`) use poker-bitvaljs's
whole-range call in both versions.

| Operation | 3.8.0 | This version | Faster |
| --- | --- | --- | --- |
| Parse notation ×100 (same string) | 35.2 ms | 0.09 ms | 413.0× |
| Parse notation ×100 (different strings) | 8.60 ms | 4.37 ms | 2.0× |
| toNotation ×100 | 38.2 ms | 1.39 ms | 27.6× |
| include/exclude/intersect ×100 | 69.3 ms | 16.9 ms | 4.1× |
| makesHand Pair, flop | 28.1 ms | 0.40 ms | 69.6× |
| hitsHand Flush Draw, turn | 35.2 ms | 15.8 ms | 2.2× |
| makesHand non-strict, flop | 8.11 ms | 5.02 ms | 1.6× |
| rankHands, river | 20.8 ms | 2.48 ms | 8.4× |
| strongest 20%, flop | 14.8 ms | 1.50 ms | 9.9× |
| handClasses, flop | 19.6 ms | 0.55 ms | 35.6× |
| breakdown, flop | 19.8 ms | 2.03 ms | 9.7× |
| blockers, flop | 0.71 ms | 0.30 ms | 2.3× |
| equity (range total), flop | 12.4 ms | 10.6 ms | 1.2× |
| equity (range total), turn | 1.17 ms | 0.68 ms | 1.7× |
| getEquity per hand, flop | 475 ms | 27.2 ms | 17.4× |
| getEquity per hand, turn | 45.2 ms | 3.14 ms | 14.4× |
| getEquity per hand, river | 15.9 ms | 2.13 ms | 7.4× |
| getEquity per hand, wide vs wide, flop | 3923 ms | 43.0 ms | 91.2× |
| against + compare(), flop | 900 ms | 17.9 ms | 50.2× |
| against + compare(), turn | 89.1 ms | 5.46 ms | 16.3× |
| against + compare(), river | 57.3 ms | 4.64 ms | 12.4× |
| against + compare(), weighted, flop | 944 ms | 18.3 ms | 51.6× |
| compareTo, flop | 729 ms | 34.3 ms | 21.3× |
| getEquity per hand, preflop (1,000 boards) | 108 ms | 11.4 ms | 9.5× |
