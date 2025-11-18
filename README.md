# Poker Range Manager

A comprehensive JavaScript library for parsing, managing, and filtering poker hand ranges with support for dead cards, board cards, and hand strength evaluation.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [Constructor](#constructor)
  - [Query Methods](#query-methods)
  - [Filtering Methods](#filtering-methods)
  - [Evaluation Methods](#evaluation-methods)
- [Range Notation Guide](#range-notation-guide)
- [Hand Strength Criteria](#hand-strength-criteria)
- [Method Chaining Examples](#method-chaining-examples)
- [Examples](#examples)

## Installation

```bash
npm install poker-rangeman
```

The library uses ES modules and requires Node.js 14+. It's available on [npm](https://www.npmjs.com/package/poker-rangeman).

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
- `deadCards` (string[], optional): Array of dead cards (e.g., `['Ah', 'Kd']`)

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

Returns the range as an abbreviated notation string, using `+` and `-` notation where possible.

**Returns:** `string` - Abbreviated range notation

**Example:**
```javascript
const rm = new RangeManager('22,33,44,55,66,77,88,99,TT,JJ,QQ,KK,AA,AKs');
rm.toString();    // "22,33,44,55,66,77,88,99,TT,JJ,QQ,KK,AA,AKs"
rm.toNotation();  // "22+,AKs"

const rm2 = new RangeManager('A2s,A3s,A4s,A5s,A6s,AJs');
rm2.toString();   // "A2s,A3s,A4s,A5s,A6s,AJs"
rm2.toNotation(); // "A2s-A6s,AJs"
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

#### `makesHand(criteria, boardCards)`

Filters the range to only include hands that make the specified strength criteria on the given board. Requires at least 3 board cards.

**Parameters:**
- `criteria` (string[]): Array of hand strength criteria (e.g., `['Pair', 'Straight']`)
- `boardCards` (string[]): Array of board cards (must have at least 3 cards)

**Returns:** `Promise<RangeManager>` - Promise resolving to new instance with matching hands

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

#### `hitsHand(criteria, boardCards)`

Filters the range to only include hands where at least one hand card is used in making the specified criteria. Requires at least 3 board cards.

**Parameters:**
- `criteria` (string[]): Array of hand strength criteria
- `boardCards` (string[]): Array of board cards (must have at least 3 cards)

**Returns:** `Promise<RangeManager>` - Promise resolving to new instance with matching hands

**Example:**
```javascript
const rm = new RangeManager('22+,AKs,AKo');
const board = ['Ah', 'Kd', 'Qc', 'Js', 'Th'];

// Find hands where at least one card is used in making a pair
const hands = await rm.hitsHand(['Pair'], board);
```

**Note:** This method is asynchronous and requires the `poker-extval` library for hand evaluation.

#### `hitsHandBoth(criteria, boardCards)`

Filters the range to only include hands where both hand cards are used in making the specified criteria. Requires at least 3 board cards.

**Parameters:**
- `criteria` (string[]): Array of hand strength criteria
- `boardCards` (string[]): Array of board cards (must have at least 3 cards)

**Returns:** `Promise<RangeManager>` - Promise resolving to new instance with matching hands

**Example:**
```javascript
const rm = new RangeManager('22+,AKs,AKo');
const board = ['Ah', 'Kd', 'Qc', 'Js', 'Th'];

// Find hands where both cards are used in making a pair
const hands = await rm.hitsHandBoth(['Pair'], board);
```

**Note:** This method is asynchronous and requires the `poker-extval` library for hand evaluation.

#### `setDeadCards(deadCards)`

Sets dead cards for evaluation purposes. Dead cards limit which hands can be dealt but don't directly filter the range.

**Parameters:**
- `deadCards` (string[]): Array of dead cards (2-character strings, e.g., `['Ah', 'Kd']`). Supports wildcards: `'Ax'` (all Aces), `'Xh'` (all hearts)

**Returns:** `RangeManager` - New instance with dead cards set

**Example:**
```javascript
const rm = new RangeManager('22+,AKs,AKo');
const withDeadCards = rm.setDeadCards(['Ah', 'Kd']);
// Dead cards are used for evaluation but don't change the active range

// Wildcard support
const withWildcards = rm.setDeadCards(['Ax', 'Xh']); // All Aces and all hearts
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

#### `evaluateHand(hand, boardCards)`

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

#### `getObject(hand, boardCards)`

Returns the raw evaluation object from `poker-extval` for a single hand.

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

## Range Notation Guide

### Pairs

- `AA` - Pocket Aces (6 combinations)
- `22+` - All pairs from 22 to AA (78 combinations)
- `22-55` - Pairs from 22 to 55 (inclusive)

### Suited Hands

- `AKs` - Ace-King suited (4 combinations)
- `A2s+` - All suited hands from A2s to AKs (48 combinations)
- `A3s-A6s` - Suited range from A3s to A6s (16 combinations)

### Offsuit Hands

- `AKo` - Ace-King offsuit (12 combinations)
- `A2o+` - All offsuit hands from A2o to AKo (144 combinations)
- `A3o-A6o` - Offsuit range from A3o to A6o (48 combinations)

### Wildcards

- `AxKs` - Ace-X suited with King kicker (X excludes A and K)
- `KxAh` - King-X offsuit with Ace kicker

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

The following criteria can be used with the `makesHand()`, `hitsHand()`, and `hitsHandBoth()` methods. All criteria are directly supported by `poker-extval`:

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
- `'Top Pair'` - Top pair
- `'Middle Pair'` - Middle pair
- `'Bottom Pair'` - Bottom pair
- `'Underpair'` - Underpair (pocket pair lower than board)

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

### Wheel Straight Support
- `'Straight Wheel'` - Wheel straight (A-2-3-4-5)
- `'Open Ended Straight Draw Wheel'` - Open-ended wheel straight draw
- `'Inside Straight Draw Wheel'` - Inside wheel straight draw

---

## Method Chaining Examples

The `RangeManager` API is designed for fluent method chaining. Almost all filtering methods return a new `RangeManager` instance, allowing you to chain operations:

```javascript
import { RangeManager } from 'poker-rangeman';

// Chain multiple filters
const rm = new RangeManager('22+,AKs,AKo,AQs,AQo');
const result = rm
  .hasSuit('s')           // Filter to hands with at least one spade
  .exclude(['As'])        // Remove hands with As
  .intersect('AKs,AKo');  // Only keep AKs and AKo

console.log(result.toString()); // "AKs,AKo" (without As)

// Chain with async methods
const board = ['Ah', 'Kd', 'Qc', 'Js', 'Th'];
const filtered = await rm
  .makesHand(['Pair'], board)  // Filter to pairs
  .hasSuit('s');               // Then filter to spades

// Complex chaining
const complex = await new RangeManager('22+,AKs,AKo,AQs,AQo')
  .exclude(['Ah', 'Kd'])           // Remove dead cards
  .hasSuit('s')                    // Filter to spades
  .makesHand(['Pair', 'Straight'], board)  // Filter to pairs or straights
  .intersect('AKs');               // Only keep AKs

console.log(complex.size());
```

**Note:** When chaining async methods, make sure to `await` the entire chain:

```javascript
// Correct
const result = await rm.makesHand(['Pair'], board).hasSuit('s');

// Incorrect - will not work
const result = rm.makesHand(['Pair'], board).hasSuit('s'); // Missing await
```

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

// Chain multiple filters
const result = await rm
  .exclude(['As'])                    // Remove As
  .hasSuit('s')                       // Filter to spades
  .makesHand(['Pair'], board)         // Filter to pairs
  .intersect('AKs');                  // Only keep AKs

console.log(result.size());
console.log(result.toString());
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
const board = ['Ah', 'Kd', 'Qc'];

// First, filter to hands that hit a pair
const hitHands = await rm.hitsHand(['Pair'], board);

// Filter to hands where As is a key card
const withAsKeyCard = hitHands.hasKeyCard(['As']);
console.log('Hands with As as key card:', withAsKeyCard.toString());

// Filter to hands where Kd is a kicker
const withKdKicker = hitHands.hasKicker(['Kd']);
console.log('Hands with Kd as kicker:', withKdKicker.toString());

// Chain methods together
const result = await rm
  .hitsHand(['Pair'], board)
  .hasKeyCard(['As'])
  .hasKicker(['Kd']);
console.log('Hands with As key card and Kd kicker:', result.toString());

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
```

---

## License

MIT

## Author

Poker Range Manager - A tool for managing and analyzing poker hand ranges.
