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
// VALIDATION TEST IMPLEMENTATIONS
// ============================================================================

const testValidation = {
  isValidCard: {
    validFormat: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isValidCard('As')).toBe(true);
      expect(rm.isValidCard('Kh')).toBe(true);
      expect(rm.isValidCard('2c')).toBe(true);
    },
    invalidLength: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isValidCard('A')).toBe(false);
      expect(rm.isValidCard('Ass')).toBe(false);
      expect(rm.isValidCard('')).toBe(false);
    },
    invalidRank: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isValidCard('Xs')).toBe(false);
      expect(rm.isValidCard('1s')).toBe(false);
      expect(rm.isValidCard('Bs')).toBe(false);
    },
    invalidSuit: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isValidCard('Ax')).toBe(false);
      expect(rm.isValidCard('A1')).toBe(false);
      expect(rm.isValidCard('A ')).toBe(false);
    },
    allValidRanks: () => {
      const rm = createTestInstance('AKs');
      VALID_RANKS.forEach(rank => {
        VALID_SUITS.forEach(suit => {
          expect(rm.isValidCard(rank + suit)).toBe(true);
        });
      });
    },
    allValidSuits: () => {
      const rm = createTestInstance('AKs');
      VALID_SUITS.forEach(suit => {
        expect(rm.isValidCard('A' + suit)).toBe(true);
      });
    }
  },
  isValidHand: {
    validFormat: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isValidHand('AhKd')).toBe(true);
      expect(rm.isValidHand('AsKs')).toBe(true);
      expect(rm.isValidHand('2c3d')).toBe(true);
    },
    invalidLength: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isValidHand('AhK')).toBe(false);
      expect(rm.isValidHand('AhKdQ')).toBe(false);
      expect(rm.isValidHand('')).toBe(false);
    },
    invalidCards: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isValidHand('XhKd')).toBe(false);
      expect(rm.isValidHand('AhXd')).toBe(false);
    },
    duplicateCards: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isValidHand('AhAh')).toBe(false);
      expect(rm.isValidHand('KdKd')).toBe(false);
    },
    validHands: () => {
      const rm = createTestInstance('AKs');
      VALID_HANDS.forEach(hand => {
        expect(rm.isValidHand(hand)).toBe(true);
      });
    }
  },
  isValidRank: {
    allValidRanks: () => {
      const rm = createTestInstance('AKs');
      VALID_RANKS.forEach(rank => {
        expect(rm.isValidRank(rank)).toBe(true);
      });
    },
    invalidRanks: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isValidRank('X')).toBe(false);
      expect(rm.isValidRank('1')).toBe(false);
      expect(rm.isValidRank('B')).toBe(false);
    },
    caseSensitivity: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isValidRank('a')).toBe(false);
      expect(rm.isValidRank('A')).toBe(true);
    }
  },
  isValidSuit: {
    allValidSuits: () => {
      const rm = createTestInstance('AKs');
      VALID_SUITS.forEach(suit => {
        expect(rm.isValidSuit(suit)).toBe(true);
      });
    },
    invalidSuits: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isValidSuit('x')).toBe(false);
      expect(rm.isValidSuit('1')).toBe(false);
      expect(rm.isValidSuit(' ')).toBe(false);
    },
    caseSensitivity: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isValidSuit('S')).toBe(false);
      expect(rm.isValidSuit('s')).toBe(true);
    }
  }
};

// ============================================================================
// NORMALIZATION TEST IMPLEMENTATIONS
// ============================================================================

const testNormalization = {
  normalizeHand: {
    nonPairHighFirst: () => {
      const rm = createTestInstance('AKs');
      expect(rm.normalizeHand('KdAh')).toBe('AhKd');
      expect(rm.normalizeHand('2cAs')).toBe('As2c');
    },
    pairSuitsSorted: () => {
      const rm = createTestInstance('AKs');
      const normalized = rm.normalizeHand('AdAh');
      expect(normalized).toMatch(/^A[cdhs]A[cdhs]$/);
      expect(normalized[1] <= normalized[3]).toBe(true);
    },
    alreadyNormalized: () => {
      const rm = createTestInstance('AKs');
      expect(rm.normalizeHand('AhKd')).toBe('AhKd');
      expect(rm.normalizeHand('AsKs')).toBe('AsKs');
    },
    consistentFormat: () => {
      const rm = createTestInstance('AKs');
      const hand1 = rm.normalizeHand('KdAh');
      const hand2 = rm.normalizeHand('AhKd');
      expect(hand1).toBe(hand2);
    }
  },
  normalizeCardOrder: {
    highRankFirst: () => {
      const rm = createTestInstance('AKs');
      const ordered = rm.normalizeCardOrder('Kd', 'Ah');
      expect(ordered[0]).toBe('Ah');
      expect(ordered[1]).toBe('Kd');
    },
    equalRanks: () => {
      const rm = createTestInstance('AKs');
      const ordered = rm.normalizeCardOrder('Ah', 'Ad');
      expect(ordered.length).toBe(2);
      expect(ordered[0][0]).toBe(ordered[1][0]);
    },
    returnsOrderedArray: () => {
      const rm = createTestInstance('AKs');
      const result = rm.normalizeCardOrder('2c', 'As');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0][0]).toBe('A');
    }
  },
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
// UTILITY TEST IMPLEMENTATIONS
// ============================================================================

const testUtility = {
  getRankValue: {
    mapA: () => {
      const rm = createTestInstance('AKs');
      expect(rm.getRankValue('A')).toBe(14);
    },
    mapK: () => {
      const rm = createTestInstance('AKs');
      expect(rm.getRankValue('K')).toBe(13);
    },
    mapQ: () => {
      const rm = createTestInstance('AKs');
      expect(rm.getRankValue('Q')).toBe(12);
    },
    mapJ: () => {
      const rm = createTestInstance('AKs');
      expect(rm.getRankValue('J')).toBe(11);
    },
    mapT: () => {
      const rm = createTestInstance('AKs');
      expect(rm.getRankValue('T')).toBe(10);
    },
    mapNumeric: () => {
      const rm = createTestInstance('AKs');
      expect(rm.getRankValue('9')).toBe(9);
      expect(rm.getRankValue('2')).toBe(2);
      expect(rm.getRankValue('5')).toBe(5);
    }
  },
  compareRanks: {
    firstHigher: () => {
      const rm = createTestInstance('AKs');
      expect(rm.compareRanks('A', 'K')).toBe(1);
      expect(rm.compareRanks('K', 'Q')).toBe(1);
    },
    firstLower: () => {
      const rm = createTestInstance('AKs');
      expect(rm.compareRanks('K', 'A')).toBe(-1);
      expect(rm.compareRanks('2', '3')).toBe(-1);
    },
    equal: () => {
      const rm = createTestInstance('AKs');
      expect(rm.compareRanks('A', 'A')).toBe(0);
      expect(rm.compareRanks('K', 'K')).toBe(0);
    },
    allComparisons: () => {
      const rm = createTestInstance('AKs');
      expect(rm.compareRanks('A', '2')).toBe(1);
      expect(rm.compareRanks('2', 'A')).toBe(-1);
      expect(rm.compareRanks('5', '5')).toBe(0);
    }
  },
  getAllRanksBetween: {
    ascending: () => {
      const rm = createTestInstance('AKs');
      const ranks = rm.getAllRanksBetween('2', '5');
      expect(ranks).toEqual(['2', '3', '4', '5']);
    },
    inverse: () => {
      const rm = createTestInstance('AKs');
      const ranks = rm.getAllRanksBetween('A', '2');
      expect(ranks.length).toBeGreaterThan(0);
      expect(ranks[0]).toBe('A');
    },
    singleRank: () => {
      const rm = createTestInstance('AKs');
      const ranks = rm.getAllRanksBetween('K', 'K');
      expect(ranks).toEqual(['K']);
    },
    fullRange: () => {
      const rm = createTestInstance('AKs');
      const ranks = rm.getAllRanksBetween('2', 'A');
      expect(ranks.length).toBe(13);
      expect(ranks[0]).toBe('2');
      expect(ranks[12]).toBe('A');
    }
  },
  getAllSuits: {
    allSuits: () => {
      const rm = createTestInstance('AKs');
      const suits = rm.getAllSuits();
      expect(suits.length).toBe(4);
      expect(suits).toContain('s');
      expect(suits).toContain('h');
      expect(suits).toContain('d');
      expect(suits).toContain('c');
    },
    correctOrder: () => {
      const rm = createTestInstance('AKs');
      const suits = rm.getAllSuits();
      expect(suits).toEqual(['c', 'd', 'h', 's']);
    }
  }
};

