# Benchmarks

This version, v22.23.4, 4 cores, median of 5 runs after a warm-up. Each run uses fresh
instances, single-threaded. Regenerate with `npm run bench -- --write`.

Notation strings are remembered once parsed, so "same string" mostly measures the cache; "different strings" parses
input it hasn't seen (its notation segments can still be cached). All equity comes from poker-bitvaljs.

| Operation | Time |
| --- | --- |
| Parse notation ×100 (same string) | 1.56 ms |
| Parse notation ×100 (different strings) | 6.93 ms |
| toNotation ×100 | 2.27 ms |
| include/exclude/intersect ×100 | 18.7 ms |
| makesHand Pair, flop | 0.37 ms |
| hitsHand Flush Draw, turn | 0.35 ms |
| makesHand non-strict, flop | 5.42 ms |
| rankHands, river | 3.80 ms |
| strongest 20%, flop | 1.37 ms |
| handClasses, flop | 0.89 ms |
| breakdown, flop | 1.67 ms |
| blockers, flop | 0.38 ms |
| equity (range total), flop | 11.7 ms |
| equity (range total), turn | 1.35 ms |
| getEquity per hand, flop | 19.9 ms |
| getEquity per hand, turn | 3.34 ms |
| getEquity per hand, river | 2.12 ms |
| getEquity per hand, wide vs wide, flop | 41.3 ms |
| against + compare(), flop | 17.7 ms |
| against + compare(), turn | 4.91 ms |
| against + compare(), river | 4.34 ms |
| against + compare(), weighted, flop | 21.4 ms |
| compareTo, flop | 42.0 ms |
| getEquity per hand, preflop (1,000 boards) | 13.7 ms |
