import { RangeManager } from '../src/rangeManager.js';

// ============================================================================
// TEST IMPLEMENTATIONS - Must be defined before describe blocks
// ============================================================================

// Helper functions and test data
const VALID_CARDS = ['As', 'Ah', 'Ad', 'Ac', 'Ks', 'Kh', 'Kd', 'Kc', 'Qs', 'Qh', 'Qd', 'Qc'];
const VALID_HANDS = ['AhKd', 'AsKs', 'KhQh', 'AdKc'];
const VALID_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const VALID_SUITS = ['s', 'h', 'd', 'c'];

// Helper function to create RangeManager instance for testing private methods
function createTestInstance(input, deadCards = []) {
  return new RangeManager(input, deadCards);
}

// ============================================================================
// NORMALIZATION TEST IMPLEMENTATIONS
// ============================================================================

const testNormalization = {
  normalizeNotation: {
    trimWhitespace: () => {
      const rm = createTestInstance('AKs');
      expect(rm.normalizeNotation('  AKs  ')).toBe('AKs');
      expect(rm.normalizeNotation('22-AA, AKs')).toContain('22-AA');
    },
    caseConversion: () => {
      const rm = createTestInstance('AKs');
      const normalized = rm.normalizeNotation('aks');
      expect(normalized).toBe('AKs');
    },
    multipleSpaces: () => {
      const rm = createTestInstance('AKs');
      const normalized = rm.normalizeNotation('22-AA,   AKs');
      expect(normalized).not.toMatch(/\s{2,}/);
    }
  }
};


// ============================================================================
// FILTERING TEST IMPLEMENTATIONS
// ============================================================================

const testConstructor = {
    string: () => {
      const rm = new RangeManager('AKs');
      expect(rm).toBeInstanceOf(RangeManager);
      expect(rm.size()).toBe(4);
    },
    array: () => {
      const rm = new RangeManager(['AhKd', 'AsKs']);
      expect(rm).toBeInstanceOf(RangeManager);
      expect(rm.size()).toBe(2);
    },
    deadCards: () => {
      const rm = new RangeManager('AKs', ['Ah']);
      expect(rm.deadCards).toContain('Ah');
    },
    parse: () => {
      const rm = new RangeManager('22-AA');
      expect(rm.size()).toBeGreaterThan(0);
    },
    rawInput: () => {
      const rm = new RangeManager('AKs');
      expect(rm.rawInput).toBe('AKs');
    },
    deadCardsStored: () => {
      const rm = new RangeManager('AKs', ['Ah', 'Kd']);
      expect(rm.deadCards.length).toBe(2);
    },
    filteredHands: () => {
      const rm = new RangeManager('AKs');
      expect(Array.isArray(rm.filteredHands)).toBe(true);
    }
};

const testErrors = {
    invalidCard: () => {
      expect(() => new RangeManager('XKs')).toThrow();
    },
    invalidNotation: () => {
      expect(() => new RangeManager('invalid')).toThrow();
    },
    empty: () => {
      expect(() => new RangeManager('')).toThrow();
    },
    invalidType: () => {
      expect(() => new RangeManager(123)).toThrow();
  }
};

// ============================================================================
// FILTERING TEST IMPLEMENTATIONS
// ============================================================================