// ============================================================================
// PATTERN DETECTION TEST IMPLEMENTATIONS
// ============================================================================

const testPattern = {
  detectNotationType: {
    pair: () => {
      const rm = createTestInstance('AKs');
      expect(rm.detectNotationType('22-AA')).toBe('pair');
      expect(rm.detectNotationType('99')).toBe('pair');
    },
    suited: () => {
      const rm = createTestInstance('AKs');
      expect(rm.detectNotationType('A2s+')).toBe('suited');
      expect(rm.detectNotationType('AKs')).toBe('suited');
    },
    offsuit: () => {
      const rm = createTestInstance('AKs');
      expect(rm.detectNotationType('A2o+')).toBe('offsuit');
      expect(rm.detectNotationType('KQo')).toBe('offsuit');
    },
    wildcard: () => {
      const rm = createTestInstance('AKs');
      expect(rm.detectNotationType('AxKs')).toBe('wildcard');
      expect(rm.detectNotationType('KsXh')).toBe('wildcard');
      expect(rm.detectNotationType('AsXx')).toBe('wildcard');
    },
    specific: () => {
      const rm = createTestInstance('AKs');
      expect(rm.detectNotationType('AhKd')).toBe('specific');
      expect(rm.detectNotationType('KhQh')).toBe('specific');
    },
    unrecognized: () => {
      const rm = createTestInstance('AKs');
      expect(rm.detectNotationType('invalid')).toBe(null);
      expect(rm.detectNotationType('XYZ')).toBe(null);
    }
  },
  isPairNotation: {
    range: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isPairNotation('22-AA')).toBe(true);
      expect(rm.isPairNotation('55-99')).toBe(true);
    },
    single: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isPairNotation('99')).toBe(true);
      expect(rm.isPairNotation('AA')).toBe(true);
    },
    inverse: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isPairNotation('AA-22')).toBe(true);
    },
    reject: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isPairNotation('AKs')).toBe(false);
      expect(rm.isPairNotation('AhKd')).toBe(false);
    }
  },
  isSuitedNotation: {
    range: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isSuitedNotation('A3s-A6s')).toBe(true);
    },
    plus: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isSuitedNotation('A2s+')).toBe(true);
    },
    single: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isSuitedNotation('AKs')).toBe(true);
      expect(rm.isSuitedNotation('KQs')).toBe(true);
    },
    reject: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isSuitedNotation('AKo')).toBe(false);
      expect(rm.isSuitedNotation('22-AA')).toBe(false);
    }
  },
  isOffsuitNotation: {
    range: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isOffsuitNotation('A3o-A6o')).toBe(true);
    },
    plus: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isOffsuitNotation('A2o+')).toBe(true);
    },
    single: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isOffsuitNotation('KQo')).toBe(true);
      expect(rm.isOffsuitNotation('AKo')).toBe(true);
    },
    reject: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isOffsuitNotation('AKs')).toBe(false);
      expect(rm.isOffsuitNotation('22-AA')).toBe(false);
    }
  },
  isWildcardNotation: {
    suitWildcard: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isWildcardNotation('AxKs')).toBe(true);
      expect(rm.isWildcardNotation('KxAh')).toBe(true);
    },
    rankWildcard: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isWildcardNotation('KsXh')).toBe(true);
      expect(rm.isWildcardNotation('AhXd')).toBe(true);
    },
    doubleWildcard: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isWildcardNotation('AsXx')).toBe(true);
      expect(rm.isWildcardNotation('KhXx')).toBe(true);
    },
    mixedWildcard: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isWildcardNotation('AxXh')).toBe(true);
      expect(rm.isWildcardNotation('KxXd')).toBe(true);
    },
    reject: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isWildcardNotation('AKs')).toBe(false);
      expect(rm.isWildcardNotation('AhKd')).toBe(false);
      expect(rm.isWildcardNotation('22-AA')).toBe(false);
    }
  },
  isSpecificHandNotation: {
    valid1: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isSpecificHandNotation('AhKd')).toBe(true);
    },
    valid2: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isSpecificHandNotation('KhQh')).toBe(true);
    },
    reject: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isSpecificHandNotation('AKs')).toBe(false);
      expect(rm.isSpecificHandNotation('22-AA')).toBe(false);
      expect(rm.isSpecificHandNotation('AxKs')).toBe(false);
    },
    length: () => {
      const rm = createTestInstance('AKs');
      expect(rm.isSpecificHandNotation('AhK')).toBe(false);
      expect(rm.isSpecificHandNotation('AhKdQ')).toBe(false);
    }
  }
};

// ============================================================================
// EXTRACTION TEST IMPLEMENTATIONS
// ============================================================================

