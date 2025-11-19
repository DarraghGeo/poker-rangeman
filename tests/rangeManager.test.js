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
  intersect: {
    withString: () => {
      const rm1 = new RangeManager('22+,AKs,AKo');
      const intersection = rm1.intersect('QQ+');
      expect(intersection).toBeInstanceOf(RangeManager);
      expect(intersection.size()).toBeGreaterThan(0);
    },
    withRankXNotation: () => {
      const rm = new RangeManager('22+,AKs,AKo');
      // This should work - intersect with KXo notation
      const intersection = rm.intersect('KXo');
      expect(intersection).toBeInstanceOf(RangeManager);
      expect(intersection.size()).toBeGreaterThan(0);
    },
    withJXsJXo: () => {
      // Reproduces the bug: JXs notation in intersect() should work without throwing "Unrecognized notation: JXs"
      // This test verifies that JXs,JXo notation is properly parsed when used in intersect()
      const rm = new RangeManager('22+,AKs,AKo,JQs,JQo,J2o,J2s');
      // This should NOT throw "Unrecognized notation: JXs"
      const intersection = rm.intersect('JXs,JXo');
      expect(intersection).toBeInstanceOf(RangeManager);
      // Should contain J hands from the original range
      expect(intersection.contains('JcQc')).toBe(true); // JQs
      expect(intersection.contains('JcQd')).toBe(true); // JQo
      expect(intersection.contains('Jc2d')).toBe(true); // J2o
      expect(intersection.contains('Jc2c')).toBe(true); // J2s
      expect(intersection.contains('JcJd')).toBe(true); // JJ (from JXo)
    },
    withMultipleRankX: () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const intersection = rm.intersect('JXs,JXo,KXo');
      expect(intersection).toBeInstanceOf(RangeManager);
    },
    newInstance: () => {
      const rm = new RangeManager('AKs');
      const intersection = rm.intersect('AKo');
      expect(intersection).not.toBe(rm);
    },
    immutable: () => {
      const rm = new RangeManager('AKs');
      const originalSize = rm.size();
      rm.intersect('AKo');
      expect(rm.size()).toBe(originalSize);
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
  },
  getKeyCards: {
    returnsEmptyArrayWhenNoBoard: async () => {
      const rm = new RangeManager('22+,AKs');
      const keyCards = rm.getKeyCards();
      expect(Array.isArray(keyCards)).toBe(true);
      expect(keyCards.length).toBe(0);
    },
    returnsEmptyArrayWhenNoHandStrength: async () => {
      const rm = new RangeManager('22+,AKs');
      const board = ['Ah', 'Kd', 'Qc', 'Js', 'Th'];
      // No filtering done, so lastHandStrength is null
      const keyCards = rm.getKeyCards();
      expect(Array.isArray(keyCards)).toBe(true);
      expect(keyCards.length).toBe(0);
    },
    returnsKeyCardsForPair: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      const filtered = await rm.hitsHand(['Pair'], board);
      const keyCards = filtered.getKeyCards();
      
      expect(Array.isArray(keyCards)).toBe(true);
      expect(keyCards.length).toBeGreaterThan(0);
      // Should include board cards that are part of pairs
      expect(keyCards).toContain('ah');
      expect(keyCards).toContain('kd');
    },
    returnsKeyCardsForSpecificHandStrength: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      const filtered = await rm.hitsHand(['Pair'], board);
      const topPairKeyCards = filtered.getKeyCards('Top Pair');
      
      expect(Array.isArray(topPairKeyCards)).toBe(true);
      // Top Pair key cards should be the highest pair on board
      if (topPairKeyCards.length > 0) {
        expect(topPairKeyCards.some(c => c.includes('a') || c.includes('k'))).toBe(true);
      }
    },
    returnsSortedKeyCards: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      const filtered = await rm.hitsHand(['Pair'], board);
      const keyCards = filtered.getKeyCards();
      
      expect(Array.isArray(keyCards)).toBe(true);
      if (keyCards.length > 1) {
        const sorted = [...keyCards].sort();
        expect(keyCards).toEqual(sorted);
      }
    },
    returnsUniqueKeyCards: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      const filtered = await rm.hitsHand(['Pair'], board);
      const keyCards = filtered.getKeyCards();
      
      expect(Array.isArray(keyCards)).toBe(true);
      const unique = [...new Set(keyCards)];
      expect(keyCards.length).toBe(unique.length);
    },
    returnsKeyCardsForMultipleCriteria: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      const filtered = await rm.hitsHand(['Pair', 'Two Pair'], board);
      const keyCards = filtered.getKeyCards();
      
      expect(Array.isArray(keyCards)).toBe(true);
      expect(keyCards.length).toBeGreaterThan(0);
    },
    returnsEmptyArrayForEmptyRange: async () => {
      const rm = new RangeManager('22+,AKs');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      // Exclude all hands in the range to create an empty range
      const allHands = rm.toArray();
      const filtered = await rm.exclude(allHands);
      const hitHands = await filtered.hitsHand(['Pair'], board);
      const keyCards = hitHands.getKeyCards();
      
      expect(Array.isArray(keyCards)).toBe(true);
      expect(keyCards.length).toBe(0);
    },
    worksAfterMakesHand: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      const filtered = await rm.makesHand(['Pair'], board);
      const keyCards = filtered.getKeyCards();
      
      expect(Array.isArray(keyCards)).toBe(true);
      expect(keyCards.length).toBeGreaterThan(0);
    },
    worksAfterHitsHandBoth: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      const filtered = await rm.hitsHandBoth(['Pair'], board);
      const keyCards = filtered.getKeyCards();
      
      expect(Array.isArray(keyCards)).toBe(true);
      // May be empty if no hands use both cards, but should still return array
      expect(Array.isArray(keyCards)).toBe(true);
    }
  },
  hasKeyCard: {
    returnsEmptyWhenNoBoard: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const result = rm.hasKeyCard(['Ah']);
      expect(result.size()).toBe(0);
    },
    returnsEmptyWhenNoHandStrength: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      // No filtering done, so lastHandStrength is null
      const result = rm.hasKeyCard(['Ah']);
      expect(result.size()).toBe(0);
    },
    filtersByKeyCard: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      const filtered = await rm.hitsHand(['Pair'], board);
      const withKeyCard = filtered.hasKeyCard(['Ah']);
      
      expect(withKeyCard.size()).toBeGreaterThan(0);
      // Should only include hands where Ah is a key card
      const hands = withKeyCard.toArray();
      expect(hands.length).toBeGreaterThan(0);
      // Verify Ah is actually a key card for these hands
      for (const hand of hands.slice(0, 3)) {
        const evaluation = await rm.getObject(hand, board);
        const evaluations = Object.values(evaluation);
        const pairEval = evaluations.find(e => e.isPair === true);
        if (pairEval && pairEval.keyCards && pairEval.keyCards.isPair) {
          expect(pairEval.keyCards.isPair).toContain('Ah');
        }
      }
    },
    usesORLogicByDefault: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      const filtered = await rm.hitsHand(['Pair'], board);
      const withAhOrKd = filtered.hasKeyCard(['Ah', 'Kd'], false);
      const withAh = filtered.hasKeyCard(['Ah'], false);
      const withKd = filtered.hasKeyCard(['Kd'], false);
      
      // OR logic: should be at least as many as individual checks, possibly more
      expect(withAhOrKd.size()).toBeGreaterThanOrEqual(Math.max(withAh.size(), withKd.size()));
    },
    usesANDLogicWhenSpecified: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      const filtered = await rm.hitsHand(['Pair'], board);
      const withAhAndKd = filtered.hasKeyCard(['Ah', 'Kd'], true);
      const withAh = filtered.hasKeyCard(['Ah'], false);
      const withKd = filtered.hasKeyCard(['Kd'], false);
      
      // AND logic: should be fewer or equal to individual checks
      expect(withAhAndKd.size()).toBeLessThanOrEqual(Math.min(withAh.size(), withKd.size()));
    },
    worksWithSpecificHandStrength: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      const filtered = await rm.hitsHand(['Pair'], board);
      const topPairWithAh = filtered.hasKeyCard(['Ah'], false, 'Top Pair');
      
      expect(topPairWithAh.size()).toBeGreaterThanOrEqual(0);
    },
    returnsNewInstance: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      const filtered = await rm.hitsHand(['Pair'], board);
      const withKeyCard = filtered.hasKeyCard(['Ah']);
      
      expect(withKeyCard).not.toBe(filtered);
      expect(withKeyCard.size()).toBeLessThanOrEqual(filtered.size());
    }
  },
  hasKicker: {
    returnsEmptyWhenNoBoard: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const result = rm.hasKicker(['Ah']);
      expect(result.size()).toBe(0);
    },
    returnsEmptyWhenNoHandStrength: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      // No filtering done, so lastHandStrength is null
      const result = rm.hasKicker(['Ah']);
      expect(result.size()).toBe(0);
    },
    filtersByKicker: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      const filtered = await rm.hitsHand(['Pair'], board);
      const withKicker = filtered.hasKicker(['Qc']);
      
      expect(withKicker.size()).toBeGreaterThanOrEqual(0);
      // If there are results, verify Qc is actually a kicker
      if (withKicker.size() > 0) {
        const hands = withKicker.toArray();
        for (const hand of hands.slice(0, 3)) {
          const evaluation = await rm.getObject(hand, board);
          const evaluations = Object.values(evaluation);
          const pairEval = evaluations.find(e => e.isPair === true);
          if (pairEval && pairEval.kickerCards && pairEval.kickerCards.isPair) {
            expect(pairEval.kickerCards.isPair).toContain('Qc');
          }
        }
      }
    },
    usesORLogicByDefault: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      const filtered = await rm.hitsHand(['Pair'], board);
      const withQcOrJs = filtered.hasKicker(['Qc', 'Js'], false);
      const withQc = filtered.hasKicker(['Qc'], false);
      const withJs = filtered.hasKicker(['Js'], false);
      
      // OR logic: should be at least as many as individual checks
      expect(withQcOrJs.size()).toBeGreaterThanOrEqual(Math.max(withQc.size(), withJs.size()));
    },
    usesANDLogicWhenSpecified: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      const filtered = await rm.hitsHand(['Pair'], board);
      const withQcAndJs = filtered.hasKicker(['Qc', 'Js'], true);
      const withQc = filtered.hasKicker(['Qc'], false);
      const withJs = filtered.hasKicker(['Js'], false);
      
      // AND logic: should be fewer or equal to individual checks
      expect(withQcAndJs.size()).toBeLessThanOrEqual(Math.min(withQc.size(), withJs.size()));
    },
    worksWithSpecificHandStrength: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      const filtered = await rm.hitsHand(['Pair'], board);
      const topPairWithKicker = filtered.hasKicker(['Qc'], false, 'Top Pair');
      
      expect(topPairWithKicker.size()).toBeGreaterThanOrEqual(0);
    },
    returnsNewInstance: async () => {
      const rm = new RangeManager('22+,AKs,AKo');
      const board = ['Ah', 'Kd', 'Qc', 'Js', '9h'];
      const filtered = await rm.hitsHand(['Pair'], board);
      const withKicker = filtered.hasKicker(['Qc']);
      
      expect(withKicker).not.toBe(filtered);
      expect(withKicker.size()).toBeLessThanOrEqual(filtered.size());
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
      expect(rm.contains('KcKh')).toBe(true)
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


    describe('intersect()', () => {
      it('should intersect with string notation', testFiltering.intersect.withString);
      it('should intersect with Rank X notation (KXo)', testFiltering.intersect.withRankXNotation);
      it('should intersect with JXs,JXo notation (reproduces bug)', testFiltering.intersect.withJXsJXo);
      it('should intersect with multiple Rank X notations', testFiltering.intersect.withMultipleRankX);
      it('should return new RangeManager instance', testFiltering.intersect.newInstance);
      it('should not modify original range', testFiltering.intersect.immutable);
    });

    describe('hitsHand() - Pair on paired board bug assessment', () => {
      it('should not return hands that make Two Pair when searching for Pair on paired board', async () => {
        // Board: 3♠ K♠ T♠ K♦ (has pair of Kings)
        // Hand: A3 makes Two Pair (KK + 33), not just Pair
        // This should NOT be returned by hitsHand(['Pair'])
        const rm = new RangeManager('22+,A2o+,A2s+');
        const board = ['3s', 'Ks', 'Ts', 'Kd'];
        const result = await rm.hitsHand(['Pair'], board);
        
        // Check each returned hand to ensure it only makes Pair, not Two Pair
        const hands = result.toArray();
        for (const hand of hands) {
          const evaluation = await rm.getObject(hand, board);
          const evaluations = Object.values(evaluation);
          const makesTwoPair = evaluations.some(e => e.isTwoPair === true);
          
          // If it makes Two Pair, it should not be in results when searching for Pair
          expect(makesTwoPair).toBe(false);
        }
      });

      it('should return hands that make only Pair (not Two Pair) on paired board', async () => {
        // Board: 3♠ K♠ T♠ K♦ (has pair of Kings)
        // Hand: A2 should make only Pair (AA or 22), not Two Pair
        const rm = new RangeManager('A2o,A2s,22');
        const board = ['3s', 'Ks', 'Ts', 'Kd'];
        const result = await rm.hitsHand(['Pair'], board);
        
        const hands = result.toArray();
        for (const hand of hands) {
          const evaluation = await rm.getObject(hand, board);
          const evaluations = Object.values(evaluation);
          const makesTwoPair = evaluations.some(e => e.isTwoPair === true);
          const makesPair = evaluations.some(e => e.isPair === true);
          
          // Should make Pair but NOT Two Pair
          expect(makesPair).toBe(true);
          expect(makesTwoPair).toBe(false);
        }
      });

      it('should correctly filter Pair on board without a pair', async () => {
        // Board: 3♠ 4♠ T♠ 5♦ (no pair on board)
        // All hands that make a pair should be returned
        const rm = new RangeManager('22+,A2o+,A2s+');
        const board = ['3s', '4s', 'Ts', '5d'];
        const result = await rm.hitsHand(['Pair'], board);
        
        const hands = result.toArray();
        for (const hand of hands) {
          const evaluation = await rm.getObject(hand, board);
          const evaluations = Object.values(evaluation);
          const makesPair = evaluations.some(e => e.isPair === true);
          const makesTwoPair = evaluations.some(e => e.isTwoPair === true);
          
          // Should make Pair (Two Pair is fine if board has no pair)
          expect(makesPair || makesTwoPair).toBe(true);
        }
      });

      it('should not return hands that make trips when searching for Pair on paired board', async () => {
        // Board: 3♠ K♠ T♠ K♦ (has pair of Kings)
        // Hand: KK makes trips (KKK), not Pair
        const rm = new RangeManager('KK');
        const board = ['3s', 'Ks', 'Ts', 'Kd'];
        const result = await rm.hitsHand(['Pair'], board);
        
        const hands = result.toArray();
        for (const hand of hands) {
          const evaluation = await rm.getObject(hand, board);
          const evaluations = Object.values(evaluation);
          const makesTrips = evaluations.some(e => e.isThreeOfAKind === true);
          
          // Should not make trips if we're searching for Pair
          expect(makesTrips).toBe(false);
        }
      });

      it('should handle makesHand([Pair]) on paired board for comparison', async () => {
        // Compare makesHand behavior with hitsHand
        const rm = new RangeManager('22+,A2o+,A2s+');
        const board = ['3s', 'Ks', 'Ts', 'Kd'];
        const result = await rm.makesHand(['Pair'], board);
        
        const hands = result.toArray();
        for (const hand of hands) {
          const evaluation = await rm.getObject(hand, board);
          const evaluations = Object.values(evaluation);
          const makesTwoPair = evaluations.some(e => e.isTwoPair === true);
          
          // makesHand should also only return Pair, not Two Pair
          expect(makesTwoPair).toBe(false);
        }
      });

      it('should handle hitsHandBoth([Pair]) on paired board', async () => {
        // Test hitsHandBoth with same scenario
        const rm = new RangeManager('22+,A2o+,A2s+');
        const board = ['3s', 'Ks', 'Ts', 'Kd'];
        const result = await rm.hitsHandBoth(['Pair'], board);
        
        const hands = result.toArray();
        for (const hand of hands) {
          const evaluation = await rm.getObject(hand, board);
          const evaluations = Object.values(evaluation);
          const makesTwoPair = evaluations.some(e => e.isTwoPair === true);
          
          // Should only make Pair, not Two Pair
          expect(makesTwoPair).toBe(false);
        }
      });

      it('should verify specific example: A3 on K♠ K♦ 3♠ T♠ makes Two Pair, not Pair', async () => {
        // Specific test case from the bug report
        const rm = new RangeManager('A3o,A3s');
        const board = ['Ks', 'Kd', '3s', 'Ts'];
        const result = await rm.hitsHand(['Pair'], board);
        
        // A3 should NOT be in results because it makes Two Pair (KK + 33)
        const hands = result.toArray();
        const a3Hands = hands.filter(h => (h.includes('A') && h.includes('3')) || (h.includes('3') && h.includes('A')));
        
        // Verify A3 makes Two Pair
        if (a3Hands.length > 0) {
          const evaluation = await rm.getObject(a3Hands[0], board);
          const evaluations = Object.values(evaluation);
          const makesTwoPair = evaluations.some(e => e.isTwoPair === true);
          expect(makesTwoPair).toBe(true); // This confirms the bug if A3 is in results
        }
        
        // A3 should not be returned when searching for Pair only
        expect(a3Hands.length).toBe(0);
      });

      it('should return hands that pair the board card (not the paired rank) on paired board', async () => {
        // Board: 3♠ K♠ T♠ K♦ (has pair of Kings)
        // Hand: A3 makes Two Pair (should be excluded)
        // Hand: AT makes Two Pair (should be excluded)
        // Hand: A2 makes only Pair (should be included)
        const rm = new RangeManager('A2o,A3o,ATo');
        const board = ['3s', 'Ks', 'Ts', 'Kd'];
        const result = await rm.hitsHand(['Pair'], board);
        
        const hands = result.toArray();
        const a3Hands = hands.filter(h => (h.includes('A') && h.includes('3')) || (h.includes('3') && h.includes('A')));
        const atHands = hands.filter(h => (h.includes('A') && h.includes('T')) || (h.includes('T') && h.includes('A')));
        
        // A3 and AT should not be in results (they make Two Pair)
        expect(a3Hands.length).toBe(0);
        expect(atHands.length).toBe(0);
        
        // A2 should be in results if it makes only Pair
        const a2Hands = hands.filter(h => (h.includes('A') && h.includes('2')) || (h.includes('2') && h.includes('A')));
        if (a2Hands.length > 0) {
          const evaluation = await rm.getObject(a2Hands[0], board);
          const evaluations = Object.values(evaluation);
          const makesTwoPair = evaluations.some(e => e.isTwoPair === true);
          expect(makesTwoPair).toBe(false);
        }
      });

      it('should return hands that make Two Pair when searching for Two Pair on paired board', async () => {
        // This test verifies that searching for "Two Pair" correctly returns those hands
        // Board: 3♠ K♠ T♠ K♦ (has pair of Kings)
        // Hand: A3 makes Two Pair (KK + 33)
        const rm = new RangeManager('A3o,A3s,A2o');
        const board = ['3s', 'Ks', 'Ts', 'Kd'];
        const result = await rm.hitsHand(['Two Pair'], board);
        
        const hands = result.toArray();
        const a3Hands = hands.filter(h => (h.includes('A') && h.includes('3')) || (h.includes('3') && h.includes('A')));
        
        // A3 should be in results when searching for Two Pair
        expect(a3Hands.length).toBeGreaterThan(0);
        
        // Verify A3 actually makes Two Pair
        if (a3Hands.length > 0) {
          const evaluation = await rm.getObject(a3Hands[0], board);
          const evaluations = Object.values(evaluation);
          const makesTwoPair = evaluations.some(e => e.isTwoPair === true);
          expect(makesTwoPair).toBe(true);
        }
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

    describe('getKeyCards()', () => {
      it('should return empty array when no board cards', testQuery.getKeyCards.returnsEmptyArrayWhenNoBoard);
      it('should return empty array when no hand strength', testQuery.getKeyCards.returnsEmptyArrayWhenNoHandStrength);
      it('should return key cards for Pair', testQuery.getKeyCards.returnsKeyCardsForPair);
      it('should return key cards for specific hand strength', testQuery.getKeyCards.returnsKeyCardsForSpecificHandStrength);
      it('should return sorted key cards', testQuery.getKeyCards.returnsSortedKeyCards);
      it('should return unique key cards', testQuery.getKeyCards.returnsUniqueKeyCards);
      it('should return key cards for multiple criteria', testQuery.getKeyCards.returnsKeyCardsForMultipleCriteria);
      it('should return empty array for empty range', testQuery.getKeyCards.returnsEmptyArrayForEmptyRange);
      it('should work after makesHand', testQuery.getKeyCards.worksAfterMakesHand);
      it('should work after hitsHandBoth', testQuery.getKeyCards.worksAfterHitsHandBoth);
    });

    describe('hasKeyCard()', () => {
      it('should return empty when no board cards', testQuery.hasKeyCard.returnsEmptyWhenNoBoard);
      it('should return empty when no hand strength', testQuery.hasKeyCard.returnsEmptyWhenNoHandStrength);
      it('should filter by key card', testQuery.hasKeyCard.filtersByKeyCard);
      it('should use OR logic by default', testQuery.hasKeyCard.usesORLogicByDefault);
      it('should use AND logic when specified', testQuery.hasKeyCard.usesANDLogicWhenSpecified);
      it('should work with specific hand strength', testQuery.hasKeyCard.worksWithSpecificHandStrength);
      it('should return new instance', testQuery.hasKeyCard.returnsNewInstance);
    });

    describe('hasKicker()', () => {
      it('should return empty when no board cards', testQuery.hasKicker.returnsEmptyWhenNoBoard);
      it('should return empty when no hand strength', testQuery.hasKicker.returnsEmptyWhenNoHandStrength);
      it('should filter by kicker', testQuery.hasKicker.filtersByKicker);
      it('should use OR logic by default', testQuery.hasKicker.usesORLogicByDefault);
      it('should use AND logic when specified', testQuery.hasKicker.usesANDLogicWhenSpecified);
      it('should work with specific hand strength', testQuery.hasKicker.worksWithSpecificHandStrength);
      it('should return new instance', testQuery.hasKicker.returnsNewInstance);
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