const testFiltering = {
  exclude: {
    filter: () => {
      const rm = new RangeManager('AKs');
      const filtered = rm.exclude(['Ah']);
      expect(filtered.size()).toBeLessThan(rm.size());
      expect(filtered.contains('AhKs')).toBe(false);
    },
    newInstance: () => {
      const rm = new RangeManager('AKs');
      const filtered = rm.exclude(['Ah']);
      expect(filtered).toBeInstanceOf(RangeManager);
      expect(filtered).not.toBe(rm);
    },
    immutable: () => {
      const rm = new RangeManager('AKs');
      const originalSize = rm.size();
      rm.exclude(['Ah']);
      expect(rm.size()).toBe(originalSize);
    },
    multiple: () => {
      const rm = new RangeManager('AKs');
      const filtered = rm.exclude(['Ah', 'Ks']);
      expect(filtered.size()).toBeLessThan(rm.size());
    },
    empty: () => {
      const rm = new RangeManager('AKs');
      const filtered = rm.exclude([]);
      expect(filtered.size()).toBe(rm.size());
    }
  },
  handContainsDeadCard: {
    detect: () => {
      const rm = createTestInstance('AKs');
      expect(rm.handContainsDeadCard('AhKd', ['Ah'])).toBe(true);
    },
    bothCards: () => {
      const rm = createTestInstance('AKs');
      expect(rm.handContainsDeadCard('AhKd', ['Kd'])).toBe(true);
      expect(rm.handContainsDeadCard('AhKd', ['Ah'])).toBe(true);
    },
    noMatch: () => {
      const rm = createTestInstance('AKs');
      expect(rm.handContainsDeadCard('AhKd', ['Qs'])).toBe(false);
    },
    multiple: () => {
      const rm = createTestInstance('AKs');
      expect(rm.handContainsDeadCard('AhKd', ['Qs', 'Ah'])).toBe(true);
    }
  },
  makesHand: {
    filter: async () => {
      const rm = new RangeManager('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const filtered = await rm.makesHand(['Pair'], board);
      expect(filtered).toBeInstanceOf(RangeManager);
    },
    requiresBoard: async () => {
      const rm = new RangeManager('AKs');
      await expect(rm.makesHand(['Pair'])).rejects.toThrow();
    },
    errorNoBoard: async () => {
      const rm = new RangeManager('AKs');
      await expect(rm.makesHand(['Pair'])).rejects.toThrow();
    },
    newInstance: async () => {
      const rm = new RangeManager('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const filtered = await rm.makesHand(['Pair'], board);
      expect(filtered).not.toBe(rm);
    },
    immutable: async () => {
      const rm = new RangeManager('AKs');
      const originalSize = rm.size();
      const board = ['2h', '3d', '4c', '5s', '6h'];
      await rm.makesHand(['Pair'], board);
      expect(rm.size()).toBe(originalSize);
    },
    multiple: async () => {
      const rm = new RangeManager('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const filtered = await rm.makesHand(['Pair', 'Two Pair'], board);
      expect(filtered).toBeInstanceOf(RangeManager);
    },
    normalize: async () => {
      const rm = new RangeManager('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const filtered = await rm.makesHand(['Pair'], board);
      expect(filtered).toBeInstanceOf(RangeManager);
    }
  },
  handHasSuit: {
    detect: () => {
      const rm = createTestInstance('AKs');
      expect(rm.handHasSuit('AhKd', 'h')).toBe(true);
      expect(rm.handHasSuit('AhKd', 'd')).toBe(true);
    },
    bothCards: () => {
      const rm = createTestInstance('AKs');
      expect(rm.handHasSuit('AhKh', 'h')).toBe(true);
    },
    noMatch: () => {
      const rm = createTestInstance('AKs');
      expect(rm.handHasSuit('AhKd', 's')).toBe(false);
      expect(rm.handHasSuit('AhKd', 'c')).toBe(false);
    },
    invalidSuit: () => {
      const rm = createTestInstance('AKs');
      expect(rm.handHasSuit('AhKd', 'x')).toBe(false);
      expect(rm.handHasSuit('AhKd', '')).toBe(false);
    }
  },
  handSuitedOf: {
    detect: () => {
      const rm = createTestInstance('AKs');
      expect(rm.handSuitedOf('AhKh', 'h')).toBe(true);
      expect(rm.handSuitedOf('AsKs', 's')).toBe(true);
    },
    noMatch: () => {
      const rm = createTestInstance('AKs');
      expect(rm.handSuitedOf('AhKd', 'h')).toBe(false);
      expect(rm.handSuitedOf('AhKd', 'd')).toBe(false);
    },
    offsuit: () => {
      const rm = createTestInstance('AKo');
      expect(rm.handSuitedOf('AhKd', 'h')).toBe(false);
      expect(rm.handSuitedOf('AhKd', 'd')).toBe(false);
    },
    invalidSuit: () => {
      const rm = createTestInstance('AKs');
      expect(rm.handSuitedOf('AhKh', 'x')).toBe(false);
      expect(rm.handSuitedOf('AhKh', '')).toBe(false);
    }
  },
  hasSuit: {
    filter: () => {
      const rm = new RangeManager('AKs,AKo');
      const filtered = rm.hasSuit('h');
      expect(filtered.size()).toBeGreaterThan(0);
      expect(filtered.contains('AhKh')).toBe(true);
      expect(filtered.contains('AhKd')).toBe(true);
    },
    newInstance: () => {
      const rm = new RangeManager('AKs');
      const filtered = rm.hasSuit('h');
      expect(filtered).toBeInstanceOf(RangeManager);
      expect(filtered).not.toBe(rm);
    },
    immutable: () => {
      const rm = new RangeManager('AKs');
      const originalSize = rm.size();
      rm.hasSuit('h');
      expect(rm.size()).toBe(originalSize);
    },
    multipleSuits: () => {
      const rm = new RangeManager('AKs,AKo');
      const hearts = rm.hasSuit('h');
      const spades = rm.hasSuit('s');
      expect(hearts.size()).toBeGreaterThan(0);
      expect(spades.size()).toBeGreaterThan(0);
    },
    invalidSuit: () => {
      const rm = new RangeManager('AKs');
      expect(() => rm.hasSuit('x')).toThrow();
      expect(() => rm.hasSuit('')).toThrow();
    }
  },
  suitedOf: {
    filter: () => {
      const rm = new RangeManager('AKs,AKo');
      const filtered = rm.suitedOf('h');
      expect(filtered.size()).toBeGreaterThan(0);
      expect(filtered.contains('AhKh')).toBe(true);
      expect(filtered.contains('AhKd')).toBe(false);
    },
    newInstance: () => {
      const rm = new RangeManager('AKs');
      const filtered = rm.suitedOf('h');
      expect(filtered).toBeInstanceOf(RangeManager);
      expect(filtered).not.toBe(rm);
    },
    immutable: () => {
      const rm = new RangeManager('AKs');
      const originalSize = rm.size();
      rm.suitedOf('h');
      expect(rm.size()).toBe(originalSize);
    },
    specificSuit: () => {
      const rm = new RangeManager('AKs,AKo');
      const hearts = rm.suitedOf('h');
      const spades = rm.suitedOf('s');
      expect(hearts.contains('AhKh')).toBe(true);
      expect(hearts.contains('AsKs')).toBe(false);
      expect(spades.contains('AsKs')).toBe(true);
      expect(spades.contains('AhKh')).toBe(false);
    },
    invalidSuit: () => {
      const rm = new RangeManager('AKs');
      expect(() => rm.suitedOf('x')).toThrow();
      expect(() => rm.suitedOf('')).toThrow();
    }
  },
  getObject: {
    combine: async () => {
      const rm = createTestInstance('AKs');
      const board = ['2h', '3d', '4c'];
      const result = await rm.getObject('AhKd', board);
      expect(result).toBeDefined();
    },
    callExtval: async () => {
      const { evaluateHand } = await import('poker-extval');
      const rm = createTestInstance('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const result = await rm.getObject('AhKd', board);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    },
    returnsObject: async () => {
      const rm = createTestInstance('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const result = await rm.getObject('AhKd', board);
      expect(typeof result).toBe('object');
    },
    fivePlus: async () => {
      const rm = createTestInstance('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const result = await rm.getObject('AhKd', board);
      expect(result).toBeDefined();
    }
  },
  errors: {
    noBoard: async () => {
      const rm = new RangeManager('AKs');
      await expect(rm.makesHand(['Pair'])).rejects.toThrow();
    },
    invalidCriteria: async () => {
      const rm = new RangeManager('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      await expect(rm.makesHand(['Invalid'], board)).rejects.toThrow();
    },
    invalidBoard: async () => {
      const rm = new RangeManager('AKs');
      await expect(rm.makesHand(['Pair'], ['invalid'])).rejects.toThrow();
    }
  }
};

// ============================================================================
// QUERY TEST IMPLEMENTATIONS
// ============================================================================

const testQuery = {
  toArray: {
    returnsArray: () => {
      const rm = new RangeManager('AKs');
      const hands = rm.toArray();
      expect(Array.isArray(hands)).toBe(true);
    },
    copy: () => {
      const rm = new RangeManager('AKs');
      const hands1 = rm.toArray();
      const hands2 = rm.toArray();
      expect(hands1).not.toBe(hands2);
    },
    empty: () => {
      const rm = new RangeManager('AKs');
      const filtered = rm.exclude(['As', 'Ah', 'Ad', 'Ac', 'Ks', 'Kh', 'Kd', 'Kc']);
      expect(filtered.toArray()).toEqual([]);
    }
  },
  toString: {
    compact: () => {
      const rm = new RangeManager('AKs');
      const str = rm.toString();
      expect(typeof str).toBe('string');
      expect(str.length).toBeGreaterThan(0);
    },
    groupPairs: () => {
      const rm = new RangeManager('22-AA');
      const str = rm.toString();
      expect(str).toContain('22');
    },
    groupSuited: () => {
      const rm = new RangeManager('A2s+,AKs');
      const str = rm.toString();
      expect(str).toContain('s');
    },
    groupOffsuit: () => {
      const rm = new RangeManager('A2o+,KQo');
      const str = rm.toString();
      expect(str).toContain('o');
    },
    commaSeparated: () => {
      const rm = new RangeManager('AKs,KQo');
      const str = rm.toString();
      expect(str).toContain(',');
    }
  },
  size: {
    correct: () => {
      const rm = new RangeManager('AKs');
      expect(rm.size()).toBe(4);
    },
    empty: () => {
      const rm = new RangeManager('AKs');
      const filtered = rm.exclude(['As', 'Ah', 'Ad', 'Ac', 'Ks', 'Kh', 'Kd', 'Kc']);
      expect(filtered.size()).toBe(0);
    },
    length: () => {
      const rm = new RangeManager('22-AA');
      expect(rm.size()).toBe(rm.filteredHands.length);
    }
  },
  contains: {
    exists: () => {
      const rm = new RangeManager('AKs');
      expect(rm.contains('AsKs')).toBe(true);
    },
    notExists: () => {
      const rm = new RangeManager('AKs');
      expect(rm.contains('AhQd')).toBe(false);
    },
    normalize: () => {
      const rm = new RangeManager('AKs');
      expect(rm.contains('KsAs')).toBe(true);
    },
    formats: () => {
      const rm = new RangeManager('AKs');
      expect(rm.contains('AsKs')).toBe(true);
      expect(rm.contains('AhKh')).toBe(true);
    }
  },
  getHands: {
    returnsArray: () => {
      const rm = new RangeManager('AKs');
      const hands = rm.getHands();
      expect(Array.isArray(hands)).toBe(true);
    },
    alias: () => {
      const rm = new RangeManager('AKs');
      expect(rm.getHands()).toEqual(rm.toArray());
    }
  }
};

// ============================================================================
// INTEGRATION TEST IMPLEMENTATIONS
// ============================================================================

const testRankXNotation = {
  KXo: {
    parse: () => {
      const rm = new RangeManager('KXo');
      expect(rm).toBeInstanceOf(RangeManager);
      expect(rm.size()).toBe(150); // 12 offsuit combos per rank (12 ranks) + 6 KK combos = 144 + 6 = 150
    },
    includesKK: () => {
      const rm = new RangeManager('KXo');
      expect(rm.contains('KcKd')).toBe(true);
      expect(rm.contains('KcKh')).toBe(true);
      expect(rm.contains('KcKs')).toBe(true);
      expect(rm.contains('KdKh')).toBe(true);
      expect(rm.contains('KdKs')).toBe(true);
      expect(rm.contains('KhKs')).toBe(true);
    },
    includesOffsuit: () => {
      const rm = new RangeManager('KXo');
      expect(rm.contains('Kc2d')).toBe(true);
      expect(rm.contains('KcAd')).toBe(true);
      expect(rm.contains('2cKd')).toBe(true);
      expect(rm.contains('AcKd')).toBe(true);
    },
    excludesSuited: () => {
      const rm = new RangeManager('KXo');
      expect(rm.contains('Kc2c')).toBe(false);
      expect(rm.contains('KcAc')).toBe(false);
    },
    size: () => {
      const rm = new RangeManager('KXo');
      // 12 ranks (A,2-9,T,J,Q) excluding K = 12 ranks
      // Each rank has 12 offsuit combos with K = 12 * 12 = 144
      // Plus 6 KK combos = 6
      // Total = 150
      expect(rm.size()).toBe(150);
    }
  },
  '5Xs': {
    parse: () => {
      const rm = new RangeManager('5Xs');
      expect(rm).toBeInstanceOf(RangeManager);
      expect(rm.size()).toBe(48); // 4 suited combos per rank (12 ranks) = 48
    },
    excludes55: () => {
      const rm = new RangeManager('5Xs');
      expect(rm.contains('5c5d')).toBe(false);
      expect(rm.contains('5c5h')).toBe(false);
    },
    includesSuited: () => {
      const rm = new RangeManager('5Xs');
      expect(rm.contains('5c2c')).toBe(true);
      expect(rm.contains('5cAc')).toBe(true);
      expect(rm.contains('2c5c')).toBe(true);
      expect(rm.contains('Ac5c')).toBe(true);
    },
    excludesOffsuit: () => {
      const rm = new RangeManager('5Xs');
      expect(rm.contains('5c2d')).toBe(false);
      expect(rm.contains('5cAd')).toBe(false);
    },
    size: () => {
      const rm = new RangeManager('5Xs');
      // 12 ranks (A,2-4,6-9,T,J,Q,K) excluding 5 = 12 ranks
      // Each rank has 4 suited combos with 5 = 12 * 4 = 48
      expect(rm.size()).toBe(48);
    }
  },
  'AXs': {
    parse: () => {
      const rm = new RangeManager('AXs');
      expect(rm).toBeInstanceOf(RangeManager);
      expect(rm.size()).toBe(48); // 4 suited combos per rank (12 ranks) = 48
    },
    excludesAA: () => {
      const rm = new RangeManager('AXs');
      expect(rm.contains('AcAd')).toBe(false);
    },
    includesSuited: () => {
      const rm = new RangeManager('AXs');
      expect(rm.contains('Ac2c')).toBe(true);
      expect(rm.contains('AcKc')).toBe(true);
    },
    size: () => {
      const rm = new RangeManager('AXs');
      // 12 ranks (2-9,T,J,Q,K) excluding A = 12 ranks
      // Each rank has 4 suited combos with A = 12 * 4 = 48
      expect(rm.size()).toBe(48);
    }
  },
  caseInsensitive: {
    lowercase: () => {
      const rm1 = new RangeManager('KXo');
      const rm2 = new RangeManager('kxo');
      expect(rm1.size()).toBe(rm2.size());
    },
    mixed: () => {
      const rm1 = new RangeManager('5Xs');
      const rm2 = new RangeManager('5xs');
      expect(rm1.size()).toBe(rm2.size());
    }
  },
  combining: {
    withPairs: () => {
      const rm = new RangeManager('22+,KXo');
      expect(rm.contains('KcKd')).toBe(true);
      expect(rm.contains('2c2d')).toBe(true);
      expect(rm.contains('Kc2d')).toBe(true);
    },
    withSuited: () => {
      const rm = new RangeManager('AKs,5Xs');
      expect(rm.contains('AcKc')).toBe(true);
      expect(rm.contains('5c2c')).toBe(true);
    },
    multipleRX: () => {
      const rm = new RangeManager('KXo,5Xs,AXs');
      expect(rm.size()).toBeGreaterThan(0);
      expect(rm.contains('Kc2d')).toBe(true);
      expect(rm.contains('5c2c')).toBe(true);
      expect(rm.contains('Ac2c')).toBe(true);
    }
  },
  edgeCases: {
    '2Xo': () => {
      const rm = new RangeManager('2Xo');
      expect(rm.size()).toBe(150); // Same as KXo
      expect(rm.contains('2c2d')).toBe(true);
    },
    'TXs': () => {
      const rm = new RangeManager('TXs');
      expect(rm.size()).toBe(48);
      expect(rm.contains('Tc2c')).toBe(true);
      expect(rm.contains('TcAc')).toBe(true);
      // TXs should not include TT (pocket pairs don't exist for suited notation)
      // We can't test contains('TcTc') because it's an invalid hand format
    }
  }
};

const testIntegration = {
  workflow: {
    full: async () => {
      const rm = new RangeManager('22-AA,AKs');
      const filtered = await rm.exclude(['Ah']).makesHand(['Pair'], ['2h', '3d', '4c', '5s', '6h']);
      const hands = filtered.toArray();
      expect(Array.isArray(hands)).toBe(true);
    },
    chaining: () => {
      const rm = new RangeManager('AKs,KQo');
      const result = rm.exclude(['Ah']).exclude(['Ks']).size();
      expect(typeof result).toBe('number');
    },
    immutability: async () => {
      const rm = new RangeManager('AKs');
      const originalSize = rm.size();
      await rm.exclude(['Ah']).makesHand(['Pair'], ['2h', '3d', '4c', '5s', '6h']);
      expect(rm.size()).toBe(originalSize);
    }
  },
  chaining: {
    multipleExclude: () => {
      const rm = new RangeManager('AKs');
      const filtered = rm.exclude(['Ah']).exclude(['Ks']);
      expect(filtered).toBeInstanceOf(RangeManager);
    },
    multipleMatch: async () => {
      const rm = new RangeManager('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const filtered = await (await rm.makesHand(['Pair'], board)).makesHand(['Two Pair'], board);
      expect(filtered).toBeInstanceOf(RangeManager);
    },
    excludeAndMatch: async () => {
      const rm = new RangeManager('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const filtered = await rm.exclude(['Ah']).makesHand(['Pair'], board);
      expect(filtered).toBeInstanceOf(RangeManager);
    },
    queryAfter: async () => {
      const rm = new RangeManager('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const size = (await rm.exclude(['Ah']).makesHand(['Pair'], board)).size();
      expect(typeof size).toBe('number');
    }
  },
  immutability: {
    exclude: () => {
      const rm = new RangeManager('AKs');
      const originalSize = rm.size();
      rm.exclude(['Ah']);
      expect(rm.size()).toBe(originalSize);
    },
    match: () => {
      const rm = new RangeManager('AKs');
      const originalSize = rm.size();
      const board = ['2h', '3d', '4c', '5s', '6h'];
      rm.makesHand(['Pair'], board);
      expect(rm.size()).toBe(originalSize);
    },
    independent: () => {
      const rm = new RangeManager('AKs');
      const filtered1 = rm.exclude(['Ah']);
      const filtered2 = rm.exclude(['Ks']);
      expect(filtered1.toArray()).not.toEqual(filtered2.toArray());
    }
  },
  edges: {
    empty: () => {
      const rm = new RangeManager('AKs');
      const filtered = rm.exclude(['As', 'Ah', 'Ad', 'Ac', 'Ks', 'Kh', 'Kd', 'Kc']);
      expect(filtered.size()).toBe(0);
      expect(filtered.toArray()).toEqual([]);
    },
    overlapping: () => {
      const rm = new RangeManager('22-AA,99');
      const hands = rm.toArray();
      const uniqueHands = [...new Set(hands)];
      expect(hands.length).toBe(uniqueHands.length);
    },
    deduplicate: () => {
      const rm = new RangeManager('AKs,AKs');
      expect(rm.size()).toBe(4);
    },
    allDead: () => {
      const rm = new RangeManager('AKs');
      const filtered = rm.exclude(['As', 'Ah', 'Ad', 'Ac', 'Ks', 'Kh', 'Kd', 'Kc']);
      expect(filtered.size()).toBe(0);
    },
    noMatch: async () => {
      const rm = new RangeManager('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const filtered = await rm.makesHand(['Royal Flush'], board);
      expect(filtered.size()).toBe(0);
    }
  }
};

// ============================================================================
// TEST DESCRIPTIONS - Easily skimmable section
// ============================================================================

describe('RangeManager', () => {
  
  // ==========================================================================
  // NORMALIZATION TESTS
  // ==========================================================================
  
  describe('Normalization Methods', () => {
    describe('normalizeNotation()', () => {
      it('should trim whitespace from notation', testNormalization.normalizeNotation.trimWhitespace);
      it('should handle case conversion', testNormalization.normalizeNotation.caseConversion);
      it('should normalize multiple spaces', testNormalization.normalizeNotation.multipleSpaces);
    });
  });

  // ==========================================================================
  // CONSTRUCTOR TESTS
  // ==========================================================================
  
  describe('Constructor', () => {
    it('should initialize with string notation', testConstructor.string);
    it('should initialize with array notation', testConstructor.array);
    it('should accept optional dead cards', testConstructor.deadCards);
    it('should parse input correctly', testConstructor.parse);
    it('should store rawInput', testConstructor.rawInput);
    it('should store deadCards', testConstructor.deadCardsStored);
    it('should initialize filteredHands', testConstructor.filteredHands);
  });

  // ==========================================================================
  // ERROR HANDLING TESTS
  // ==========================================================================
  
  describe('Invalid Notation Handling', () => {
    it('should throw error for invalid card format', testErrors.invalidCard);
    it('should throw error for invalid notation', testErrors.invalidNotation);
    it('should throw error for empty input', testErrors.empty);
    it('should throw error for non-array non-string input', testErrors.invalidType);
  });

  // ==========================================================================
  // FILTERING TESTS
  // ==========================================================================
  
  describe('Filtering Methods', () => {
    describe('exclude()', () => {
      it('should filter out hands containing dead cards', testFiltering.exclude.filter);
      it('should return new RangeManager instance', testFiltering.exclude.newInstance);
      it('should not modify original range', testFiltering.exclude.immutable);
      it('should handle multiple dead cards', testFiltering.exclude.multiple);
      it('should handle empty dead cards array', testFiltering.exclude.empty);
    });

    describe('handContainsDeadCard()', () => {
      it('should detect if hand contains dead card', testFiltering.handContainsDeadCard.detect);
      it('should check both cards in hand', testFiltering.handContainsDeadCard.bothCards);
      it('should return false if no dead cards match', testFiltering.handContainsDeadCard.noMatch);
      it('should handle multiple dead cards', testFiltering.handContainsDeadCard.multiple);
    });

    describe('makesHand()', () => {
      it('should filter by hand strength criteria', testFiltering.makesHand.filter);
      it('should require board cards for strength evaluation', testFiltering.makesHand.requiresBoard);
      it('should throw error if board cards missing', testFiltering.makesHand.errorNoBoard);
      it('should return new RangeManager instance', testFiltering.makesHand.newInstance);
      it('should not modify original range', testFiltering.makesHand.immutable);
      it('should handle multiple criteria', testFiltering.makesHand.multiple);
      it('should normalize criteria strings', testFiltering.makesHand.normalize);
    });

    describe('getObject()', () => {
      it('should combine hand and board cards', testFiltering.getObject.combine);
      it('should call poker-extval evaluateHand', testFiltering.getObject.callExtval);
      it('should return evaluation object', testFiltering.getObject.returnsObject);
      it('should handle 5+ total cards', testFiltering.getObject.fivePlus);
    });

    describe('evaluateHand()', () => {
      it('should return object with .is() and .isAll() methods', async () => {
        const rm = createTestInstance('AKs');
        const board = ['2h', '3d', '4c', '5s', '6h'];
        const result = await rm.evaluateHand('AhKd', board);
        expect(result).toBeDefined();
        expect(typeof result.is).toBe('function');
        expect(typeof result.isAll).toBe('function');
      });

      it('should filter evaluation with .is() using single criteria', async () => {
        const rm = createTestInstance('AKs');
        const board = ['2h', '3d', '4c', '5s', '6h'];
        const result = await rm.evaluateHand('AhKd', board);
        const filtered = result.is('Straight');
        expect(typeof filtered).toBe('object');
        expect(Object.keys(filtered).length).toBeGreaterThan(0);
        // All entries should have isStraight = true
        Object.values(filtered).forEach(evalObj => {
          expect(evalObj.isStraight).toBe(true);
        });
      });

      it('should filter evaluation with .is() using array criteria (OR logic)', async () => {
        const rm = createTestInstance('AKs');
        const board = ['2d', '6d', 'Ad', '5s', 'Td'];
        const result = await rm.evaluateHand('3c4d', board);
        const filtered = result.is(['Flush Draw', 'Straight Draw']);
        expect(typeof filtered).toBe('object');
        // All entries should have at least one of the criteria true
        Object.values(filtered).forEach(evalObj => {
          const hasFlushDraw = evalObj.isFlushDraw === true;
          const hasStraightDraw = evalObj.isStraightDraw === true || evalObj.isInsideStraightDraw === true;
          expect(hasFlushDraw || hasStraightDraw).toBe(true);
        });
      });

      it('should filter evaluation with .isAll() using array criteria (AND logic)', async () => {
        const rm = createTestInstance('AKs');
        const board = ['2d', '6d', 'Ad', '5s', 'Td'];
        const result = await rm.evaluateHand('3c4d', board);
        const filtered = result.isAll(['Flush Draw', 'Straight Draw']);
        expect(typeof filtered).toBe('object');
        // All entries should have ALL criteria true
        Object.values(filtered).forEach(evalObj => {
          const hasFlushDraw = evalObj.isFlushDraw === true;
          const hasStraightDraw = evalObj.isStraightDraw === true || evalObj.isInsideStraightDraw === true;
          expect(hasFlushDraw && hasStraightDraw).toBe(true);
        });
      });

      it('should return empty object when no criteria match with .is()', async () => {
        const rm = createTestInstance('22');
        const board = ['2h', '3d', '4c', '5s', '6h'];
        const result = await rm.evaluateHand('7c7d', board);
        const filtered = result.is('Royal Flush');
        expect(filtered).toEqual({});
        expect(Object.keys(filtered).length).toBe(0);
      });

      it('should return empty object when no criteria match with .isAll()', async () => {
        const rm = createTestInstance('22');
        const board = ['2h', '3d', '4c', '5s', '6h'];
        const result = await rm.evaluateHand('7c7d', board);
        const filtered = result.isAll(['Royal Flush', 'Straight Flush']);
        expect(filtered).toEqual({});
        expect(Object.keys(filtered).length).toBe(0);
      });

      it('should normalize human-readable criteria in .is()', async () => {
        const rm = createTestInstance('AKs');
        const board = ['2h', '3d', '4c', '5s', '6h'];
        const result = await rm.evaluateHand('AhKd', board);
        const filtered1 = result.is('Straight');
        const filtered2 = result.is('isStraight');
        // Both should work and return same structure
        expect(typeof filtered1).toBe('object');
        expect(typeof filtered2).toBe('object');
      });

      it('should normalize human-readable criteria in .isAll()', async () => {
        const rm = createTestInstance('AKs');
        const board = ['2d', '6d', 'Ad', '5s', 'Td'];
        const result = await rm.evaluateHand('3c4d', board);
        const filtered1 = result.isAll(['Flush Draw', 'Straight Draw']);
        const filtered2 = result.isAll(['isFlushDraw', 'isStraightDraw']);
        // Both should work and return same structure
        expect(typeof filtered1).toBe('object');
        expect(typeof filtered2).toBe('object');
      });
    });


    describe('Error Handling', () => {
      it('should throw error for missing board cards in makesHand()', testFiltering.errors.noBoard);
      it('should throw error for invalid criteria', testFiltering.errors.invalidCriteria);
      it('should throw error for invalid board cards', testFiltering.errors.invalidBoard);
    });
  });

  // ==========================================================================
  // QUERY TESTS
  // ==========================================================================
  
  describe('Query Methods', () => {
    describe('toArray()', () => {
      it('should return filteredHands as array', testQuery.toArray.returnsArray);
      it('should return copy of hands array', testQuery.toArray.copy);
      it('should return empty array for empty range', testQuery.toArray.empty);
    });

    describe('toString()', () => {
      it('should return compact notation string', testQuery.toString.compact);
      it('should group pairs together', testQuery.toString.groupPairs);
      it('should group suited hands together', testQuery.toString.groupSuited);
      it('should group offsuit hands together', testQuery.toString.groupOffsuit);
      it('should return comma-separated notation', testQuery.toString.commaSeparated);
    });

    describe('size()', () => {
      it('should return correct number of hands', testQuery.size.correct);
      it('should return 0 for empty range', testQuery.size.empty);
      it('should return filteredHands.length', testQuery.size.length);
    });

    describe('contains()', () => {
      it('should return true if hand exists in range', testQuery.contains.exists);
      it('should return false if hand does not exist', testQuery.contains.notExists);
      it('should normalize input hand before checking', testQuery.contains.normalize);
      it('should handle different hand formats', testQuery.contains.formats);
    });

    describe('getHands()', () => {
      it('should return filteredHands as array', testQuery.getHands.returnsArray);
      it('should be alias for toArray()', testQuery.getHands.alias);
    });
  });

  // ==========================================================================
  // RANK X NOTATION TESTS
  // ==========================================================================
  
  describe('Rank X Notation', () => {
    describe('KXo (All offsuit K hands including KK)', () => {
      it('should parse KXo notation', testRankXNotation.KXo.parse);
      it('should include pocket Kings', testRankXNotation.KXo.includesKK);
      it('should include all offsuit K hands', testRankXNotation.KXo.includesOffsuit);
      it('should exclude suited K hands', testRankXNotation.KXo.excludesSuited);
      it('should have correct size (150 hands)', testRankXNotation.KXo.size);
    });

    describe('5Xs (All suited 5 hands excluding 55)', () => {
      it('should parse 5Xs notation', testRankXNotation['5Xs'].parse);
      it('should exclude pocket 5s', testRankXNotation['5Xs'].excludes55);
      it('should include all suited 5 hands', testRankXNotation['5Xs'].includesSuited);
      it('should exclude offsuit 5 hands', testRankXNotation['5Xs'].excludesOffsuit);
      it('should have correct size (48 hands)', testRankXNotation['5Xs'].size);
    });

    describe('AXs (All suited A hands excluding AA)', () => {
      it('should parse AXs notation', testRankXNotation.AXs.parse);
      it('should exclude pocket Aces', testRankXNotation.AXs.excludesAA);
      it('should include all suited A hands', testRankXNotation.AXs.includesSuited);
      it('should have correct size (48 hands)', testRankXNotation.AXs.size);
    });

    describe('Case Insensitivity', () => {
      it('should handle lowercase notation', testRankXNotation.caseInsensitive.lowercase);
      it('should handle mixed case notation', testRankXNotation.caseInsensitive.mixed);
    });

    describe('Combining with Other Notations', () => {
      it('should combine with pair notation', testRankXNotation.combining.withPairs);
      it('should combine with suited notation', testRankXNotation.combining.withSuited);
      it('should combine multiple RX notations', testRankXNotation.combining.multipleRX);
    });

    describe('Edge Cases', () => {
      it('should handle 2Xo notation', testRankXNotation.edgeCases['2Xo']);
      it('should handle TXs notation', testRankXNotation.edgeCases['TXs']);
    });
  });

  // ==========================================================================
  // INTEGRATION TESTS
  // ==========================================================================
  
  describe('Integration Tests', () => {
    describe('Full Workflow', () => {
      it('should handle parse → exclude → match → query workflow', testIntegration.workflow.full);
      it('should work with method chaining', testIntegration.workflow.chaining);
      it('should maintain immutability throughout', testIntegration.workflow.immutability);
    });

    describe('Method Chaining', () => {
      it('should support multiple exclude() calls', testIntegration.chaining.multipleExclude);
      it('should support multiple makesHand() calls', testIntegration.chaining.multipleMatch);
      it('should support exclude() and makesHand() together', testIntegration.chaining.excludeAndMatch);
      it('should support query methods after filtering', testIntegration.chaining.queryAfter);
    });

    describe('Immutability', () => {
      it('should not modify original range after exclude()', testIntegration.immutability.exclude);
      it('should not modify original range after makesHand()', testIntegration.immutability.match);
      it('should allow independent filtering of same range', testIntegration.immutability.independent);
    });

    describe('Edge Cases', () => {
      it('should handle empty ranges', testIntegration.edges.empty);
      it('should handle overlapping notation', testIntegration.edges.overlapping);
      it('should deduplicate hands automatically', testIntegration.edges.deduplicate);
      it('should handle all dead cards scenario', testIntegration.edges.allDead);
      it('should handle no matching criteria scenario', testIntegration.edges.noMatch);
    });
  });
});



