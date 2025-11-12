# Poker Range Manager

A comprehensive JavaScript library for parsing, managing, and filtering poker hand ranges with support for dead cards, board cards, and hand strength evaluation.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [Constructor](#constructor)
  - [Query Methods](#query-methods)
  - [Filtering Methods](#filtering-methods)
  - [Validation Methods](#validation-methods)
  - [Normalization Methods](#normalization-methods)
  - [Pattern Detection Methods](#pattern-detection-methods)
  - [Extraction Methods](#extraction-methods)
  - [Generation Methods](#generation-methods)
  - [Parsing Methods](#parsing-methods)
- [Range Notation Guide](#range-notation-guide)
- [Hand Strength Criteria](#hand-strength-criteria)
- [Examples](#examples)

## Installation

```bash
npm install poker-rangeman
```

The library uses ES modules and requires Node.js 14+.

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
const pairs = await rm.match(['Pair'], board);
console.log(pairs.toString());
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

---

### Filtering Methods

#### `exclude(deadCards)`

Filters out hands containing any of the specified dead cards. Returns a new RangeManager instance (immutable).

**Parameters:**
- `deadCards` (string[]): Array of dead cards (e.g., `['Ah', 'Kd', 'Qc']`)

**Returns:** `RangeManager` - New instance with filtered hands

**Example:**
```javascript
const rm = new RangeManager('AKs');
const filtered = rm.exclude(['Ah']);
filtered.size();        // 3 (removed AhKh)
rm.size();              // 4 (original unchanged)
```

**Throws:**
- `Error`: If deadCards is not an array

#### `match(criteria, boardCards)`

Filters the range to only include hands that match the specified strength criteria on the given board. Returns a Promise that resolves to a new RangeManager instance.

**Parameters:**
- `criteria` (string[]): Array of hand strength criteria (e.g., `['Pair', 'Straight']`)
- `boardCards` (string[]): Array of board cards (must have at least 3 cards)

**Returns:** `Promise<RangeManager>` - Promise resolving to new instance with matching hands

**Example:**
```javascript
const rm = new RangeManager('22+,AKs,AKo');
const board = ['Ah', 'Kd', 'Qc', 'Js', 'Th']; // Broadway straight board

// Find pairs
const pairs = await rm.match(['Pair'], board);
pairs.toString();

// Find multiple criteria
const strong = await rm.match(['Pair', 'Straight', 'Flush'], board);
```

**Throws:**
- `Error`: If criteria is not an array
- `Error`: If boardCards is empty or invalid
- `Error`: If invalid criteria are provided

**Note:** This method is asynchronous and requires the `poker-extval` library for hand evaluation.

---

### Validation Methods

#### `isValidRank(rank)`

Checks if a rank is valid.

**Parameters:**
- `rank` (string): Card rank (`'A'`, `'K'`, `'Q'`, `'J'`, `'T'`, `'9'`-`'2'`)

**Returns:** `boolean`

**Example:**
```javascript
rm.isValidRank('A'); // true
rm.isValidRank('Z'); // false
```

#### `isValidSuit(suit)`

Checks if a suit is valid.

**Parameters:**
- `suit` (string): Card suit (`'s'`, `'h'`, `'d'`, `'c'`)

**Returns:** `boolean`

**Example:**
```javascript
rm.isValidSuit('s'); // true
rm.isValidSuit('x'); // false
```

#### `isValidCard(card)`

Checks if a card string is valid.

**Parameters:**
- `card` (string): Card notation (e.g., `'Ac'`, `'Kh'`)

**Returns:** `boolean`

**Example:**
```javascript
rm.isValidCard('Ac'); // true
rm.isValidCard('Ax'); // false
rm.isValidCard('Zc'); // false
```

#### `isValidHand(hand)`

Checks if a hand string is valid (4 characters, two different cards).

**Parameters:**
- `hand` (string): Hand notation (e.g., `'AcKc'`)

**Returns:** `boolean`

**Example:**
```javascript
rm.isValidHand('AcKc'); // true
rm.isValidHand('AcAc'); // false (duplicate cards)
rm.isValidHand('Ac');   // false (too short)
```

---

### Normalization Methods

#### `normalizeHand(hand)`

Normalizes a hand string by ordering cards by rank (higher rank first) and suits.

**Parameters:**
- `hand` (string): Hand notation

**Returns:** `string` - Normalized hand

**Example:**
```javascript
rm.normalizeHand('KcAc'); // 'AcKc'
rm.normalizeHand('2h3d'); // '3d2h' (3 > 2)
rm.normalizeHand('AcAd'); // 'AcAd' (pairs sorted by suit)
```

**Throws:**
- `Error`: If hand is invalid

#### `normalizeNotation(notation)`

Normalizes range notation string (uppercases ranks, preserves 's'/'o' suffixes).

**Parameters:**
- `notation` (string): Range notation

**Returns:** `string` - Normalized notation

**Example:**
```javascript
rm.normalizeNotation('aks,ako');     // 'AKs,AKo'
rm.normalizeNotation('22+');         // '22+'
rm.normalizeNotation('a3s-a6s');     // 'A3s-A6s'
```

#### `normalizeCardOrder(card1, card2)`

Orders two cards by rank (higher rank first).

**Parameters:**
- `card1` (string): First card
- `card2` (string): Second card

**Returns:** `[string, string]` - Array with [higher, lower] cards

**Example:**
```javascript
rm.normalizeCardOrder('Kc', 'Ac'); // ['Ac', 'Kc']
rm.normalizeCardOrder('Ac', 'Kc'); // ['Ac', 'Kc']
```

---

### Pattern Detection Methods

#### `isPairNotation(segment)`

Checks if a notation segment represents a pair or pair range.

**Parameters:**
- `segment` (string): Notation segment

**Returns:** `boolean`

**Example:**
```javascript
rm.isPairNotation('AA');   // true
rm.isPairNotation('22+');  // true
rm.isPairNotation('22-55'); // true
rm.isPairNotation('AKs');  // false
```

#### `isSuitedNotation(segment)`

Checks if a notation segment represents a suited hand or range.

**Parameters:**
- `segment` (string): Notation segment

**Returns:** `boolean`

**Example:**
```javascript
rm.isSuitedNotation('AKs');    // true
rm.isSuitedNotation('A2s+');   // true
rm.isSuitedNotation('A3s-A6s'); // true
rm.isSuitedNotation('AKo');    // false
```

#### `isOffsuitNotation(segment)`

Checks if a notation segment represents an offsuit hand or range.

**Parameters:**
- `segment` (string): Notation segment

**Returns:** `boolean`

**Example:**
```javascript
rm.isOffsuitNotation('AKo');    // true
rm.isOffsuitNotation('A2o+');   // true
rm.isOffsuitNotation('A3o-A6o'); // true
rm.isOffsuitNotation('AKs');    // false
```

#### `isWildcardNotation(segment)`

Checks if a notation segment represents a wildcard hand.

**Parameters:**
- `segment` (string): Notation segment (must be 4 characters with 'X' or 'x')

**Returns:** `boolean`

**Example:**
```javascript
rm.isWildcardNotation('AxKs'); // true
rm.isWildcardNotation('KxAh'); // true
rm.isWildcardNotation('AKs');  // false
```

#### `detectNotationType(segment)`

Detects the type of notation segment.

**Parameters:**
- `segment` (string): Notation segment

**Returns:** `string | null` - One of: `'pair'`, `'suited'`, `'offsuit'`, `'wildcard'`, `'specific'`, or `null`

**Example:**
```javascript
rm.detectNotationType('AA');   // 'pair'
rm.detectNotationType('AKs');  // 'suited'
rm.detectNotationType('AKo');  // 'offsuit'
rm.detectNotationType('AxKs'); // 'wildcard'
rm.detectNotationType('AcKc'); // 'specific'
```

---

### Extraction Methods

#### `extractCardsFromHand(hand)`

Extracts the two cards from a hand string.

**Parameters:**
- `hand` (string): Hand notation (4 characters)

**Returns:** `string[]` - Array of two cards `[card1, card2]`

**Example:**
```javascript
rm.extractCardsFromHand('AcKc'); // ['Ac', 'Kc']
```

#### `extractPairRanks(range)`

Extracts start and end ranks from a pair range notation.

**Parameters:**
- `range` (string): Pair range (e.g., `'22+'`, `'AA'`, `'22-55'`)

**Returns:** `[string, string]` - Array with `[startRank, endRank]`

**Example:**
```javascript
rm.extractPairRanks('22+');  // ['2', 'A']
rm.extractPairRanks('AA');   // ['A', 'A']
rm.extractPairRanks('22-55'); // ['2', '5']
```

#### `extractSuitedRanks(range)`

Extracts rank information from a suited range notation.

**Parameters:**
- `range` (string): Suited range (e.g., `'AKs'`, `'A2s+'`, `'A3s-A6s'`)

**Returns:** `object | null` - Object with rank information or null if invalid

**Example:**
```javascript
rm.extractSuitedRanks('AKs');    // {rank1: 'A', rank2: 'K'}
rm.extractSuitedRanks('A2s+');   // {rank1: 'A', rank2: '2', isPlus: true}
rm.extractSuitedRanks('A3s-A6s'); // {rank1: 'A', rank2: '3', endRank1: 'A', endRank2: '6'}
```

#### `extractOffsuitRanks(range)`

Extracts rank information from an offsuit range notation.

**Parameters:**
- `range` (string): Offsuit range (e.g., `'AKo'`, `'A2o+'`, `'A3o-A6o'`)

**Returns:** `object | null` - Object with rank information or null if invalid

**Example:**
```javascript
rm.extractOffsuitRanks('AKo');    // {rank1: 'A', rank2: 'K'}
rm.extractOffsuitRanks('A2o+');   // {rank1: 'A', rank2: '2', isPlus: true}
```

#### `extractWildcardHand(hand)`

Extracts information from a wildcard hand notation.

**Parameters:**
- `hand` (string): Wildcard hand (e.g., `'AxKs'`, `'KxAh'`)

**Returns:** `object | null` - Object with wildcard information or null if invalid

**Example:**
```javascript
rm.extractWildcardHand('AxKs'); // {card1Rank: 'A', card1SuitWildcard: true, ...}
```

---

### Generation Methods

#### `generatePairCombinations(rank)`

Generates all pair combinations for a given rank.

**Parameters:**
- `rank` (string): Card rank

**Returns:** `string[]` - Array of normalized pair hands

**Example:**
```javascript
rm.generatePairCombinations('A'); 
// ['AcAd', 'AcAh', 'AcAs', 'AdAh', 'AdAs', 'AhAs']
```

#### `generatePairRange(start, end)`

Generates all pairs between two ranks (inclusive).

**Parameters:**
- `start` (string): Start rank
- `end` (string): End rank

**Returns:** `string[]` - Array of normalized pair hands

**Example:**
```javascript
rm.generatePairRange('2', 'A'); // All pairs from 22 to AA
```

#### `generateSuitedRange(rank1, rank2)`

Generates all suited combinations for two ranks.

**Parameters:**
- `rank1` (string): First rank (higher)
- `rank2` (string): Second rank (lower)

**Returns:** `string[]` - Array of normalized suited hands

**Example:**
```javascript
rm.generateSuitedRange('A', 'K'); // ['AcKc', 'AdKd', 'AhKh', 'AsKs']
```

#### `generateOffsuitRange(rank1, rank2)`

Generates all offsuit combinations for two ranks.

**Parameters:**
- `rank1` (string): First rank (higher)
- `rank2` (string): Second rank (lower)

**Returns:** `string[]` - Array of normalized offsuit hands

**Example:**
```javascript
rm.generateOffsuitRange('A', 'K'); // ['AcKd', 'AcKh', 'AcKs', 'AdKc', ...] (12 combos)
```

#### `generateWildcardCombinations(hand)`

Generates all combinations matching a wildcard pattern.

**Parameters:**
- `hand` (string): Wildcard hand (e.g., `'AxKs'`)

**Returns:** `string[]` - Array of normalized hands matching the pattern

**Example:**
```javascript
rm.generateWildcardCombinations('AxKs'); // All A-X suited hands with K kicker
```

---

### Parsing Methods

#### `parsePairRange(range)`

Parses a pair range notation and returns all matching hands.

**Parameters:**
- `range` (string): Pair range (e.g., `'22+'`, `'AA'`, `'22-55'`)

**Returns:** `string[]` - Array of normalized hands

**Throws:**
- `Error`: If range is invalid

**Example:**
```javascript
rm.parsePairRange('22+'); // All pairs from 22 to AA
rm.parsePairRange('AA');  // Just AA (6 combos)
```

#### `parseSuitedRange(range)`

Parses a suited range notation and returns all matching hands.

**Parameters:**
- `range` (string): Suited range (e.g., `'AKs'`, `'A2s+'`, `'A3s-A6s'`)

**Returns:** `string[]` - Array of normalized hands

**Throws:**
- `Error`: If range is invalid

**Example:**
```javascript
rm.parseSuitedRange('AKs');    // ['AcKc', 'AdKd', 'AhKh', 'AsKs']
rm.parseSuitedRange('A2s+');   // All A2s through AKs
```

#### `parseOffsuitRange(range)`

Parses an offsuit range notation and returns all matching hands.

**Parameters:**
- `range` (string): Offsuit range (e.g., `'AKo'`, `'A2o+'`, `'A3o-A6o'`)

**Returns:** `string[]` - Array of normalized hands

**Throws:**
- `Error`: If range is invalid

**Example:**
```javascript
rm.parseOffsuitRange('AKo');    // All AK offsuit combinations (12)
rm.parseOffsuitRange('A2o+');   // All A2o through AKo
```

#### `parseWildcardHand(hand)`

Parses a wildcard hand and returns all matching combinations.

**Parameters:**
- `hand` (string): Wildcard hand (e.g., `'AxKs'`)

**Returns:** `string[]` - Array of normalized hands

**Example:**
```javascript
rm.parseWildcardHand('AxKs'); // All combinations matching the pattern
```

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

### Combining Notations

Use commas to separate different notation types:

```javascript
'22+,AKs,AKo'  // All pairs 22+, plus AKs, plus AKo
'A2s+,KQo'     // All suited A2s+, plus KQo
```

---

## Hand Strength Criteria

The following criteria can be used with the `match()` method:

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

### Pair Types
- `'Top Pair'` - Top pair
- `'Middle Pair'` - Middle pair
- `'Bottom Pair'` - Bottom pair
- `'Overpair'` - Overpair (pocket pair higher than board)

### Sets/Trips
- `'Set'` - Set (pocket pair + one on board)
- `'Trips'` - Trips (one in hand + pair on board)
- `'Top Set'` - Top set
- `'Middle Set'` - Middle set
- `'Bottom Set'` - Bottom set
- `'Top Trips'` - Top trips
- `'Middle Trips'` - Middle trips
- `'Bottom Trips'` - Bottom trips

### Two Pair Types
- `'Top Two Pair'` - Top two pair
- `'Middle Two Pair'` - Middle two pair
- `'Bottom Two Pair'` - Bottom two pair

### Kickers
- `'Top Kicker'` - Top kicker
- `'Middle Kicker'` - Middle kicker
- `'Bottom Kicker'` - Bottom kicker
- `'Ace Kicker'` - Ace kicker
- `'King Kicker'` - King kicker

### Draws
- `'Flush Draw'` - Flush draw
- `'Straight Draw'` - Straight draw
- `'Gutshot Straight Draw'` - Gutshot straight draw
- `'Open Ended Straight Draw'` - Open-ended straight draw
- `'Backdoor Flush Draw'` - Backdoor flush draw
- `'Backdoor Straight Draw'` - Backdoor straight draw

### High Cards
- `'Ace High'` - Ace high
- `'King High'` - King high
- `'Queen High'` - Queen high
- `'Jack High'` - Jack high
- `'No Pair'` - No pair
- `'High Card'` - High card

---

## Examples

### Example 1: Basic Range Management

```javascript
import { RangeManager } from 'poker-rangeman';

// Create a tight range
const tight = new RangeManager('22+,AKs,AKo');
console.log(tight.size()); // 94

// Create a loose range
const loose = new RangeManager('22+,A2s+,A2o+,K2s+,K2o+');
console.log(loose.size()); // Much larger
```

### Example 2: Dead Cards

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
const pairs = await rm.match(['Pair'], board);
console.log('Pairs:', pairs.toString());

// Find straights
const straights = await rm.match(['Straight'], board);
console.log('Straights:', straights.toString());

// Find multiple criteria
const strong = await rm.match(['Pair', 'Straight', 'Flush'], board);
console.log('Strong hands:', strong.toString());
```

### Example 4: Complex Range Parsing

```javascript
import { RangeManager } from 'poker-rangeman';

// Parse various notation types
const rm1 = new RangeManager('22+,AKs,AKo');
const rm2 = new RangeManager('A2s+,KQo');
const rm3 = new RangeManager('AA,KK,QQ,JJ,TT');
const rm4 = new RangeManager('AxKs'); // Wildcard

console.log('22+ range:', rm1.size());
console.log('A2s+ range:', rm2.size());
console.log('Top pairs:', rm3.size());
console.log('Wildcard:', rm4.size());
```

### Example 5: Immutability

```javascript
import { RangeManager } from 'poker-rangeman';

const rm = new RangeManager('22+,AKs,AKo');
const originalSize = rm.size();

// Filtering returns a new instance
const filtered = rm.exclude(['Ah']);

// Original is unchanged
console.log(rm.size() === originalSize); // true
console.log(filtered.size() < originalSize); // true
```

### Example 6: Validation

```javascript
import { RangeManager } from 'poker-rangeman';

const rm = new RangeManager('AKs');

// Validate inputs
console.log(rm.isValidRank('A'));  // true
console.log(rm.isValidRank('Z'));  // false
console.log(rm.isValidCard('Ac')); // true
console.log(rm.isValidHand('AcKc')); // true
console.log(rm.isValidHand('AcAc')); // false (duplicate)
```

---

## License

MIT

## Author

Poker Range Manager - A tool for managing and analyzing poker hand ranges.