const testExtraction = {
  extractPairRanks: {
    range: () => {
      const rm = createTestInstance('AKs');
      const ranks = rm.extractPairRanks('22-AA');
      expect(ranks[0]).toBe('2');
      expect(ranks[1]).toBe('A');
    },
    inverse: () => {
      const rm = createTestInstance('AKs');
      const ranks = rm.extractPairRanks('AA-22');
      expect(ranks[0]).toBe('A');
      expect(ranks[1]).toBe('2');
    },
    single: () => {
      const rm = createTestInstance('AKs');
      const ranks = rm.extractPairRanks('99');
      expect(ranks[0]).toBe('9');
      expect(ranks[1]).toBe('9');
    },
    rangeFormat: () => {
      const rm = createTestInstance('AKs');
      const ranks = rm.extractPairRanks('55-99');
      expect(Array.isArray(ranks)).toBe(true);
      expect(ranks.length).toBe(2);
    },
    singleFormat: () => {
      const rm = createTestInstance('AKs');
      const ranks = rm.extractPairRanks('KK');
      expect(ranks[0]).toBe(ranks[1]);
    }
  },
  extractSuitedRanks: {
    range: () => {
      const rm = createTestInstance('AKs');
      const result = rm.extractSuitedRanks('A3s-A6s');
      expect(result).toBeDefined();
    },
    plus: () => {
      const rm = createTestInstance('AKs');
      const result = rm.extractSuitedRanks('A2s+');
      expect(result).toBeDefined();
      expect(result.isPlus).toBe(true);
    },
    single: () => {
      const rm = createTestInstance('AKs');
      const result = rm.extractSuitedRanks('AKs');
      expect(result.rank1).toBe('A');
      expect(result.rank2).toBe('K');
    },
    plusHandling: () => {
      const rm = createTestInstance('AKs');
      const result = rm.extractSuitedRanks('A2s+');
      expect(result.isPlus).toBe(true);
      expect(result.rank1).toBe('A');
      expect(result.rank2).toBe('2');
    }
  },
  extractOffsuitRanks: {
    range: () => {
      const rm = createTestInstance('AKs');
      const result = rm.extractOffsuitRanks('A3o-A6o');
      expect(result).toBeDefined();
    },
    plus: () => {
      const rm = createTestInstance('AKs');
      const result = rm.extractOffsuitRanks('A2o+');
      expect(result.isPlus).toBe(true);
    },
    single: () => {
      const rm = createTestInstance('AKs');
      const result = rm.extractOffsuitRanks('KQo');
      expect(result.rank1).toBe('K');
      expect(result.rank2).toBe('Q');
    },
    plusHandling: () => {
      const rm = createTestInstance('AKs');
      const result = rm.extractOffsuitRanks('A2o+');
      expect(result.isPlus).toBe(true);
      expect(result.rank1).toBe('A');
      expect(result.rank2).toBe('2');
    }
  },
  extractCardsFromHand: {
    extract: () => {
      const rm = createTestInstance('AKs');
      const cards = rm.extractCardsFromHand('AhKd');
      expect(cards[0]).toBe('Ah');
      expect(cards[1]).toBe('Kd');
    },
    returnsArray: () => {
      const rm = createTestInstance('AKs');
      const cards = rm.extractCardsFromHand('KhQh');
      expect(Array.isArray(cards)).toBe(true);
      expect(cards.length).toBe(2);
    },
    fourChars: () => {
      const rm = createTestInstance('AKs');
      const cards = rm.extractCardsFromHand('2c3d');
      expect(cards[0].length).toBe(2);
      expect(cards[1].length).toBe(2);
    }
  },
  extractWildcardHand: {
    suitWildcard: () => {
      const rm = createTestInstance('AKs');
      const result = rm.extractWildcardHand('AxKs');
      expect(result.card1Rank).toBe('A');
      expect(result.card1SuitWildcard).toBe(true);
      expect(result.card1ExcludeSuit).toBe('s');
      expect(result.card2Rank).toBe('K');
      expect(result.card2Suit).toBe('s');
    },
    rankWildcard: () => {
      const rm = createTestInstance('AKs');
      const result = rm.extractWildcardHand('KsXh');
      expect(result.card1Rank).toBe('K');
      expect(result.card1Suit).toBe('s');
      expect(result.card2RankWildcard).toBe(true);
      expect(result.card2ExcludeRank).toBe('K');
      expect(result.card2Suit).toBe('h');
    },
    doubleWildcard: () => {
      const rm = createTestInstance('AKs');
      const result = rm.extractWildcardHand('AsXx');
      expect(result.card1Rank).toBe('A');
      expect(result.card1Suit).toBe('s');
      expect(result.card2RankWildcard).toBe(true);
      expect(result.card2SuitWildcard).toBe(true);
      expect(result.card2ExcludeRank).toBe('A');
    },
    mixedWildcard: () => {
      const rm = createTestInstance('AKs');
      const result = rm.extractWildcardHand('AxXh');
      expect(result.card1Rank).toBe('A');
      expect(result.card1SuitWildcard).toBe(true);
      expect(result.card1ExcludeSuit).toBe('s');
      expect(result.card2RankWildcard).toBe(true);
      expect(result.card2ExcludeRank).toBe('A');
      expect(result.card2Suit).toBe('h');
    }
  }
};

// ============================================================================
// GENERATION TEST IMPLEMENTATIONS
// ============================================================================

const testGeneration = {
  generatePairCombinations: {
    allSix: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generatePairCombinations('A');
      expect(combos.length).toBe(6);
    },
    allSuits: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generatePairCombinations('K');
      const suits = new Set();
      combos.forEach(combo => {
        suits.add(combo[1]);
        suits.add(combo[3]);
      });
      expect(suits.size).toBeGreaterThanOrEqual(2);
    },
    normalized: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generatePairCombinations('Q');
      combos.forEach(combo => {
        expect(combo.length).toBe(4);
        expect(combo[0]).toBe(combo[2]);
      });
    },
    arrayLength: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generatePairCombinations('9');
      expect(Array.isArray(combos)).toBe(true);
      expect(combos.length).toBe(6);
    }
  },
  generatePairRange: {
    ascending: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.generatePairRange('2', '5');
      expect(hands.length).toBe(24); // 4 ranks * 6 combos
    },
    descending: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.generatePairRange('A', 'K');
      expect(hands.length).toBe(12); // 2 ranks * 6 combos
    },
    singleRank: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.generatePairRange('Q', 'Q');
      expect(hands.length).toBe(6);
    },
    callsCombinations: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.generatePairRange('2', '3');
      expect(hands.length).toBe(12); // 2 ranks * 6 combos
    }
  },
  generateSuitedRange: {
    allFour: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generateSuitedRange('A', 'K');
      expect(combos.length).toBe(4);
    },
    onePerSuit: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generateSuitedRange('A', 'K');
      const suits = new Set(combos.map(c => c[1]));
      expect(suits.size).toBe(4);
    },
    normalized: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generateSuitedRange('Q', 'J');
      combos.forEach(combo => {
        expect(combo[1]).toBe(combo[3]);
        expect(combo[0]).toBe('Q');
        expect(combo[2]).toBe('J');
      });
    },
    arrayLength: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generateSuitedRange('K', 'Q');
      expect(Array.isArray(combos)).toBe(true);
      expect(combos.length).toBe(4);
    }
  },
  generateOffsuitRange: {
    allTwelve: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generateOffsuitRange('A', 'K');
      expect(combos.length).toBe(12);
    },
    differentSuits: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generateOffsuitRange('K', 'Q');
      combos.forEach(combo => {
        expect(combo[1]).not.toBe(combo[3]);
      });
    },
    normalized: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generateOffsuitRange('A', '2');
      combos.forEach(combo => {
        expect(combo.length).toBe(4);
        expect(combo[0]).toBe('A');
        expect(combo[2]).toBe('2');
      });
    },
    arrayLength: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generateOffsuitRange('Q', 'J');
      expect(Array.isArray(combos)).toBe(true);
      expect(combos.length).toBe(12);
    }
  },
  generateSuitedCombination: {
    sameSuit: () => {
      const rm = createTestInstance('AKs');
      const combo = rm.generateSuitedCombination('A', 's', 'K', 's');
      expect(combo[1]).toBe(combo[3]);
    },
    normalized: () => {
      const rm = createTestInstance('AKs');
      const combo = rm.generateSuitedCombination('K', 'h', 'A', 'h');
      expect(combo[0]).toBe('A');
      expect(combo[2]).toBe('K');
    },
    returnsString: () => {
      const rm = createTestInstance('AKs');
      const combo = rm.generateSuitedCombination('A', 's', 'K', 's');
      expect(typeof combo).toBe('string');
      expect(combo.length).toBe(4);
    }
  },
  generateOffsuitCombination: {
    differentSuits: () => {
      const rm = createTestInstance('AKs');
      const combo = rm.generateOffsuitCombination('A', 's', 'K', 'h');
      expect(combo[1]).not.toBe(combo[3]);
    },
    normalized: () => {
      const rm = createTestInstance('AKs');
      const combo = rm.generateOffsuitCombination('K', 'd', 'A', 'c');
      expect(combo[0]).toBe('A');
      expect(combo[2]).toBe('K');
    },
    returnsString: () => {
      const rm = createTestInstance('AKs');
      const combo = rm.generateOffsuitCombination('A', 's', 'K', 'h');
      expect(typeof combo).toBe('string');
      expect(combo.length).toBe(4);
    }
  },
  generateWildcardCombinations: {
    suitWildcard: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generateWildcardCombinations('AxKs');
      expect(combos.length).toBe(3); // AhKs, AdKs, AcKs (excluding AsKs)
      expect(combos).toContain('AhKs');
      expect(combos).toContain('AdKs');
      expect(combos).toContain('AcKs');
      expect(combos).not.toContain('AsKs');
    },
    rankWildcard: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generateWildcardCombinations('KsXh');
      expect(combos.length).toBe(12); // All ranks except K
      expect(combos).toContain('AhKs');
      expect(combos).toContain('KsQh');
      expect(combos).not.toContain('KsKh');
    },
    doubleWildcard: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generateWildcardCombinations('AsXx');
      expect(combos.length).toBe(51); // All cards except As
      expect(combos).toContain('AsKh');
      expect(combos).toContain('AsQd');
      expect(combos).not.toContain('AsAs');
    },
    mixedWildcard: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generateWildcardCombinations('AxXh');
      expect(combos.length).toBe(36); // 3 suits × 12 ranks
      expect(combos).toContain('AhKh');
      expect(combos).toContain('AdQh');
      expect(combos).not.toContain('AsAh'); // Excludes As
      expect(combos).not.toContain('AhAh'); // Excludes Ah (same rank)
    },
    excludeSuit: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generateWildcardCombinations('AxKs');
      const suits = combos.map(c => c[1]);
      expect(suits).not.toContain('s');
      expect(new Set(suits).size).toBe(3);
    },
    excludeRank: () => {
      const rm = createTestInstance('AKs');
      const info = rm.extractWildcardHand('KsXh');
      const card2Ranks = rm._getCard2Ranks(info);
      expect(card2Ranks).not.toContain('K');
      expect(card2Ranks.length).toBe(12);
    },
    normalized: () => {
      const rm = createTestInstance('AKs');
      const combos = rm.generateWildcardCombinations('KxAh');
      combos.forEach(combo => {
        expect(combo.length).toBe(4);
        expect(combo[0]).toBe('A');
        expect(combo[2]).toBe('K');
      });
    }
  }
};

