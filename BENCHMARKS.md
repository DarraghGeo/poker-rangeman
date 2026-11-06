# Benchmarks

This version, v22.23.4, 4 cores, median of 5 runs after a warm-up. Each run uses fresh
instances, single-threaded. Regenerate with `npm run bench -- --write`.

Notation strings are remembered once parsed, so "same string" mostly measures the cache; "different strings" parses
input it hasn't seen (its notation segments can still be cached). All equity comes from poker-bitvaljs.

| Operation | Time |
| --- | --- |
| Parse notation ×100 (same string) | 0.25 ms |
| Parse notation ×100 (different strings) | 4.55 ms |
| toNotation ×100 | 1.43 ms |
| include/exclude/intersect ×100 | 16.2 ms |
| makesHand Pair, flop | 0.36 ms |
| hitsHand Flush Draw, turn | 13.7 ms |
| makesHand non-strict, flop | 3.26 ms |
| rankHands, river | 2.27 ms |
| strongest 20%, flop | 1.62 ms |
| handClasses, flop | 0.60 ms |
| breakdown, flop | 1.45 ms |
| blockers, flop | 0.29 ms |
| equity (range total), flop | 11.0 ms |
| equity (range total), turn | 0.97 ms |
| getEquity per hand, flop | 16.4 ms |
| getEquity per hand, turn | 3.09 ms |
| getEquity per hand, river | 1.98 ms |
| getEquity per hand, wide vs wide, flop | 37.5 ms |
| against + compare(), flop | 16.1 ms |
| against + compare(), turn | 4.07 ms |
| against + compare(), river | 4.28 ms |
| against + compare(), weighted, flop | 19.9 ms |
| compareTo, flop | 36.6 ms |
| getEquity per hand, preflop (1,000 boards) | 11.8 ms |
