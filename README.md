# Poker Range Manager

A JavaScript library for parsing, managing, filtering and analysing poker hand ranges: range notation, dead cards, how a range hits a board, equity against another range, hand strength rankings and blockers. Hand evaluation uses [poker-extval](https://github.com/DarraghGeo/poker-extval); equity uses [poker-bitvaljs](https://github.com/DarraghGeo/poker-bitvaljs).

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [Constructor](#constructor)
  - [Query Methods](#query-methods)
  - [Filtering Methods](#filtering-methods)
  - [Evaluation Options](#evaluation-options)
  - [Evaluation Methods](#evaluation-methods)
  - [Equity Methods](#equity-methods)
  - [Strength, Breakdown and Blockers](#strength-breakdown-and-blockers)
  - [Range vs Range Analysis](#range-vs-range-analysis)
- [Range Notation Guide](#range-notation-guide)
- [Hand Strength Criteria](#hand-strength-criteria)
- [Method Chaining Examples](#method-chaining-examples)
- [Examples](#examples)
- [TypeScript](#typescript)
- [Releasing](#releasing)

## Installation

```bash
npm install poker-rangeman
```

The library uses ES modules and requires Node.js 20.19+ or 22.13+ (the versions poker-extval supports). It's available on [npm](https://www.npmjs.com/package/poker-rangeman).

## Quick Start

```javascript
import { RangeManager } from 'poker-rangeman';

// Create a range from notation
const rm = new RangeManager('22+,AKs,AKo');

// Query the range
console.log(rm.size());           // 94
console.log(rm.contains('AcKc')); // true
console.log(rm.toString());       // "22,33,44,55,66,77,88,99,TT,JJ,QQ,KK,AA,AKs,AKo"

// Filter by dead cards
const filtered = rm.exclude(['Ah', 'Kd']);
console.log(filtered.size());     // 92

// Filter by hand strength (requires board cards)
const board = ['Ah', 'Kd', 'Qc', 'Js', 'Th'];
const pairs = await rm.makesHand(['Pair'], board);
console.log(pairs.toString());

// Filter by suit
const spadeHands = rm.hasSuit('s');      // Hands with at least one spade
const heartSuited = rm.suitedOf('h');     // Hands suited in hearts
console.log(spadeHands.size());
console.log(heartSuited.toString());

// Use Rank X notation for all hands containing a specific rank
const allKHands = new RangeManager('KXo');  // All offsuit K hands (including KK)
const all5Suited = new RangeManager('5Xs');  // All suited 5 hands (excluding 55)
console.log(allKHands.size());              // 150
console.log(all5Suited.size());             // 48

// Use specific hand notation for exact hands
const specificHand = new RangeManager('5h2s');  // Exact hand: 5h2s
const combined = new RangeManager('5h2s,AKs,22+');  // Specific hand + other notation
console.log(specificHand.size());            // 1
console.log(combined.contains('5h2s'));     // true
```

## API Reference

### Constructor

#### `new RangeManager(input, deadCards?)`

Creates a new RangeManager instance.

**Parameters:**
- `input` (string | string[]): Range notation string or array of hand strings
- `deadCards` (string[], optional): Array of dead cards (e.g., `['Ah', 'Kd']`). Hands containing them are removed immediately. Supports wildcards: `'Ax'` (all Aces), `'Xh'` (all hearts)

**Returns:** RangeManager instance

**Examples:**
```javascript
// From notation string
const rm1 = new RangeManager('22+,AKs,AKo');

// From array of hands
const rm2 = new RangeManager(['AcKc', 'AdKd', 'AhKh', 'AsKs']);

// With dead cards
const rm3 = new RangeManager('22+,AKs,AKo', ['Ah', 'Kd']);
```

**Throws:**
- `Error`: If input is empty or invalid type
- `Error`: If deadCards is not an array or contains an invalid card

---

### Query Methods

#### `toArray()`

Returns all hands in the filtered range as an array.

**Returns:** `string[]` - Array of normalized hand strings (e.g., `['AcKc', 'AdKd', ...]`)

**Example:**
```javascript
const rm = new RangeManager('AKs');
rm.toArray(); // ['AcKc', 'AdKd', 'AhKh', 'AsKs']
```

#### `getHands()`

Alias for `toArray()`.

**Returns:** `string[]` - Array of normalized hand strings

**Example:**
```javascript
const rm = new RangeManager('AKs');
rm.getHands(); // ['AcKc', 'AdKd', 'AhKh', 'AsKs']
```

#### `size()`

Returns the number of hands in the filtered range.

**Returns:** `number` - Count of hands

**Example:**
```javascript
const rm = new RangeManager('22+,AKs,AKo');
rm.size(); // 94
```

#### `contains(hand)`

Checks if a specific hand is in the filtered range.

**Parameters:**
- `hand` (string): Hand notation (e.g., `'AcKc'` or `'KcAc'`)

**Returns:** `boolean` - True if hand is in range

**Example:**
```javascript
const rm = new RangeManager('AKs');
rm.contains('AcKc'); // true
rm.contains('KcAc');  // true (normalized automatically)
rm.contains('QcJc');  // false
```

#### `toString()`

Returns the range as a compact notation string.

**Returns:** `string` - Range notation (e.g., `"22,33,44,AKs,AKo"`)

**Example:**
```javascript
const rm = new RangeManager('22+,AKs,AKo');
rm.toString(); // "22,33,44,55,66,77,88,99,TT,JJ,QQ,KK,AA,AKs,AKo"
```

#### `toNotation()`

Returns the range as an abbreviated notation string, using `+` and `-` notation where possible. Works correctly with dead cards - when hands are filtered by dead cards (via `exclude()` or `setDeadCards()`), the abbreviated notation reflects only the remaining hands.

**Returns:** `string` - Abbreviated range notation

**Example:**
```javascript
const rm = new RangeManager('22,33,44,55,66,77,88,99,TT,JJ,QQ,KK,AA,AKs');
rm.toString();    // "22,33,44,55,66,77,88,99,TT,JJ,QQ,KK,AA,AKs"
rm.toNotation();  // "22+,AKs"

const rm2 = new RangeManager('A2s,A3s,A4s,A5s,A6s,AJs');
rm2.toString();   // "A2s,A3s,A4s,A5s,A6s,AJs"
rm2.toNotation(); // "A2s-A6s,AJs"

// With dead cards - notation reflects filtered hands
const rm3 = new RangeManager('22-AA,AKs,AKo');
const filtered = rm3.exclude(['Ah', 'Kd']);
filtered.toNotation(); // Abbreviated notation without hands containing Ah or Kd

// Dead cards breaking up ranges still produce abbreviated notation
const rm4 = new RangeManager('22-AA');
const filtered2 = rm4.exclude(['Ah', 'Ad']); // Removes AA pair
filtered2.toNotation(); // "22-KK" (abbreviated, excluding AA)
```

---

### Filtering Methods

All filtering methods return a new `RangeManager` instance, allowing for method chaining. The original instance remains unchanged.

#### `exclude(input)`

Excludes hands from the range. Accepts either dead cards (array of 2-character card strings) or range notation/array of hands.

**Parameters:**
- `input` (string | string[]): 
  - If array of 2-character strings: treated as dead cards (e.g., `['Ah', 'Kd']`)
  - If string or array of 4-character strings: treated as range notation or hands to exclude

**Returns:** `RangeManager` - New instance with excluded hands removed

**Examples:**
```javascript
const rm = new RangeManager('AKs');

// Exclude by dead cards
const filtered1 = rm.exclude(['Ah']);
filtered1.size();        // 3 (removed AhKh)
rm.size();               // 4 (original unchanged)

// Exclude by range notation
const filtered2 = rm.exclude('AhKh');
filtered2.size();        // 3

// Exclude by array of hands
const filtered3 = rm.exclude(['AhKh', 'AdKd']);
filtered3.size();        // 2
```

#### `include(input)`

Adds hands to the range. Accepts range notation string or array of hands.

**Parameters:**
- `input` (string | string[]): Range notation string or array of hand strings

**Returns:** `RangeManager` - New instance with included hands added

**Examples:**
```javascript
const rm = new RangeManager('AKs');

// Include by range notation
const expanded = rm.include('AKo');
expanded.size();         // 16 (4 suited + 12 offsuit)
expanded.toString();     // "AKs,AKo"

// Include by array of hands
const expanded2 = rm.include(['QcJc', 'QdJd']);
expanded2.size();        // 6
```

#### `intersect(input)`

Returns only hands that exist in both the current range and the input range.

**Parameters:**
- `input` (string | string[]): Range notation string or array of hand strings

**Returns:** `RangeManager` - New instance with intersecting hands only

**Examples:**
```javascript
const rm1 = new RangeManager('22+,AKs,AKo');
const rm2 = new RangeManager('AKs,AKo,QQ+');

const intersection = rm1.intersect('QQ+');
intersection.size();     // Only QQ, KK, AA, AKs, AKo
intersection.toString();  // "QQ,KK,AA,AKs,AKo"
```

#### `hasSuit(suit)`

Filters the range to only include hands where at least one card matches the specified suit.

**Parameters:**
- `suit` (string): Suit to filter by (`'s'`, `'h'`, `'d'`, `'c'`)

**Returns:** `RangeManager` - New instance with filtered hands

**Example:**
```javascript
const rm = new RangeManager('AKs,AKo,22+');
const spadeHands = rm.hasSuit('s');
spadeHands.size();        // Hands with at least one spade
spadeHands.contains('AsKs'); // true
spadeHands.contains('AhKd'); // true (has spade in pairs)
rm.size();                // Original unchanged
```

**Throws:**
- `Error`: If suit is invalid

#### `suitedOf(suit)`

Filters the range to only include hands that are suited (both cards same suit) AND both cards match the specified suit.

**Parameters:**
- `suit` (string): Suit to filter by (`'s'`, `'h'`, `'d'`, `'c'`)

**Returns:** `RangeManager` - New instance with filtered hands

**Example:**
```javascript
const rm = new RangeManager('AKs,AKo,22+');
const heartSuited = rm.suitedOf('h');
heartSuited.size();       // Only hands suited in hearts
heartSuited.contains('AhKh'); // true
heartSuited.contains('AsKs'); // false (that's spades)
heartSuited.contains('AhKd'); // false (offsuit)
rm.size();                // Original unchanged
```

**Throws:**
- `Error`: If suit is invalid

#### `makesHand(criteria, boardCards, options?)`

Filters the range to only include hands that make the specified strength criteria on the given board. Requires at least 3 board cards. Each hand is evaluated as the player's hole cards, so board-relative labels (top pair, over pair), draws and overcards describe that hand, not the board.

**Parameters:**
- `criteria` (string[]): Array of hand strength criteria (e.g., `['Pair', 'Straight']`)
- `boardCards` (string[]): Array of board cards (must have at least 3 cards)
- `options` (boolean | object, optional): `strict` boolean, or an [options object](#evaluation-options)

**Returns:** `RangeQuery` - a pending range: `await` it for the new instance, or keep chaining (see [Chaining async steps](#chaining-async-steps))

**Example:**
```javascript
const rm = new RangeManager('22+,AKs,AKo');
const board = ['Ah', 'Kd', 'Qc', 'Js', 'Th']; // Broadway straight board

// Find pairs
const pairs = await rm.makesHand(['Pair'], board);
pairs.toString();

// Find multiple criteria (OR logic - matches ANY)
const strong = await rm.makesHand(['Pair', 'Straight', 'Flush'], board);
```

**Throws:**
- `Error`: If criteria is not an array
- `Error`: If boardCards is empty or invalid
- `Error`: If invalid criteria are provided

**Note:** This method is asynchronous and requires the `poker-extval` library for hand evaluation.

#### `hitsHand(criteria, boardCards, options?)`

Filters the range to only include hands where at least one hand card is used in making the specified criteria. Requires at least 3 board cards.

**Parameters:**
- `criteria` (string[]): Array of hand strength criteria
- `boardCards` (string[]): Array of board cards (must have at least 3 cards)
- `options` (boolean | object, optional): `strict` boolean, or an [options object](#evaluation-options)

**Returns:** `RangeQuery` - a pending range: `await` it for the new instance, or keep chaining (see [Chaining async steps](#chaining-async-steps))

**Example:**
```javascript
const rm = new RangeManager('22+,AKs,AKo');
const board = ['Ah', 'Kd', 'Qc', 'Js', 'Th'];

// Find hands where at least one card is used in making a pair
const hands = await rm.hitsHand(['Pair'], board);
```

**Note:** This method is asynchronous and requires the `poker-extval` library for hand evaluation.

#### `hitsHandBoth(criteria, boardCards, options?)`

Filters the range to only include hands where both hand cards are used in making the specified criteria. Requires at least 3 board cards.

**Parameters:**
- `criteria` (string[]): Array of hand strength criteria
- `boardCards` (string[]): Array of board cards (must have at least 3 cards)
- `options` (boolean | object, optional): `strict` boolean, or an [options object](#evaluation-options)

**Returns:** `RangeQuery` - a pending range: `await` it for the new instance, or keep chaining (see [Chaining async steps](#chaining-async-steps))

**Example:**
```javascript
const rm = new RangeManager('22+,AKs,AKo');
const board = ['Ah', 'Kd', 'Qc', 'Js', 'Th'];

// Find hands where both cards are used in making a pair
const hands = await rm.hitsHandBoth(['Pair'], board);
```

**Note:** This method is asynchronous and requires the `poker-extval` library for hand evaluation.

#### Evaluation Options

`makesHand()`, `hitsHand()`, `hitsHandBoth()`, `evaluateHand()` and `getObject()` take either the `strict` boolean (as in earlier versions) or an options object:

| Option | Default | Meaning |
| --- | --- | --- |
| `strict` | `true` | Only the strongest made hand when true; every 5-card combination when false |
| `street` | inferred | `'flop'`, `'turn'` or `'river'`. Decides which draws can still complete (no backdoor draws on the turn, no draws on the river). Inferred from the card count when not given |
| `excludeBoardPlays` | `false` | When true, a made hand that uses neither hole card does not count: AK on 8-8-3 "makes" a pair, but the pair is the board's |

```javascript
const rm = new RangeManager('AKo,A8s');
const board = ['8h', '8d', '3c'];

(await rm.makesHand(['Pair'], board)).toNotation();                               // 'AKo' (playing the board's pair)
(await rm.makesHand(['Pair'], board, { excludeBoardPlays: true })).toNotation();  // ''
(await rm.makesHand(['Three of a Kind'], board, { excludeBoardPlays: true })).toNotation(); // 'A8s'

// Evaluate a 5-card board as the river: no draws
await rm.makesHand(['Flush Draw'], ['Kh', '9h', '4h'], { street: 'river' });
```

#### `setDeadCards(deadCards)`

Sets dead cards and filters the range to exclude any hands containing those dead cards.

**Parameters:**
- `deadCards` (string[]): Array of dead cards (2-character strings, e.g., `['Ah', 'Kd']`). Supports wildcards: `'Ax'` (all Aces), `'Xh'` (all hearts)

**Returns:** `RangeManager` - New instance with dead cards set and hands filtered

**Example:**
```javascript
const rm = new RangeManager('87s');
const withDeadCards = rm.setDeadCards(['7c', '7s']);
// Filters out hands containing 7c or 7s
// Original: ['8c7c', '8d7d', '8h7h', '8s7s'] (4 combos)
// Filtered: ['8d7d', '8h7h'] (2 combos)
console.log(withDeadCards.size()); // 2
console.log(withDeadCards.toArray()); // ['8d7d', '8h7h']

// Wildcard support
const rm2 = new RangeManager('AKs');
const withWildcards = rm2.setDeadCards(['Ax']); // All Aces are dead
// Filters out all hands containing any Ace
console.log(withWildcards.size()); // 0 (all AKs combos contain an Ace)
```

**Throws:**
- `Error`: If deadCards is not an array
- `Error`: If any card is invalid

#### `hasKeyCard(cards, and?, handStrength?)`

Filters the range to only include hands where the specified cards are key cards for the hand strength. Requires board cards to be set via `hitsHand()` or `makesHand()` first.

**Parameters:**
- `cards` (string[]): Array of cards to check (e.g., `['As', 'Kd']`). Supports wildcards: `'Ax'` (all Aces), `'Xh'` (all hearts)
- `and` (boolean, optional): If `true`, all cards must be present (AND logic). If `false`, any card can be present (OR logic). Default: `false`
- `handStrength` (string, optional): Specific hand strength to check (e.g., `'Pair'`, `'Top Pair'`). If not provided, uses cached hand strength from previous `hitsHand()` call

**Returns:** `RangeManager` - New instance with filtered hands

**Example:**
```javascript
const rm = new RangeManager('22+,AKs,AKo');
const board = ['Ah', 'Kd', 'Qc'];

// First, filter to hands that hit a pair
const hitHands = await rm.hitsHand(['Pair'], board);

// Then filter to hands where As is a key card
const withAs = hitHands.hasKeyCard(['As']);
console.log(withAs.toString());

// Check for specific hand strength
const topPairWithAs = hitHands.hasKeyCard(['As'], false, 'Top Pair');

// Check multiple cards (OR logic - any card)
const withAsOrKd = hitHands.hasKeyCard(['As', 'Kd'], false);

// Check multiple cards (AND logic - all cards)
const withAsAndKd = hitHands.hasKeyCard(['As', 'Kd'], true);

// Wildcard support
const withAnyAce = hitHands.hasKeyCard(['Ax']); // Any Ace
const withAnyHeart = hitHands.hasKeyCard(['Xh']); // Any heart
```

**Note:** This method requires `poker-extval` 3.0.0+ and board cards to be set via `hitsHand()` or `makesHand()` first. If no board cards are cached, returns an empty range.

#### `hasKicker(cards, and?, handStrength?)`

Filters the range to only include hands where the specified cards are kicker cards for the hand strength. Requires board cards to be set via `hitsHand()` or `makesHand()` first.

**Parameters:**
- `cards` (string[]): Array of cards to check (e.g., `['As', 'Kd']`). Supports wildcards: `'Ax'` (all Aces), `'Xh'` (all hearts)
- `and` (boolean, optional): If `true`, all cards must be present (AND logic). If `false`, any card can be present (OR logic). Default: `false`
- `handStrength` (string, optional): Specific hand strength to check (e.g., `'Pair'`, `'Top Pair'`). If not provided, uses cached hand strength from previous `hitsHand()` call

**Returns:** `RangeManager` - New instance with filtered hands

**Example:**
```javascript
const rm = new RangeManager('22+,AKs,AKo');
const board = ['Ah', 'Kd', 'Qc'];

// First, filter to hands that hit a pair
const hitHands = await rm.hitsHand(['Pair'], board);

// Then filter to hands where As is a kicker
const withAsKicker = hitHands.hasKicker(['As']);
console.log(withAsKicker.toString());

// Check for specific hand strength
const topPairWithAsKicker = hitHands.hasKicker(['As'], false, 'Top Pair');

// Check multiple cards (OR logic)
const withAsOrKdKicker = hitHands.hasKicker(['As', 'Kd'], false);

// Wildcard support
const withAnyAceKicker = hitHands.hasKicker(['Ax']); // Any Ace as kicker
```

**Note:** This method requires `poker-extval` 3.0.0+ and board cards to be set via `hitsHand()` or `makesHand()` first. If no board cards are cached, returns an empty range.

---

### Evaluation Methods

#### `evaluateHand(hand, boardCards, options?)`

Evaluates a single hand against board cards and returns a fluent API for checking hand strength. Returns a Promise that resolves to an object with `.is()` and `.isAll()` methods.

**Parameters:**
- `hand` (string): Hand to evaluate (e.g., `'AcKc'`)
- `boardCards` (string[]): Array of board cards (must have at least 3 cards)

**Returns:** `Promise<object>` - Promise resolving to object with `.is()` and `.isAll()` methods

**Example:**
```javascript
const rm = new RangeManager('AKs');
const board = ['Ah', 'Kd', 'Qc', 'Js', 'Th'];

// Check if hand matches ANY criteria (OR logic)
const evaluation = await rm.evaluateHand('AcKc', board);
const pairsOrStraights = evaluation.is(['Pair', 'Straight']);
console.log(Object.keys(pairsOrStraights).length > 0); // true if matches

// Check if hand matches ALL criteria (AND logic)
const flushAndStraight = evaluation.isAll(['Flush', 'Straight']);
console.log(Object.keys(flushAndStraight).length > 0); // true if both match

// Single criterion
const isPair = evaluation.is('Pair');
```

**Note:** This method is asynchronous and requires the `poker-extval` library for hand evaluation.

#### `getObject(hand, boardCards, options?)`

Returns the evaluation object from `poker-extval` for a single hand, evaluated with the hand as hole cards. Besides every flag it includes `usesHoleCards` (whether the made hand uses a hole card), `keyCards` and `kickerCards`, and rangeman's `isMiddlingPair`.

**Parameters:**
- `hand` (string): Hand to evaluate (e.g., `'AcKc'`)
- `boardCards` (string[]): Array of board cards (must have at least 3 cards)

**Returns:** `Promise<object>` - Promise resolving to raw evaluation object

**Example:**
```javascript
const rm = new RangeManager('AKs');
const board = ['Ah', 'Kd', 'Qc', 'Js', 'Th'];

const evaluation = await rm.getObject('AcKc', board);
// Returns raw poker-extval evaluation object
```

**Note:** This method is asynchronous and requires the `poker-extval` library for hand evaluation.

---

### Equity Methods

Equity runs out the board for every matchup between this range and villain's: exact on the flop and turn, and preflop a lookup table or Monte Carlo estimate. Hands that share a card with the board, the range's dead cards or `options.deadCards` are skipped.

Run equity once with [`getEquity()`](#getequityvillain-boardcards-options), then filter on it as often as you like. `villain` can be range notation (`'QQ+,AK'`), an array of hands, two cards (`['Ah', 'Kd']`) or another `RangeManager`. `boardCards` is `[]` (preflop) or 3 to 5 cards. `options` are `{ deadCards, iterations }`: extra dead cards (wildcards allowed) and Monte Carlo samples per matchup preflop (default 10000).

Equity thresholds are a number from 0 to 1 (`0.8`) or a percentage string (`'80%'`).

#### `equity(villain?, boardCards?, options?)`

The whole range's equity against villain. With no arguments, it totals the equity stored by `getEquity()` instead of calculating.

**Returns:** `Promise<{ win, tie, lose, equity }>`: runout counts from this range's side, and `equity = (win + tie / 2) / total` (`null` if no matchup is possible)

```javascript
const hero = new RangeManager('TT+,AQs+,AK');
await hero.equity('QQ+,AK', ['Kh', '9h', '4d']);
// { win: 233331, tie: 80460, lose: 541569, equity: 0.3198... }
```

#### `getEquity(villain, boardCards?, options?)`

Runs equity against villain once for every hand in the range and stores it on the range it returns. The equity filters, `equity()` and `equityByHand()` then read the stored values instead of recalculating, and later filters keep them. Like the other async steps it returns a chainable `RangeQuery`.

```javascript
const hero = new RangeManager('22+,A2s+,KTs+,QTs+,JTs,AJo+,KQo');
const flop = ['Kh', '9h', '4d'];

const withEquity = await hero.getEquity('TT+,AQs+,AK', flop);  // the only equity run

withEquity.equityAbove('80%').toNotation();            // 'KK+,99,44'
withEquity.equityBetween('70%', '90%').toNotation();   // 'AA,99,44,AKs,AKo'
withEquity.equityBelow(0.2).size();                    // 101
(await withEquity.equity()).equity;                    // 0.307..., the whole range

// Or in one chain
const bluffCatchers = await hero
  .makesHand(['Pair'], flop)
  .getEquity('TT+,AQs+,AK', flop)
  .equityBetween(0.4, 0.6);
bluffCatchers.toNotation();                            // 'QQ,A4s,KTs+,KQo'
```

Run `getEquity()` again after changing the villain range or the board. `setDeadCards()` clears the stored equity, since dead cards change the result. A filter throws if a hand has no stored equity, for example one added with `include()` after `getEquity()`.

#### `equityAbove(min)` / `equityBelow(max)` / `equityBetween(min, max)`

Keep the hands whose stored equity is greater than `min`, less than `max`, or between `min` and `max` inclusive. They need `getEquity()` earlier in the chain, run synchronously, and return a new `RangeManager`. Hands that cannot be dealt (equity `null`) are dropped.

The 3.6.0 form, `equityAbove(min, villain, boardCards?, options?)`, still works: given a villain it runs `getEquity()` first and returns a `RangeQuery`.

#### `equityByHand(villain?, boardCards?, options?)`

Each hand's equity, as `Promise<{ [hand]: { win, tie, lose, equity } }>`. With no arguments it returns the stored equity; with a villain it calculates (results are cached). `equity` is `null` for a hand that cannot be dealt.

`equity()` likewise totals the stored equity when called with no arguments.

**Performance:** `getEquity()` runs one calculation per hand, so it grows with both ranges. The example above (198 hero combos against about 50 villain combos on the flop) takes about 0.2 s; turn and river boards are faster. Preflop uses Monte Carlo unless poker-bitvaljs has its preflop table loaded, so lower `iterations` for large ranges.

---

### Strength, Breakdown and Blockers

These need a board of 3 to 5 cards and take `options` `{ street }`. Hands that share a card with the board are left out.

#### `rankHands(boardCards, options?)`

Every hand in the range, strongest first, by made hand (draws do not count).

**Returns:** `Promise<Array<{ hand, category, strength, rank }>>`: `category` is the made hand flag (e.g. `'isFlush'`), `strength` 10 (royal flush) down to 1 (high card), and `rank` an array that compares element by element (higher wins).

#### `strongest(portion, boardCards, options?)` / `weakest(portion, boardCards, options?)`

The strongest or weakest share of the range on this board (`0.2` or `'20%'`). Hands tied with the last hand taken are kept too. Returns a `RangeQuery` (await it, or keep chaining).

```javascript
const rm = new RangeManager('22+,AK,AQ,KQ');
const top = await rm.strongest('20%', ['Kh', '9h', '4d']);
const bottom = await rm.weakest(0.3, ['Kh', '9h', '4d']);
```

#### `breakdown(boardCards, options?)`

How the range hits the board: the number and share of combos holding each flag.

**Returns:** `Promise<{ total, flags }>`: `flags` maps each flag held by at least one hand to `{ count, share, combos }`, most common first.

```javascript
const { total, flags } = await new RangeManager('TT+,AK,AQs').breakdown(['Kh', '9h', '4d']);
flags.isPair.count;              // combos with exactly one pair
flags.isTopPair.share;           // share of the range with top pair
flags.isBackdoorFlushDraw.combos // the combos themselves
```

#### `blockers(boardCards, heroCards?, options?)`

Treats this range as villain's and splits it by which known cards block it, as poker-extval's `classifyRange()` does. `heroCards` (`'AhJs'` or `['Ah', 'Js']`) is optional, but the board plus hero cards must be at least 5 cards.

**Returns:** `Promise<{ boardBlocks, heroBlocks, allBlocks }>`, each `{ unblocked, blocked }`. `unblocked` lists the combos villain can still hold; `blocked` groups blocked combos under the made hand and draws villain would have held with them, or under `onBoard` when a board card blocks them.

```javascript
const villain = new RangeManager('AQs,AA,QQ');
const { heroBlocks, allBlocks } = await villain.blockers(['Kh', '9h', '4h', '2c'], 'AhJs');
heroBlocks.blocked.isFlush;  // ['AhQh']: your Ah blocks the nut flush
allBlocks.unblocked;         // combos villain can actually hold
```

---

### Range vs Range Analysis

Compare your range with an opponent's on a board: how the equity is shared out, which side has the range and nut advantage, how each range is shaped, how they hit the board, and which hands defend or bluff at a given bet size. The method follows Michael Acevedo's *Modern Poker Theory* (Ch. 10), which compares ranges with **equity buckets**: each hand's equity against the other range, grouped into bands.

| Band | Hand vs range equity |
| --- | --- |
| `strong` | 75% or more |
| `good` | 50% to under 75% |
| `weak` | 33% to under 50% |
| `trash` | under 33% |

```javascript
const opener = new RangeManager('66+,A9s+,KTs+,QTs+,JTs,T9s,ATo+,KJo+');
const defender = '22-88,A2s-A8s,K9s,Q9s+,J9s+,T8s+,97s+,87s,76s,A9o-AJo,KTo-KQo,QJo';
const flop = ['Ad', '7c', '6h'];

const spot = await opener.against(defender, flop);  // set villain and board once
const report = await spot.compare();

report.hero.equity;               // 0.600
report.hero.buckets.strong.share; // 0.405  (good 0.243, weak 0.257, trash 0.095)
report.villain.buckets.strong.share; // 0.069 (good 0.241, weak 0.092, trash 0.598)
report.advantage.range;           // 0.200: hero equity minus villain equity
report.advantage.nut;             // 0.026: effective nuts (90%+ equity), 6.1% of hero's range vs 3.4% of villain's
report.advantage.bands.strong;    // 0.336: hero has far more Strong hands...
report.advantage.bands.trash;     // -0.503: ...and far less trash
report.hero.shape;                // { polarized: 0, linear: 0.76, condensed: 0, dominant: 'linear', ... }
report.hero.capped;               // { relative: 0, absolute: 0 }: the opener has its share of the nuts
report.handClasses.air;           // { hero: 0.081, villain: 0.184, heroCount: 12, villainCount: 32 }
report.flags.isTopPair;           // { hero: 0.345, villain: 0.241, heroCount: 51, villainCount: 42 }

// Filters chain as usual
await opener.against(defender, flop).bucket('good').hasSuit('h').toNotation(); // 'KK-88'
```

#### `against(villain, boardCards?, options?)`

Sets villain's range and the board, runs your range's equity once (the same as [`getEquity()`](#getequityvillain-boardcards-options)), and stores the matchup on the range it returns, so the methods below need no more arguments. Async and chainable.

`options`: `{ bands, deadCards, iterations }`. `bands` is `'acevedo'` (the table above, the default), `'quartiles'` (75 / 50 / 25), or your own: `[{ name: 'value', min: '70%' }, { name: 'rest', min: 0 }]`. The lowest band must start at 0.

The analysis only covers hands that can be dealt. Run `against()` again after changing villain or the board; `setDeadCards()` clears the matchup.

#### `bucket(...names)` and `bandsByHand()`

`bucket('good')` or `bucket('strong', 'good')` keeps the hands in those bands. `bandsByHand()` returns each hand's band, e.g. `{ AcAd: 'strong', ... }`.

#### `buckets()` and `compare()`

`buckets()` returns `{ bands, hero, villain }`. Each side is `{ combos, equity, buckets, shape }`, and each bucket is `{ count, share, combos }`. Villain's side is villain's equity against your current hands, calculated when first needed and cached.

`compare()` adds to that:

- `advantage`: range, nut and polarization advantage, and one per equity band and hand class; see [Advantages](#advantages).
- `handClasses`: each range split into hand classes, every combo in exactly one, so each side adds up to 1: sets, top pair, flush draws, air and so on (see [`handClasses()`](#handclassesboardcards-options)). `null` preflop.
- `flags`: the share of each range holding each poker-extval flag (made hands, pair positions, draws, overcards). A combo can hold several, so these overlap; most common first. `null` preflop.
- `reference`: with the default bands, the book's averages over all 1,755 flops for a big blind defending against an in-position opener with 20-40bb ranges: BB strong 7% / good 25% / weak 23% / trash about 45%, opener 22% / 43% / 29% / 6% (PDF p. 600). A point of comparison, not a target.

#### Range shape

*Modern Poker Theory* (Ch. 1, Range Morphology) names three main range shapes: **linear**, **polarized** and **condensed**. They compete, but most ranges are a mix of them. Separately, a range can be **capped** (missing its strongest hands) or uncapped; that describes the top of the range rather than its shape, so it can go with any of the three. It is reported next to `shape` (see [Capping](#capping)).

`shape` scores the three shapes from 0 to 1. They come from the range's equity against villain, split three ways by the bands: **T**, the share in the top band (Strong); **B**, the share in the bottom band (Trash); and **M**, the share in the bands between (Good and Weak). T + M + B = 1.

The shapes are about which part of the range is **hollow**, so each share is compared with an even spread across equity, the straight diagonal on an equity chart. A part's **density** is its share divided by its band's width: with the default bands the top is 25 points wide (75–100%), the middle 42 (33–75%) and the bottom 33 (0–33%), so an even spread has T, M and B of about 25%, 42% and 33% and every density 1. A part is hollow when it is thinner than its neighbours: `hollow(part, than) = 1 − part / than`, from 0 (as dense) to 1 (empty).

| Score | Formula | The book's definition |
| --- | --- | --- |
| `shape.polarized` | enough(T) × enough(B) × hollow(middle, thinner end) | "High equity value hands and low equity bluffing hands", perfectly polarized with "no hands in between" |
| `shape.linear` | enough(T) × hollow(bottom, middle) × contiguity | "The highest equity hands without gaps in between" |
| `shape.condensed` | hollow(thicker end, middle) | "It has the top and bottom hands removed and is comprised of middle equity hands" |

**Enough.** An end counts fully once it holds a minimum share of the range, and partly below that: `enough(x) = min(1, x / e)`, with `e` = 10% by default. Set it with `against(villain, board, { shape: { enough: 0.15 } })`.

A range spread evenly across equity scores 0 on all three: it has no hollow part. `shape.density` gives the three densities, and `shape.top`, `shape.middle` and `shape.bottom` the shares themselves.

The three scores are independent and need not add up to 1: a range can be partly linear and partly condensed. `shape.dominant` names the highest (on a tie, the first of polarized, linear, condensed) when it reaches 0.5, and is `null` otherwise: an evenly spread range, or one that is mostly air, has no dominant shape. Change the minimum with `shape: { minDominant: 0.4 }`.

`shape.contiguity` is the share of the range's hands that are among the top N hands, by equity, of the range as it was at `against()`, where N is the range's own size. It checks the "without gaps" part of linear: a strong + weak range that skips the good hands is not a top slice, so its contiguity and linear score drop. For the range `against()` was called on (and for villain's range) it is 1, because gaps can only be seen against the hands that were available.

Some examples, on A-7-6 rainbow with the ranges above:

| Range | T / M / B | polarized | linear | condensed | dominant | capped (relative / absolute) |
| --- | --- | --- | --- | --- | --- | --- |
| Opener, whole range | .41 / .50 / .09 | 0 | 0.76 | 0 | linear | 0 / 0 |
| Opener, strong + trash | .81 / 0 / .19 | 1 | 0 | 0 | polarized | 0 / 0 |
| Opener, strong + good | .63 / .38 / 0 | 0 | 1 | 0 | linear | 0 / 0 |
| Opener, strong + weak (skips good) | .61 / .39 / 0 | 0 | 0.63 | 0 | linear | 0 / 0 |
| Opener, good + weak | 0 / 1 / 0 | 0 | 0 | 1 | condensed | 1 / 1 |
| Opener, good + trash | 0 / .72 / .28 | 0 | 0 | 0.51 | condensed | 1 / 1 |
| Defender, whole range | .07 / .33 / .60 | 0 | 0 | 0 | none | 0.13 / 0 |

Limits worth knowing:

- The band edges are hard cut-offs, as in the book's buckets: a hand at 74% equity is middle and one at 76% is top. Ranges with many hands near an edge can move noticeably.
- Gaps are only detected against the range at `against()`.
- With few combos, single hands move the shares a lot; `combos` is reported next to the shape.
- The book says both that "a condensed range is capped" and, in its next example, that a condensed range can hold very strong hands and not be capped. Here condensed falls as strong hands appear, and capped is scored on its own.
- The book's "merged" describes betting the polarized and condensed parts together with one small size, a strategy rather than a range shape, so it has no score.

#### Advantages

`compare().advantage` gives each advantage as hero minus villain, so a positive number favours (or, for weak hands, describes) hero:

| Advantage | Measure | Modern Poker Theory |
| --- | --- | --- |
| `range` | Equity: hero's minus villain's | "Having the range vs range equity advantage can help the weaker hands in your range realize their equity" (Ch. 1). Its example: IP's 62% to the BB's 38% on A76r |
| `nut` | Share of the range that is effective nuts | "A player has the nut advantage if the effective nut hands make up a larger portion of his range than the Villain's range" (Glossary) |
| `polarization` | `shape.polarized`, hero's minus villain's | Its toy games raise bet sizes "as Hero's range gains the polarization advantage" (Ch. 10); the measure is derived, not given by the book |
| `bands.<band>` | Share of each equity band (`strong`, `good`, `weak`, `trash`) | The equity bucket comparison of Ch. 10, e.g. "the BB has 8% strong hands and IP has a staggering 31%" on A76r |
| `classes.<class>` | Share of each [hand class](#handclassesboardcards-options), e.g. `classes.air` | The range breakdowns of Ch. 1 and Ch. 12 |

For bands and classes the number is a difference in share, not a judgement: an air advantage of 0.2 means hero holds 20 percentage points more air than villain, which means more bluff candidates and fewer hands that can call.

**Effective nuts** are the hands with **at least 90% equity against the other range**. The book defines them as "a poker hand that is not the actual nuts but is strong enough that it should be played as if it were the nuts. For example, 7♣7♥ is the effective nuts on 8♥7♦2♦", with no numeric threshold. Each side reports them as `nuts: { count, share }`; change the threshold with `against(villain, board, { nuts: { minEquity: 0.85 } })`. Because they are measured by equity, they reflect vulnerability (a set on a wet board can fall short) and work preflop too. They are separate from [capping](#capping), which looks at made hands.

This is narrower than the strong band (75%+). On A76r the opener has a large strong-band advantage (any ace is about 85% against the defender's range) but little nut advantage: its effective nuts are its sets (AA, 77, 66, 6.1% of the range) against the defender's 77 and 66 sets (3.4%).

#### Capping

A range is capped when it is missing the strongest hands: in the book's example, the big blind on A♥J♦T♠ "lacks all nut hands such as straights (KQ), sets (AA, JJ, TT), and most two pairs". That is about made hands on the board, not equity, so capping ranks every combo by its made hand (straight flush down to high card) and looks at the **top end**: the strongest 5% of combos, ties at the cut-off included. `capped` has two scores, each from 0 (uncapped) to 1 (capped):

| Score | Top end | Formula |
| --- | --- | --- |
| `capped.relative` | The strongest 5% of the combos in **both ranges** | 1 − min(1, the range's share of that top end ÷ its share of all their combos) |
| `capped.absolute` | The strongest 5% of **every combo** that can be dealt on the board | 1 − min(1, the range's share in that top end ÷ the share of all combos in it) |

A range that holds at least its fair share of the top end scores 0; one that holds none scores 1; holding half its fair share scores 0.5. Relative capping says which of the two ranges holds the top hands between them. Absolute capping says whether a range reaches the board's actual nuts: when neither range can hold them, both are capped absolutely, while relative capping still shows who has more of the strongest hands. Change the top end with `shape: { topEnd: 0.1 }`; capping is `null` preflop, with no board to rank on.

With the 5% default, capping matches the book's examples: the big blind without KQ, sets and AJ/AT on A♥J♦T♠ is capped (relative 1) and the button is not (0); on 5♥4♦3♠ the big blind holds the straights and is not capped (0). A 10% or 20% top end reaches down into one pair and no longer matches them.

#### `handClasses(boardCards, options?)`

Splits the range into hand classes on the board, putting each combo in exactly one class so the shares add up to 1. The classes and their order follow *Modern Poker Theory* (Ch. 1, "Post-flop Range Breakdown", and Ch. 12): a combo goes in the first class it fits, made hands before draws, flush draws before straight draws.

| Group | Classes |
| --- | --- |
| Made hands | `straightFlush`, `quads`, `fullHouse`, `flush`, `straight`, `set` (a pocket pair), `trips` (one hole card), `twoPair` |
| Pairs | `overpair`, `topPair`, `pocketPair12` (a pocket pair between the top and second board ranks), `secondPair`, `pocketPair23`, `thirdPair`, `pocketPair34`, `fourthPair`, `pocketPair45`, `bottomPair`, `underpair` |
| Draws | `flushDraw` (including straight flush draws and combo draws), `oesd`, `gutshot` |
| No pair, no draw | `aceHigh`, `kingHigh`, `air` |

Pair positions count the board's distinct ranks from the top, and the lowest is always `bottomPair`; on a three-rank flop `secondPair` is the middle pair. A made hand counts only when it uses a hole card: AK on 8-8-3 is ace-high, not a pair. Backdoor draws stay in their no-pair class (they are in `flags`).

**Returns:** `Promise<{ total, classes }>`, with every class as `{ count, share, combos }`. `options`: `{ highCards, street }`; `highCards: false` counts ace-high and king-high as air, as the book's Chapter 1 breakdown does.

```javascript
// The book's example: a hijack opening range against hero's A♦3♦ on A♣J♥9♥
const hijack = new RangeManager('22+,A2s+,KQs,KJs,KTs,K9s,K8s,QJs,QTs,Q9s,Q8s,JTs,J9s,J8s,T9s,T8s,98s,97s,87s,76s,AKo,AQo,AJo,ATo,KQo,KJo,KTo,QJo,QTo', ['Ad', '3d']);
const { total, classes } = await hijack.handClasses(['Ac', 'Jh', '9h'], { highCards: false });
// total 225: set 7, twoPair 10, topPair 38, pocketPair12 12, secondPair 30, pocketPair23 6,
// bottomPair 15, underpair 39, flushDraw 8, oesd 18, gutshot 36, air 6, the book's own counts
classes.air.combos;  // ['Kc8c', 'Kd8d', 'Ks8s', '7c6c', '7d6d', '7s6s']
```

#### `compareTo(reference)`

Compares your range with a reference range (notation, hands or a `RangeManager`), such as a chart you are studying:

```javascript
const vsChart = await spot.compareTo('77+,ATs+,KQs,AJo+');
vsChart.overlap;           // 0.598: combos in common / combos in either
vsChart.notation.extra;    // '66,A9s,KTs-KJs,QTs+,JTs,T9s,ATo,KJo+' (yours only)
vsChart.notation.missing;  // '' (the chart's only)
vsChart.equity;            // { range: 0.600, reference: 0.713 } against the same villain and board
vsChart.distance;          // 0.113
```

`common`, `missing` and `extra` list the combos. After `against()`, it also compares both ranges against the same villain and board: `equity`, `buckets` (each a side summary), and `distance`, the earth mover's distance between the two equity distributions. 0 means the same shape; it is the average amount of equity that would have to move to turn one distribution into the other. Without `against()`, only the combos are compared.

#### Betting math: `bettingMath()`, `defend()`, `bluffCandidates()`

```javascript
spot.bettingMath({ pot: 6, bet: 2 });
// { alpha: 0.25, mdf: 0.75, potOdds: 0.2, bluffShare: 0.2, valueToBluff: 4 }

// As the defender facing a 1/3-pot bet from the opener's range (202 combos, 174 can be dealt)
const bb = await new RangeManager(defender).against(opener, flop);
bb.defend({ pot: 6, bet: 2 }).size();                     // 129: equity >= pot odds
bb.defend({ pot: 6, bet: 2, realization: 0.9 }).size();   // 114: out of position
bb.defend({ pot: 6, bet: 2, by: 'mdf' }).size();          // 132: the strongest 75%

// As the bettor: bluffs to go with the strong hands at a 2/3-pot bet
const bluffs = await spot.bluffCandidates({ pot: 6, bet: 4 });
bluffs.size();             // 24 (60 strong combos x alpha 0.4)
```

- `bettingMath({ pot, bet })`: `alpha` = bet / (pot + bet), how often a bluff must work; `mdf` = 1 - alpha; `potOdds` = bet / (pot + 2 × bet), the equity a call needs, which is also the bluff share of a balanced river bet (`bluffShare`); `valueToBluff` = value combos per bluff.
- `defend({ pot, bet, by?, realization? })`: your continuing range against villain's bet (villain being the betting range you gave `against()`). By default it keeps hands whose equity × `realization` reaches the pot odds; `by: 'mdf'` keeps the strongest MDF share instead. The book warns that MDF is only a rough guide before the river: on A-Q-3 against a 1/3-pot bet, MDF says defend 75%, but the solver defends 42%, because the defender's weakest hands don't have the equity to call. `realization` scales equity for how much of it a hand realizes; the book gives about 0.9 out of position and 1.1 in position for symmetric ranges. Realization itself needs a solver.
- `bluffCandidates({ pot, bet, value? })`: as the bettor, bluffs to pair with your value hands (the bands in `value`, default the top band). The count is value combos × alpha, so bluffs make up the pot-odds share of the betting range. It takes the lowest-band hands first, preferring those that block more of villain's continuing range (villain hands with at least the pot odds), then lower equity. Async and chainable.

**Performance:** `against()` runs one equity calculation per hand in your range; the first `buckets()` or `compare()` runs one per hand in villain's range. The example above takes about 1.5 s. Two full ranges of about 600 combos each on the flop take about 7 s for `against()` and 7 s more for `compare()`.

---

## Range Notation Guide

### Pairs

- `AA` - Pocket Aces (6 combinations)
- `22+` - All pairs from 22 to AA (78 combinations)
- `22-55` - Pairs from 22 to 55 (inclusive)

### Suited Hands

- `AKs` - Ace-King suited (4 combinations)
- `A2s+` - All suited hands from A2s to AKs (48 combinations)
  - The `+` notation means the second rank increases until it reaches one rank below the first rank
  - For `A2s+`, the second rank goes from 2 to K (where K is one rank below A)
  - Examples: `QTs+` = QTs, QJs (T to J, where J is one rank below Q); `J8s+` = J8s, J9s, JTs (8 to T, where T is one rank below J)
- `A3s-A6s` - Suited range from A3s to A6s (16 combinations)

### Offsuit Hands

- `AKo` - Ace-King offsuit (12 combinations)
- `A2o+` - All offsuit hands from A2o to AKo (144 combinations)
  - The `+` notation means the second rank increases until it reaches one rank below the first rank
  - For `A2o+`, the second rank goes from 2 to K (where K is one rank below A)
  - Examples: `QTo+` = QTo, QJo (T to J, where J is one rank below Q); `J8o+` = J8o, J9o, JTo (8 to T, where T is one rank below J)
- `A3o-A6o` - Offsuit range from A3o to A6o (48 combinations)

### Suited and Offsuit Together

- `AK` - Ace-King suited and offsuit (16 combinations), the same as `AKs,AKo`
- `AT+` - `ATs+,ATo+` (64 combinations)
- `AK-AT` - `AKs-ATs,AKo-ATo`

### Wildcards

- `AxKh` - Any Ace offsuit with the King of hearts: `AsKh`, `AdKh`, `AcKh` (the `x` suit excludes the other card's suit)
- `KxAh` - Any King offsuit with the Ace of hearts
- `AhXs` - The Ace of hearts with any spade (`XsAh` is treated the same way)

### Rank X Notation

- `KXo` - All offsuit hands containing a King, including pocket Kings (equivalent to `K2o+,AKo,KK`)
- `5Xo` - All offsuit hands containing a 5, including pocket 5s (equivalent to `52o+,A5o,55`)
- `5Xs` - All suited hands containing a 5 from A-2 (equivalent to `52s+,A5s`, excludes `55` since suited pairs don't exist)
- `AXs` - All suited hands containing an Ace from 2-K (equivalent to `A2s+,AKs`, excludes `AA`)

**Note:** 
- `RXo` includes the pocket pair (e.g., `KXo` includes `KK`)
- `RXs` excludes the pocket pair (e.g., `5Xs` excludes `55` since suited pairs don't exist)

### Specific Hands

You can specify exact hands using rank and suit notation:

- `5h2s` - Five of hearts, Two of spades (1 combination)
- `AcKd` - Ace of clubs, King of diamonds (1 combination)
- `KhKs` - King of hearts, King of spades (1 combination - pocket pair)

**Note:**
- Hands are automatically normalized (sorted by rank, suits sorted for pairs)
- `5h2s` and `2s5h` are treated as the same hand
- Can be combined with other notation types using commas

### Combining Notations

Use commas to separate different notation types:

```javascript
'22+,AKs,AKo'        // All pairs 22+, plus AKs, plus AKo
'A2s+,KQo'           // All suited A2s+, plus KQo
'KXo,5Xs'            // All offsuit K hands (including KK), plus all suited 5 hands
'22+,KXo,AXs'        // All pairs 22+, all offsuit K hands, all suited A hands
'5h2s,AKs'           // Specific hand 5h2s, plus all AK suited hands
'AcKd,22+'           // Specific hand AcKd, plus all pairs 22+
```

---

## Hand Strength Criteria

The following criteria can be used with the `makesHand()`, `hitsHand()`, and `hitsHandBoth()` methods. Each criterion is a display name (`'Top Pair'`) or the poker-extval flag it maps to (`'isTopPair'`). Unknown criteria throw an error.

### Made Hands
- `'Pair'` - One pair
- `'Two Pair'` - Two pair
- `'Three of a Kind'` - Three of a kind
- `'Straight'` - Straight
- `'Flush'` - Flush
- `'Full House'` - Full house
- `'Four of a Kind'` - Four of a kind
- `'Straight Flush'` - Straight flush
- `'Royal Flush'` - Royal flush
- `'High Card'` - High card

### Pair Categorization

Pair types are **board-relative**: poker-extval judges them against the whole board, using the hand as hole cards. A label applies only when the made hand is that pair, so AA on K-K-4 is two pair and has no over pair label, and a pair made only of board cards gets no label.

- **Pairs that use a board card:** `'Top Pair'` (pair the board’s highest card), `'Middle Pair'` (pair the board’s middle card), `'Bottom Pair'` (pair the board’s lowest card).
- **Pocket pairs vs board:** `'Overpair'` (pocket pair above the board’s highest card), `'Underpair'` (pocket pair below the board’s lowest card), `'Middling Pair'` (pocket pair with rank strictly between the board’s highest and lowest, and that rank does not appear on the board; distinct from Middle Pair, which pairs a board card).

Criteria available for use with `makesHand()`, `hitsHand()`, and `hitsHandBoth()`:

- `'Top Pair'` - Top pair (pair the board’s highest card)
- `'Middle Pair'` - Middle pair (pair the board’s middle card)
- `'Bottom Pair'` - Bottom pair (pair the board’s lowest card)
- `'Overpair'` (or `'Over Pair'`, flag `isOverPair`) - Overpair (pocket pair above the board’s highest card)
- `'Underpair'` (or `'Under Pair'`) - Underpair (pocket pair below the board’s lowest card)
- `'Middling Pair'` - Middling pair (pocket pair between board high and low, rank not on board)

### Two Pair Categorization
- `'Top And Middle Pair'` - Top and middle pair
- `'Top And Bottom Pair'` - Top and bottom pair
- `'Middle And Bottom Pair'` - Middle and bottom pair

### Three of a Kind Categorization
- `'Top Three Of A Kind'` - Top three of a kind
- `'Middle Three Of A Kind'` - Middle three of a kind
- `'Bottom Three Of A Kind'` - Bottom three of a kind

### Draws
- `'Flush Draw'` - Flush draw
- `'Backdoor Flush Draw'` - Backdoor flush draw
- `'Open Ended Straight Draw'` - Open-ended straight draw
- `'Inside Straight Draw'` - Inside straight draw (gutshot)
- `'Straight Draw'` - Straight draw
- `'Combo Draw'` - Combo draw (both flush and straight draw)

Draws must use a hole card: four hearts on the board are not a flush draw for a hand without a heart.

### Wheel Straight Support
- `'Straight Wheel'` - Wheel straight (A-2-3-4-5)
- `'Open Ended Straight Draw Wheel'` - Open-ended wheel straight draw
- `'Inside Straight Draw Wheel'` - Inside wheel straight draw

### Hole Cards Against the Board

Each hole card is an overcard (above every board card), a middle card, an undercard (below every board card), or paired.

- `'Overcard'` - At least one overcard
- `'Two Overcards'` - Two overcards
- `'Overcard And Middle Card'` - One of each
- `'Overcard And Undercard'` - One of each
- `'Two Middle Cards'` - Two middle cards
- `'Middle And Undercard'` - One of each
- `'Two Undercards'` - Two undercards

---

## Method Chaining Examples

Every filter returns a new range, so filters chain. The original range never changes.

```javascript
import { RangeManager } from 'poker-rangeman';

const rm = new RangeManager('22+,AKs,AKo,AQs,AQo');
const result = rm
  .hasSuit('s')           // Hands with at least one spade
  .exclude(['As'])        // Remove hands with the As
  .intersect('AKs,AKo');  // Only keep AK

result.toNotation(); // 'AKo' (the only suited AK with a spade is AsKs, which holds the As)
```

### Chaining async steps

The board and equity filters are asynchronous: `makesHand()`, `hitsHand()`, `hitsHandBoth()`, `getEquity()`, `strongest()` and `weakest()`. They return a `RangeQuery`, a pending range you can keep chaining. Any filter can follow, and a single `await` at the end runs the steps in order and gives the final `RangeManager`:

```javascript
const board = ['Ah', 'Kd', '7c'];

const pairsWithSpade = await rm
  .makesHand(['Pair'], board)  // async
  .hasSuit('s');               // queued after it
pairsWithSpade.toNotation();   // 'QQ-88,66-22,AQs,AQo'

const strongPairs = await new RangeManager('22+,AK,AQ,KQ')
  .exclude(['Qh'])
  .makesHand(['Pair', 'Two Pair', 'Three of a Kind'], board)
  .getEquity('TT+,AK', board)  // one equity run per hand
  .equityAbove('50%')          // reads the stored equity
  .hasSuit('s');
```

- Awaiting each step separately works too: `(await rm.makesHand(['Pair'], board)).hasSuit('s')`.
- Without the `await`, the result is a `RangeQuery`, not a `RangeManager`. `rm.makesHand(['Pair'], board).hasSuit('s').size()` returns a Promise of the size.
- Methods that return a value (`size()`, `toArray()`, `toNotation()`, `contains()`, `equity()`, `breakdown()`, ...) return a Promise of that value when called on a pending chain. Use `toNotation()` there rather than `toString()`, which a `RangeQuery` does not override.
- An error in any step rejects the whole chain, so one `try`/`catch` (or `.catch()`) around the `await` covers every step.

---

## Examples

### Example 1: Basic Range Management

```javascript
import { RangeManager } from 'poker-rangeman';

// Create a tight range
const tight = new RangeManager('22+,AKs,AKo');
console.log(tight.size()); // 94

// Create a loose range (using Rank X notation)
const loose = new RangeManager('22+,A2s+,A2o+,K2s+,KXo');
console.log(loose.size()); // Much larger
// Note: KXo is equivalent to K2o+,AKo,KK
```

### Example 2: Dead Cards and Exclusion

```javascript
import { RangeManager } from 'poker-rangeman';

const rm = new RangeManager('22+,AKs,AKo');

// Remove hands with dead cards
const filtered = rm.exclude(['Ah', 'Kd', 'Qc']);
console.log('Original:', rm.size());     // 94
console.log('Filtered:', filtered.size()); // 91

// Check if specific hand is still available
console.log(filtered.contains('AhKh')); // false
console.log(filtered.contains('AcKc')); // true
```

### Example 3: Hand Strength Filtering

```javascript
import { RangeManager } from 'poker-rangeman';

const rm = new RangeManager('22+,AKs,AKo');
const board = ['Ah', 'Kd', 'Qc', 'Js', 'Th']; // Broadway straight

// Find all pairs
const pairs = await rm.makesHand(['Pair'], board);
console.log('Pairs:', pairs.toString());

// Find straights
const straights = await rm.makesHand(['Straight'], board);
console.log('Straights:', straights.toString());

// Find multiple criteria (OR logic)
const strong = await rm.makesHand(['Pair', 'Straight', 'Flush'], board);
console.log('Strong hands:', strong.toString());
```

### Example 4: Suit Filtering

```javascript
import { RangeManager } from 'poker-rangeman';

const rm = new RangeManager('A2s+,A2o+,22+');

// Filter hands with at least one spade
const spadeHands = rm.hasSuit('s');
console.log('Hands with spades:', spadeHands.size());
console.log('Examples:', spadeHands.toArray().slice(0, 5));

// Filter hands suited in hearts
const heartSuited = rm.suitedOf('h');
console.log('Hearts suited:', heartSuited.size());
console.log('Contains AhKh:', heartSuited.contains('AhKh')); // true
console.log('Contains AsKs:', heartSuited.contains('AsKs')); // false
```

### Example 5: Method Chaining

```javascript
import { RangeManager } from 'poker-rangeman';

const rm = new RangeManager('22+,AKs,AKo,AQs,AQo');
const board = ['Ah', 'Kd', 'Qc'];

// Chain sync and async filters with one await
const result = await rm
  .exclude(['As'])                    // Remove As
  .hasSuit('s')                       // Filter to spades
  .makesHand(['Two Pair'], board)     // Filter to two pair
  .intersect('AKo,AQo');              // Only keep offsuit AK and AQ

console.log(result.size());     // 4
console.log(result.toArray());  // ['AcKs', 'AdKs', 'AcQs', 'AdQs']
```

### Example 6: Include and Intersect

```javascript
import { RangeManager } from 'poker-rangeman';

// Start with a tight range
const rm = new RangeManager('22+,AKs');

// Add more hands
const expanded = rm.include('AKo');
console.log(expanded.toString()); // "22+,AKs,AKo"

// Find intersection with another range
const intersection = expanded.intersect('QQ+,AKs,AKo');
console.log(intersection.toString()); // "QQ,KK,AA,AKs,AKo"
```

### Example 7: Hand Evaluation API

```javascript
import { RangeManager } from 'poker-rangeman';

const rm = new RangeManager('AKs');
const board = ['Ah', 'Kd', 'Qc', 'Js', 'Th']; // Broadway straight board

// Evaluate a hand and check criteria
const eval = await rm.evaluateHand('AcKc', board);

// Check if hand matches ANY of these (OR logic)
const pairsOrStraights = eval.is(['Pair', 'Straight']);
if (Object.keys(pairsOrStraights).length > 0) {
  console.log('Hand has pair or straight!');
}

// Check if hand matches ALL criteria (AND logic)
const flushAndStraight = eval.isAll(['Flush', 'Straight']);
if (Object.keys(flushAndStraight).length > 0) {
  console.log('Hand is a straight flush!');
}

// Single criterion
const isPair = eval.is('Pair');
console.log('Is pair:', Object.keys(isPair).length > 0);
```

### Example 8: Hits Hand Methods

```javascript
import { RangeManager } from 'poker-rangeman';

const rm = new RangeManager('22+,AKs,AKo');
const board = ['Ah', 'Kd', 'Qc', 'Js', 'Th'];

// Find hands where at least one card is used
const oneCard = await rm.hitsHand(['Pair'], board);
console.log('Hands using at least one card:', oneCard.size());

// Find hands where both cards are used
const bothCards = await rm.hitsHandBoth(['Pair'], board);
console.log('Hands using both cards:', bothCards.size());
```

### Example 9: Key Cards and Kickers

```javascript
import { RangeManager } from 'poker-rangeman';

const rm = new RangeManager('22+,AKs,AKo,AQs,AQo');
const board = ['As', '8d', '5c'];

// First, filter to hands that hit a pair
const hitHands = await rm.hitsHand(['Pair'], board);

// Filter to hands where As is a key card
const withAsKeyCard = hitHands.hasKeyCard(['As']);
console.log('Hands with As as key card:', withAsKeyCard.toString());

// Filter to hands where Kd is a kicker
const withKdKicker = hitHands.hasKicker(['Kd']);
console.log('Hands with Kd as kicker:', withKdKicker.toString());

// Chain methods together: pairs of aces with a king kicker
const result = await rm
  .hitsHand(['Pair'], board)
  .hasKeyCard(['As'])
  .hasKicker(['Kx']);
console.log('Hands with As key card and a king kicker:', result.toNotation()); // 'AKs,AKo'

// Use wildcards
const withAnyAceKeyCard = hitHands.hasKeyCard(['Ax']);
console.log('Hands with any Ace as key card:', withAnyAceKeyCard.size());

// Check specific hand strength
const topPairWithAs = hitHands.hasKeyCard(['As'], false, 'Top Pair');
console.log('Top pairs with As:', topPairWithAs.toString());
```

### Example 10: Notation Abbreviation

```javascript
import { RangeManager } from 'poker-rangeman';

// Create a range
const rm = new RangeManager('22,33,44,55,66,77,88,99,TT,JJ,QQ,KK,AA,AKs');

// Get full notation
console.log(rm.toString());   // "22,33,44,55,66,77,88,99,TT,JJ,QQ,KK,AA,AKs"

// Get abbreviated notation
console.log(rm.toNotation()); // "22+,AKs"

// Another example
const rm2 = new RangeManager('A2s,A3s,A4s,A5s,A6s,AJs');
console.log(rm2.toString());   // "A2s,A3s,A4s,A5s,A6s,AJs"
console.log(rm2.toNotation()); // "A2s-A6s,AJs"

// With dead cards - notation still abbreviates correctly
const rm3 = new RangeManager('22-AA,AKs,AKo');
const filtered = rm3.exclude(['Ah', 'Kd']);
console.log('Original:', rm3.toNotation());     // "22+,AKs,AKo"
console.log('Filtered:', filtered.toNotation()); // Abbreviated notation without Ah/Kd hands

// Dead cards breaking up ranges
const rm4 = new RangeManager('AKs');
const filtered2 = rm4.exclude(['Ah']); // Removes AhKh
console.log(filtered2.toNotation());   // Still abbreviated (e.g., "AKs" or individual hands)
```

---

## TypeScript

Types ship with the package (`index.d.ts`) and cover every method, option and criterion:

```typescript
import { RangeManager, RangeQuery, type Criterion, type EquityResult } from 'poker-rangeman';
```

## Releasing

- **Tests** (`.github/workflows/test.yml`) run on every push and pull request, on the oldest supported and current Node versions, and type-check `index.d.ts`.
- **Publishing** (`.github/workflows/publish.yml`) runs when a push to `main` changes `src/`, `index.d.ts` or `package.json`; docs or test changes alone do not publish. It runs the tests, then:
  - if `package.json` holds a version newer than npm's latest (e.g. after `npm version minor --no-git-tag-version`), publishes that version;
  - otherwise bumps the patch past npm's latest and commits the bump back to `main`.

  It then tags the release `v<version>` and publishes with npm trusted publishing (no stored token, with provenance). It can also be started by hand from the Actions tab.

## License

MIT

## Author

Poker Range Manager - A tool for managing and analyzing poker hand ranges.