// ============================================================================
// PARSING TEST IMPLEMENTATIONS
// ============================================================================

const testParsing = {
  parseSpecificHand: {
    khQh: () => {
      const rm = createTestInstance('AKs');
      const result = rm.parseSpecificHand('KhQh');
      expect(result).toBe('KhQh');
    },
    ahKd: () => {
      const rm = createTestInstance('AKs');
      const result = rm.parseSpecificHand('AhKd');
      expect(result).toBe('AhKd');
    },
    normalize: () => {
      const rm = createTestInstance('AKs');
      const result = rm.parseSpecificHand('KdAh');
      expect(result).toBe('AhKd');
    },
    validate: () => {
      const rm = createTestInstance('AKs');
      expect(() => rm.parseSpecificHand('AhK')).toThrow();
    },
    returnsString: () => {
      const rm = createTestInstance('AKs');
      const result = rm.parseSpecificHand('AsKs');
      expect(typeof result).toBe('string');
    }
  },
  parseWildcardHand: {
    suitWildcard: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.parseWildcardHand('AxKs');
      expect(Array.isArray(hands)).toBe(true);
      expect(hands.length).toBe(3);
      expect(hands).toContain('AhKs');
      expect(hands).toContain('AdKs');
      expect(hands).toContain('AcKs');
    },
    rankWildcard: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.parseWildcardHand('KsXh');
      expect(Array.isArray(hands)).toBe(true);
      expect(hands.length).toBe(12);
      expect(hands).toContain('AhKs');
      expect(hands).toContain('KsQh');
    },
    doubleWildcard: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.parseWildcardHand('AsXx');
      expect(Array.isArray(hands)).toBe(true);
      expect(hands.length).toBe(51);
      expect(hands).toContain('AsKh');
      expect(hands).not.toContain('AsAs');
    },
    mixedWildcard: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.parseWildcardHand('AxXh');
      expect(Array.isArray(hands)).toBe(true);
      expect(hands.length).toBe(36);
      expect(hands).toContain('AhKh');
      expect(hands).not.toContain('AsAh');
    },
    generateCombinations: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.parseWildcardHand('AxKs');
      expect(hands.length).toBeGreaterThan(0);
      hands.forEach(hand => {
        expect(hand.length).toBe(4);
        expect(hand[2]).toBe('K');
        expect(hand[3]).toBe('s');
      });
    },
    normalize: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.parseWildcardHand('KxAh');
      hands.forEach(hand => {
        expect(hand[0]).toBe('A');
        expect(hand[2]).toBe('K');
      });
    },
    returnsArray: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.parseWildcardHand('AxKs');
      expect(Array.isArray(hands)).toBe(true);
      expect(hands.length).toBeGreaterThan(0);
    }
  },
  parsePairRange: {
    range: () => {
      const rm = createTestInstance('22-AA');
      expect(rm.size()).toBeGreaterThan(0);
    },
    inverse: () => {
      const rm = createTestInstance('AA-22');
      expect(rm.size()).toBeGreaterThan(0);
    },
    single: () => {
      const rm = createTestInstance('99');
      expect(rm.size()).toBe(6);
    },
    returnsArray: () => {
      const rm = createTestInstance('55-66');
      const hands = rm.toArray();
      expect(Array.isArray(hands)).toBe(true);
      expect(hands.length).toBe(12);
    }
  },
  parseSuitedRange: {
    range: () => {
      const rm = createTestInstance('A3s-A6s');
      expect(rm.size()).toBe(16); // 4 hands * 4 suits
    },
    plus: () => {
      const rm = createTestInstance('A2s+');
      expect(rm.size()).toBeGreaterThan(0);
    },
    single: () => {
      const rm = createTestInstance('AKs');
      expect(rm.size()).toBe(4);
    },
    plusHandling: () => {
      const rm = createTestInstance('A2s+');
      expect(rm.contains('AsKs')).toBe(true);
      expect(rm.contains('As2s')).toBe(true);
    },
    returnsArray: () => {
      const rm = createTestInstance('A3s-A5s');
      const hands = rm.toArray();
      expect(Array.isArray(hands)).toBe(true);
    }
  },
  parseOffsuitRange: {
    range: () => {
      const rm = createTestInstance('A3o-A6o');
      expect(rm.size()).toBe(48); // 4 hands * 12 combos
    },
    plus: () => {
      const rm = createTestInstance('A2o+');
      expect(rm.size()).toBeGreaterThan(0);
    },
    single: () => {
      const rm = createTestInstance('KQo');
      expect(rm.size()).toBe(12);
    },
    plusHandling: () => {
      const rm = createTestInstance('A2o+');
      expect(rm.contains('AsKh')).toBe(true);
    },
    returnsArray: () => {
      const rm = createTestInstance('A3o-A5o');
      const hands = rm.toArray();
      expect(Array.isArray(hands)).toBe(true);
    }
  },
  parseSegment: {
    pair: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.parseSegment('22-AA');
      expect(Array.isArray(hands)).toBe(true);
      expect(hands.length).toBeGreaterThan(0);
    },
    suited: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.parseSegment('A2s+');
      expect(Array.isArray(hands)).toBe(true);
    },
    offsuit: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.parseSegment('A2o+');
      expect(Array.isArray(hands)).toBe(true);
    },
    wildcard: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.parseSegment('AxKs');
      expect(Array.isArray(hands)).toBe(true);
      expect(hands.length).toBe(3);
    },
    specific: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.parseSegment('AhKd');
      expect(Array.isArray(hands)).toBe(true);
      expect(hands.length).toBe(1);
    },
    returnsArray: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.parseSegment('99');
      expect(Array.isArray(hands)).toBe(true);
    }
  },
  parseString: {
    commaSeparated: () => {
      const rm = createTestInstance('22-AA,AKs');
      expect(rm.size()).toBeGreaterThan(0);
    },
    whitespace: () => {
      const rm = createTestInstance('22-AA, AKs');
      expect(rm.size()).toBeGreaterThan(0);
    },
    single: () => {
      const rm = createTestInstance('AKs');
      expect(rm.size()).toBe(4);
    },
    combine: () => {
      const rm = createTestInstance('AKs,KQo');
      expect(rm.size()).toBe(16); // 4 + 12
    },
    deduplicate: () => {
      const rm = createTestInstance('AKs,AKs');
      expect(rm.size()).toBe(4);
    }
  },
  parseArray: {
    rawArray: () => {
      const rm = createTestInstance(['AhKd', 'AsKs']);
      expect(rm.size()).toBe(2);
    },
    validate: () => {
      expect(() => new RangeManager(['AhK'])).toThrow();
    },
    normalize: () => {
      const rm = createTestInstance(['KdAh', 'QsJh']);
      expect(rm.contains('AhKd')).toBe(true);
    },
    returnsArray: () => {
      const rm = createTestInstance(['AhKd', 'AsKs']);
      const hands = rm.toArray();
      expect(Array.isArray(hands)).toBe(true);
    },
    empty: () => {
      expect(() => new RangeManager([])).toThrow();
    }
  },
  parse: {
    string: () => {
      const rm = createTestInstance('AKs');
      expect(rm.size()).toBe(4);
    },
    array: () => {
      const rm = createTestInstance(['AhKd', 'AsKs']);
      expect(rm.size()).toBe(2);
    },
    returnsArray: () => {
      const rm = createTestInstance('AKs');
      const hands = rm.toArray();
      expect(Array.isArray(hands)).toBe(true);
    }
  },
  constructor: {
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
  },
  errors: {
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
  match: {
    filter: async () => {
      const rm = new RangeManager('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const filtered = await rm.match(['Pair'], board);
      expect(filtered).toBeInstanceOf(RangeManager);
    },
    requiresBoard: async () => {
      const rm = new RangeManager('AKs');
      await expect(rm.match(['Pair'])).rejects.toThrow();
    },
    errorNoBoard: async () => {
      const rm = new RangeManager('AKs');
      await expect(rm.match(['Pair'])).rejects.toThrow();
    },
    newInstance: async () => {
      const rm = new RangeManager('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const filtered = await rm.match(['Pair'], board);
      expect(filtered).not.toBe(rm);
    },
    immutable: async () => {
      const rm = new RangeManager('AKs');
      const originalSize = rm.size();
      const board = ['2h', '3d', '4c', '5s', '6h'];
      await rm.match(['Pair'], board);
      expect(rm.size()).toBe(originalSize);
    },
    multiple: async () => {
      const rm = new RangeManager('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const filtered = await rm.match(['Pair', 'Two Pair'], board);
      expect(filtered).toBeInstanceOf(RangeManager);
    },
    normalize: async () => {
      const rm = new RangeManager('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const filtered = await rm.match(['Pair'], board);
      expect(filtered).toBeInstanceOf(RangeManager);
    }
  },
  handMatchesCriteria: {
    evaluate: async () => {
      const rm = createTestInstance('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const result = await rm.handMatchesCriteria('AhKd', ['Pair'], board);
      expect(typeof result).toBe('boolean');
    },
    check: async () => {
      const rm = createTestInstance('AKs');
      const board = ['Ah', 'Kd', 'Qc', 'Js', 'Th'];
      const result = await rm.handMatchesCriteria('AhKd', ['Straight'], board);
      expect(typeof result).toBe('boolean');
    },
    match: async () => {
      const rm = createTestInstance('AKs');
      const board = ['Ah', 'Ad', 'Ac', '2s', '3h'];
      const result = await rm.handMatchesCriteria('AhKd', ['Three of a Kind'], board);
      expect(result).toBe(true);
    },
    noMatch: async () => {
      const rm = createTestInstance('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const result = await rm.handMatchesCriteria('AhKd', ['Flush'], board);
      expect(result).toBe(false);
    }
  },
  evaluateHandWithBoard: {
    combine: async () => {
      const rm = createTestInstance('AKs');
      const board = ['2h', '3d', '4c'];
      const result = await rm.evaluateHandWithBoard('AhKd', board);
      expect(result).toBeDefined();
    },
    callExtval: async () => {
      const { evaluateHand } = await import('poker-extval');
      const rm = createTestInstance('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const result = await rm.evaluateHandWithBoard('AhKd', board);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    },
    returnsObject: async () => {
      const rm = createTestInstance('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const result = await rm.evaluateHandWithBoard('AhKd', board);
      expect(typeof result).toBe('object');
    },
    fivePlus: async () => {
      const rm = createTestInstance('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const result = await rm.evaluateHandWithBoard('AhKd', board);
      expect(result).toBeDefined();
    }
  },
  normalizeCriteria: {
    pair: () => {
      const rm = createTestInstance('AKs');
      const normalized = rm.normalizeCriteria(['Pair']);
      expect(normalized).toContain('isPair');
    },
    twoPair: () => {
      const rm = createTestInstance('AKs');
      const normalized = rm.normalizeCriteria(['Two Pair']);
      expect(normalized).toContain('isTwoPair');
    },
    threeKind: () => {
      const rm = createTestInstance('AKs');
      const normalized = rm.normalizeCriteria(['Three of a Kind']);
      expect(normalized).toContain('isThreeOfAKind');
    },
    direct: () => {
      const rm = createTestInstance('AKs');
      const normalized = rm.normalizeCriteria(['isPair']);
      expect(normalized).toContain('isPair');
    },
    returnsArray: () => {
      const rm = createTestInstance('AKs');
      const normalized = rm.normalizeCriteria(['Pair', 'Two Pair']);
      expect(Array.isArray(normalized)).toBe(true);
    }
  },
  errors: {
    noBoard: async () => {
      const rm = new RangeManager('AKs');
      await expect(rm.match(['Pair'])).rejects.toThrow();
    },
    invalidCriteria: async () => {
      const rm = new RangeManager('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      await expect(rm.match(['Invalid'], board)).rejects.toThrow();
    },
    invalidBoard: async () => {
      const rm = new RangeManager('AKs');
      await expect(rm.match(['Pair'], ['invalid'])).rejects.toThrow();
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

const testIntegration = {
  workflow: {
    full: async () => {
      const rm = new RangeManager('22-AA,AKs');
      const filtered = await rm.exclude(['Ah']).match(['Pair'], ['2h', '3d', '4c', '5s', '6h']);
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
      await rm.exclude(['Ah']).match(['Pair'], ['2h', '3d', '4c', '5s', '6h']);
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
      const filtered = await (await rm.match(['Pair'], board)).match(['Two Pair'], board);
      expect(filtered).toBeInstanceOf(RangeManager);
    },
    excludeAndMatch: async () => {
      const rm = new RangeManager('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const filtered = await rm.exclude(['Ah']).match(['Pair'], board);
      expect(filtered).toBeInstanceOf(RangeManager);
    },
    queryAfter: async () => {
      const rm = new RangeManager('AKs');
      const board = ['2h', '3d', '4c', '5s', '6h'];
      const size = (await rm.exclude(['Ah']).match(['Pair'], board)).size();
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
      rm.match(['Pair'], board);
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
      const filtered = await rm.match(['Royal Flush'], board);
      expect(filtered.size()).toBe(0);
    }
  }
};

// ============================================================================
// TEST DESCRIPTIONS - Easily skimmable section
// ============================================================================

describe('RangeManager', () => {
  
  // ==========================================================================
  // VALIDATION TESTS
  // ==========================================================================
  
  describe('Validation Methods', () => {
    describe('isValidCard()', () => {
      it('should validate correct card format', testValidation.isValidCard.validFormat);
      it('should reject cards with invalid length', testValidation.isValidCard.invalidLength);
      it('should reject cards with invalid rank', testValidation.isValidCard.invalidRank);
      it('should reject cards with invalid suit', testValidation.isValidCard.invalidSuit);
      it('should accept all valid ranks (A, K, Q, J, T, 9-2)', testValidation.isValidCard.allValidRanks);
      it('should accept all valid suits (s, h, d, c)', testValidation.isValidCard.allValidSuits);
    });

    describe('isValidHand()', () => {
      it('should validate correct hand format (4 characters)', testValidation.isValidHand.validFormat);
      it('should reject hands with invalid length', testValidation.isValidHand.invalidLength);
      it('should reject hands with invalid cards', testValidation.isValidHand.invalidCards);
      it('should reject hands with duplicate cards', testValidation.isValidHand.duplicateCards);
      it('should accept valid two-card hands', testValidation.isValidHand.validHands);
    });

    describe('isValidRank()', () => {
      it('should accept all valid ranks', testValidation.isValidRank.allValidRanks);
      it('should reject invalid rank characters', testValidation.isValidRank.invalidRanks);
      it('should handle case sensitivity correctly', testValidation.isValidRank.caseSensitivity);
    });

    describe('isValidSuit()', () => {
      it('should accept all valid suits', testValidation.isValidSuit.allValidSuits);
      it('should reject invalid suit characters', testValidation.isValidSuit.invalidSuits);
      it('should handle case sensitivity correctly', testValidation.isValidSuit.caseSensitivity);
    });
  });

  // ==========================================================================
  // NORMALIZATION TESTS
  // ==========================================================================
  
  describe('Normalization Methods', () => {
    describe('normalizeHand()', () => {
      it('should normalize non-pair hands with high card first', testNormalization.normalizeHand.nonPairHighFirst);
      it('should normalize pair hands with suits sorted alphabetically', testNormalization.normalizeHand.pairSuitsSorted);
      it('should handle already normalized hands', testNormalization.normalizeHand.alreadyNormalized);
      it('should maintain consistent format', testNormalization.normalizeHand.consistentFormat);
    });

    describe('normalizeCardOrder()', () => {
      it('should order cards with high rank first', testNormalization.normalizeCardOrder.highRankFirst);
      it('should handle equal ranks (pairs)', testNormalization.normalizeCardOrder.equalRanks);
      it('should return ordered array [highCard, lowCard]', testNormalization.normalizeCardOrder.returnsOrderedArray);
    });

    describe('normalizeNotation()', () => {
      it('should trim whitespace from notation', testNormalization.normalizeNotation.trimWhitespace);
      it('should handle case conversion', testNormalization.normalizeNotation.caseConversion);
      it('should normalize multiple spaces', testNormalization.normalizeNotation.multipleSpaces);
    });
  });

  // ==========================================================================
  // RANK & SUIT UTILITY TESTS
  // ==========================================================================
  
  describe('Rank & Suit Utility Methods', () => {
    describe('getRankValue()', () => {
      it('should map A to 14', testUtility.getRankValue.mapA);
      it('should map K to 13', testUtility.getRankValue.mapK);
      it('should map Q to 12', testUtility.getRankValue.mapQ);
      it('should map J to 11', testUtility.getRankValue.mapJ);
      it('should map T to 10', testUtility.getRankValue.mapT);
      it('should map 9-2 to 9-2', testUtility.getRankValue.mapNumeric);
    });

    describe('compareRanks()', () => {
      it('should return 1 when first rank is higher', testUtility.compareRanks.firstHigher);
      it('should return -1 when first rank is lower', testUtility.compareRanks.firstLower);
      it('should return 0 when ranks are equal', testUtility.compareRanks.equal);
      it('should handle all rank comparisons correctly', testUtility.compareRanks.allComparisons);
    });

    describe('getAllRanksBetween()', () => {
      it('should return all ranks in ascending order', testUtility.getAllRanksBetween.ascending);
      it('should handle inverse ranges (AA-22)', testUtility.getAllRanksBetween.inverse);
      it('should return single rank array for same start/end', testUtility.getAllRanksBetween.singleRank);
      it('should handle full range (22-AA)', testUtility.getAllRanksBetween.fullRange);
    });

    describe('getAllSuits()', () => {
      it('should return all four suits', testUtility.getAllSuits.allSuits);
      it('should return suits in correct order', testUtility.getAllSuits.correctOrder);
    });
  });

  // ==========================================================================
  // PATTERN DETECTION TESTS
  // ==========================================================================
  
  describe('Pattern Detection Methods', () => {
    describe('detectNotationType()', () => {
      it('should detect pair notation', testPattern.detectNotationType.pair);
      it('should detect suited notation', testPattern.detectNotationType.suited);
      it('should detect offsuit notation', testPattern.detectNotationType.offsuit);
      it('should detect wildcard notation', testPattern.detectNotationType.wildcard);
      it('should detect specific hand notation', testPattern.detectNotationType.specific);
      it('should return null for unrecognized notation', testPattern.detectNotationType.unrecognized);
    });

    describe('isPairNotation()', () => {
      it('should identify pair range notation (22-AA)', testPattern.isPairNotation.range);
      it('should identify single pair notation (99)', testPattern.isPairNotation.single);
      it('should identify inverse pair notation (AA-22)', testPattern.isPairNotation.inverse);
      it('should reject non-pair notation', testPattern.isPairNotation.reject);
    });

    describe('isSuitedNotation()', () => {
      it('should identify suited range notation (A3s-A6s)', testPattern.isSuitedNotation.range);
      it('should identify suited plus notation (A2s+)', testPattern.isSuitedNotation.plus);
      it('should identify single suited notation (AKs)', testPattern.isSuitedNotation.single);
      it('should reject non-suited notation', testPattern.isSuitedNotation.reject);
    });

    describe('isOffsuitNotation()', () => {
      it('should identify offsuit range notation (A3o-A6o)', testPattern.isOffsuitNotation.range);
      it('should identify offsuit plus notation (A2o+)', testPattern.isOffsuitNotation.plus);
      it('should identify single offsuit notation (KQo)', testPattern.isOffsuitNotation.single);
      it('should reject non-offsuit notation', testPattern.isOffsuitNotation.reject);
    });

    describe('isWildcardNotation()', () => {
      it('should identify suit wildcard notation (AxKs)', testPattern.isWildcardNotation.suitWildcard);
      it('should identify rank wildcard notation (KsXh)', testPattern.isWildcardNotation.rankWildcard);
      it('should identify double wildcard notation (AsXx)', testPattern.isWildcardNotation.doubleWildcard);
      it('should identify mixed wildcard notation (AxXh)', testPattern.isWildcardNotation.mixedWildcard);
      it('should reject non-wildcard notation', testPattern.isWildcardNotation.reject);
    });

    describe('isSpecificHandNotation()', () => {
      it('should identify specific hand notation (AhKd)', testPattern.isSpecificHandNotation.valid1);
      it('should identify specific hand notation (KhQh)', testPattern.isSpecificHandNotation.valid2);
      it('should reject non-specific hand notation', testPattern.isSpecificHandNotation.reject);
      it('should require exactly 4 characters', testPattern.isSpecificHandNotation.length);
    });
  });

  // ==========================================================================
  // EXTRACTION TESTS
  // ==========================================================================
  
  describe('Extraction Methods', () => {
    describe('extractPairRanks()', () => {
      it('should extract ranks from pair range (22-AA)', testExtraction.extractPairRanks.range);
      it('should extract ranks from inverse pair range (AA-22)', testExtraction.extractPairRanks.inverse);
      it('should extract rank from single pair (99)', testExtraction.extractPairRanks.single);
      it('should return [startRank, endRank] for ranges', testExtraction.extractPairRanks.rangeFormat);
      it('should return [rank, rank] for single pairs', testExtraction.extractPairRanks.singleFormat);
    });

    describe('extractSuitedRanks()', () => {
      it('should extract ranks from suited range (A3s-A6s)', testExtraction.extractSuitedRanks.range);
      it('should extract ranks from suited plus notation (A2s+)', testExtraction.extractSuitedRanks.plus);
      it('should extract ranks from single suited (AKs)', testExtraction.extractSuitedRanks.single);
      it('should handle plus notation correctly', testExtraction.extractSuitedRanks.plusHandling);
    });

    describe('extractOffsuitRanks()', () => {
      it('should extract ranks from offsuit range (A3o-A6o)', testExtraction.extractOffsuitRanks.range);
      it('should extract ranks from offsuit plus notation (A2o+)', testExtraction.extractOffsuitRanks.plus);
      it('should extract ranks from single offsuit (KQo)', testExtraction.extractOffsuitRanks.single);
      it('should handle plus notation correctly', testExtraction.extractOffsuitRanks.plusHandling);
    });

    describe('extractCardsFromHand()', () => {
      it('should extract two cards from hand string', testExtraction.extractCardsFromHand.extract);
      it('should return [card1, card2] array', testExtraction.extractCardsFromHand.returnsArray);
      it('should handle 4-character hand strings', testExtraction.extractCardsFromHand.fourChars);
    });

    describe('extractWildcardHand()', () => {
      it('should extract suit wildcard information (AxKs)', testExtraction.extractWildcardHand.suitWildcard);
      it('should extract rank wildcard information (KsXh)', testExtraction.extractWildcardHand.rankWildcard);
      it('should extract double wildcard information (AsXx)', testExtraction.extractWildcardHand.doubleWildcard);
      it('should extract mixed wildcard information (AxXh)', testExtraction.extractWildcardHand.mixedWildcard);
    });
  });

  // ==========================================================================
  // GENERATION TESTS
  // ==========================================================================
  
  describe('Generation Methods', () => {
    describe('generatePairCombinations()', () => {
      it('should generate all 6 combinations for a pair', testGeneration.generatePairCombinations.allSix);
      it('should include all suit combinations', testGeneration.generatePairCombinations.allSuits);
      it('should normalize each combination', testGeneration.generatePairCombinations.normalized);
      it('should return array of 6 hands', testGeneration.generatePairCombinations.arrayLength);
    });

    describe('generatePairRange()', () => {
      it('should generate all pairs in ascending range', testGeneration.generatePairRange.ascending);
      it('should generate all pairs in descending range', testGeneration.generatePairRange.descending);
      it('should handle single rank correctly', testGeneration.generatePairRange.singleRank);
      it('should call generatePairCombinations for each rank', testGeneration.generatePairRange.callsCombinations);
    });

    describe('generateSuitedRange()', () => {
      it('should generate all 4 suited combinations', testGeneration.generateSuitedRange.allFour);
      it('should create one combination per suit', testGeneration.generateSuitedRange.onePerSuit);
      it('should normalize each combination', testGeneration.generateSuitedRange.normalized);
      it('should return array of 4 hands', testGeneration.generateSuitedRange.arrayLength);
    });

    describe('generateOffsuitRange()', () => {
      it('should generate all 12 offsuit combinations', testGeneration.generateOffsuitRange.allTwelve);
      it('should create combinations with different suits', testGeneration.generateOffsuitRange.differentSuits);
      it('should normalize each combination', testGeneration.generateOffsuitRange.normalized);
      it('should return array of 12 hands', testGeneration.generateOffsuitRange.arrayLength);
    });

    describe('generateSuitedCombination()', () => {
      it('should validate same suit requirement', testGeneration.generateSuitedCombination.sameSuit);
      it('should normalize hand ordering', testGeneration.generateSuitedCombination.normalized);
      it('should return single hand string', testGeneration.generateSuitedCombination.returnsString);
    });

    describe('generateOffsuitCombination()', () => {
      it('should validate different suits requirement', testGeneration.generateOffsuitCombination.differentSuits);
      it('should normalize hand ordering', testGeneration.generateOffsuitCombination.normalized);
      it('should return single hand string', testGeneration.generateOffsuitCombination.returnsString);
    });

    describe('generateWildcardCombinations()', () => {
      it('should generate combinations for suit wildcard (AxKs)', testGeneration.generateWildcardCombinations.suitWildcard);
      it('should generate combinations for rank wildcard (KsXh)', testGeneration.generateWildcardCombinations.rankWildcard);
      it('should generate combinations for double wildcard (AsXx)', testGeneration.generateWildcardCombinations.doubleWildcard);
      it('should generate combinations for mixed wildcard (AxXh)', testGeneration.generateWildcardCombinations.mixedWildcard);
      it('should exclude specified suit for x wildcard', testGeneration.generateWildcardCombinations.excludeSuit);
      it('should exclude specified rank for X wildcard', testGeneration.generateWildcardCombinations.excludeRank);
      it('should normalize all generated combinations', testGeneration.generateWildcardCombinations.normalized);
    });
  });

  // ==========================================================================
  // PARSING TESTS
  // ==========================================================================
  
  describe('Parsing Methods', () => {
    describe('parseSpecificHand()', () => {
      it('should parse specific hand (KhQh)', testParsing.parseSpecificHand.khQh);
      it('should parse specific hand (AhKd)', testParsing.parseSpecificHand.ahKd);
      it('should normalize hand ordering', testParsing.parseSpecificHand.normalize);
      it('should validate hand format', testParsing.parseSpecificHand.validate);
      it('should return single normalized hand string', testParsing.parseSpecificHand.returnsString);
    });

    describe('parseWildcardHand()', () => {
      it('should parse suit wildcard hand (AxKs)', testParsing.parseWildcardHand.suitWildcard);
      it('should parse rank wildcard hand (KsXh)', testParsing.parseWildcardHand.rankWildcard);
      it('should parse double wildcard hand (AsXx)', testParsing.parseWildcardHand.doubleWildcard);
      it('should parse mixed wildcard hand (AxXh)', testParsing.parseWildcardHand.mixedWildcard);
      it('should generate all valid combinations', testParsing.parseWildcardHand.generateCombinations);
      it('should normalize all generated hands', testParsing.parseWildcardHand.normalize);
      it('should return array of normalized hands', testParsing.parseWildcardHand.returnsArray);
    });

    describe('parsePairRange()', () => {
      it('should parse pair range (22-AA)', testParsing.parsePairRange.range);
      it('should parse inverse pair range (AA-22)', testParsing.parsePairRange.inverse);
      it('should parse single pair (99)', testParsing.parsePairRange.single);
      it('should return array of all pair combinations', testParsing.parsePairRange.returnsArray);
    });

    describe('parseSuitedRange()', () => {
      it('should parse suited range (A3s-A6s)', testParsing.parseSuitedRange.range);
      it('should parse suited plus notation (A2s+)', testParsing.parseSuitedRange.plus);
      it('should parse single suited (AKs)', testParsing.parseSuitedRange.single);
      it('should handle plus notation correctly', testParsing.parseSuitedRange.plusHandling);
      it('should return array of suited combinations', testParsing.parseSuitedRange.returnsArray);
    });

    describe('parseOffsuitRange()', () => {
      it('should parse offsuit range (A3o-A6o)', testParsing.parseOffsuitRange.range);
      it('should parse offsuit plus notation (A2o+)', testParsing.parseOffsuitRange.plus);
      it('should parse single offsuit (KQo)', testParsing.parseOffsuitRange.single);
      it('should handle plus notation correctly', testParsing.parseOffsuitRange.plusHandling);
      it('should return array of offsuit combinations', testParsing.parseOffsuitRange.returnsArray);
    });

    describe('parseSegment()', () => {
      it('should route pair notation to parsePairRange', testParsing.parseSegment.pair);
      it('should route suited notation to parseSuitedRange', testParsing.parseSegment.suited);
      it('should route offsuit notation to parseOffsuitRange', testParsing.parseSegment.offsuit);
      it('should route wildcard notation to parseWildcardHand', testParsing.parseSegment.wildcard);
      it('should route specific hand to parseSpecificHand', testParsing.parseSegment.specific);
      it('should return array of hands', testParsing.parseSegment.returnsArray);
    });

    describe('parseString()', () => {
      it('should parse comma-separated notation', testParsing.parseString.commaSeparated);
      it('should normalize whitespace', testParsing.parseString.whitespace);
      it('should handle single segment', testParsing.parseString.single);
      it('should combine results from multiple segments', testParsing.parseString.combine);
      it('should deduplicate hands', testParsing.parseString.deduplicate);
    });

    describe('parseArray()', () => {
      it('should parse raw array input', testParsing.parseArray.rawArray);
      it('should validate array format', testParsing.parseArray.validate);
      it('should normalize each hand', testParsing.parseArray.normalize);
      it('should return array of normalized hands', testParsing.parseArray.returnsArray);
      it('should handle empty array', testParsing.parseArray.empty);
    });

    describe('parse()', () => {
      it('should detect string input and route to parseString', testParsing.parse.string);
      it('should detect array input and route to parseArray', testParsing.parse.array);
      it('should return array of normalized hands', testParsing.parse.returnsArray);
    });

    describe('Constructor', () => {
      it('should initialize with string notation', testParsing.constructor.string);
      it('should initialize with array notation', testParsing.constructor.array);
      it('should accept optional dead cards', testParsing.constructor.deadCards);
      it('should parse input correctly', testParsing.constructor.parse);
      it('should store rawInput', testParsing.constructor.rawInput);
      it('should store deadCards', testParsing.constructor.deadCardsStored);
      it('should initialize filteredHands', testParsing.constructor.filteredHands);
    });

    describe('Invalid Notation Handling', () => {
      it('should throw error for invalid card format', testParsing.errors.invalidCard);
      it('should throw error for invalid notation', testParsing.errors.invalidNotation);
      it('should throw error for empty input', testParsing.errors.empty);
      it('should throw error for non-array non-string input', testParsing.errors.invalidType);
    });
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

    describe('match()', () => {
      it('should filter by hand strength criteria', testFiltering.match.filter);
      it('should require board cards for strength evaluation', testFiltering.match.requiresBoard);
      it('should throw error if board cards missing', testFiltering.match.errorNoBoard);
      it('should return new RangeManager instance', testFiltering.match.newInstance);
      it('should not modify original range', testFiltering.match.immutable);
      it('should handle multiple criteria', testFiltering.match.multiple);
      it('should normalize criteria strings', testFiltering.match.normalize);
    });

    describe('handMatchesCriteria()', () => {
      it('should evaluate hand with board cards', testFiltering.handMatchesCriteria.evaluate);
      it('should check evaluation against criteria', testFiltering.handMatchesCriteria.check);
      it('should return true if hand matches any criteria', testFiltering.handMatchesCriteria.match);
      it('should return false if hand matches no criteria', testFiltering.handMatchesCriteria.noMatch);
    });

    describe('evaluateHandWithBoard()', () => {
      it('should combine hand and board cards', testFiltering.evaluateHandWithBoard.combine);
      it('should call poker-extval evaluateHand', testFiltering.evaluateHandWithBoard.callExtval);
      it('should return evaluation object', testFiltering.evaluateHandWithBoard.returnsObject);
      it('should handle 5+ total cards', testFiltering.evaluateHandWithBoard.fivePlus);
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

    describe('normalizeCriteria()', () => {
      it('should map "Pair" to "isPair"', testFiltering.normalizeCriteria.pair);
      it('should map "Two Pair" to "isTwoPair"', testFiltering.normalizeCriteria.twoPair);
      it('should map "Three of a Kind" to "isThreeOfAKind"', testFiltering.normalizeCriteria.threeKind);
      it('should handle direct property names', testFiltering.normalizeCriteria.direct);
      it('should return normalized criteria array', testFiltering.normalizeCriteria.returnsArray);
    });

    describe('Error Handling', () => {
      it('should throw error for missing board cards in match()', testFiltering.errors.noBoard);
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
      it('should support multiple match() calls', testIntegration.chaining.multipleMatch);
      it('should support exclude() and match() together', testIntegration.chaining.excludeAndMatch);
      it('should support query methods after filtering', testIntegration.chaining.queryAfter);
    });

    describe('Immutability', () => {
      it('should not modify original range after exclude()', testIntegration.immutability.exclude);
      it('should not modify original range after match()', testIntegration.immutability.match);
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



