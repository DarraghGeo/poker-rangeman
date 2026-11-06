// Hand-strength criteria: the names filters accept ('Top Pair' or the flag 'isTopPair') and the flags they map to.

export const CRITERIA_MAPPING = {
  // Made Hands
  'Pair': 'isPair', 'Two Pair': 'isTwoPair', 'Three of a Kind': 'isThreeOfAKind',
  'Straight': 'isStraight', 'Flush': 'isFlush', 'Full House': 'isFullHouse',
  'Four of a Kind': 'isFourOfAKind', 'Straight Flush': 'isStraightFlush', 'Royal Flush': 'isRoyalFlush',
  'High Card': 'isHighCard',
  // Pair Categorization
  'Top Pair': 'isTopPair', 'Middle Pair': 'isMiddlePair', 'Bottom Pair': 'isBottomPair',
  'Overpair': 'isOverPair', 'Over Pair': 'isOverPair', 'Underpair': 'isUnderPair', 'Under Pair': 'isUnderPair',
  'Middling Pair': 'isMiddlingPair',
  // Two Pair Categorization
  'Top And Middle Pair': 'isTopAndMiddlePair', 'Top And Bottom Pair': 'isTopAndBottomPair', 'Middle And Bottom Pair': 'isMiddleAndBottomPair',
  // Three of a Kind Categorization
  'Top Three Of A Kind': 'isTopThreeOfAKind', 'Middle Three Of A Kind': 'isMiddleThreeOfAKind', 'Bottom Three Of A Kind': 'isBottomThreeOfAKind',
  // Draws
  'Flush Draw': 'isFlushDraw', 'Backdoor Flush Draw': 'isBackdoorFlushDraw',
  'Open Ended Straight Draw': 'isOpenEndedStraightDraw', 'Inside Straight Draw': 'isInsideStraightDraw',
  'Straight Draw': 'isStraightDraw', 'Combo Draw': 'isComboDraw',
  // Wheel Straight Support
  'Straight Wheel': 'isStraightWheel', 'Open Ended Straight Draw Wheel': 'isOpenEndedStraightDrawWheel',
  'Inside Straight Draw Wheel': 'isInsideStraightDrawWheel',
  // Hole cards against the board
  'Overcard': 'isOvercard', 'Two Overcards': 'isTwoOvercards',
  'Overcard And Middle Card': 'isOvercardAndMiddleCard', 'Overcard And Undercard': 'isOvercardAndUndercard',
  'Two Middle Cards': 'isTwoMiddleCards', 'Middle And Undercard': 'isMiddleAndUndercard',
  'Two Undercards': 'isTwoUndercards'
};

// Flag names accepted from earlier versions of this library
export const CRITERION_ALIASES = { isOverpair: 'isOverPair' };

// Map lookups avoid matching inherited Object properties (e.g. 'toString')
export const CRITERIA_LOOKUP = new Map([...Object.entries(CRITERIA_MAPPING), ...Object.entries(CRITERION_ALIASES)]);
export const VALID_CRITERIA = new Set(Object.values(CRITERIA_MAPPING));
export const MADE_HANDS = new Set([
  'isRoyalFlush', 'isStraightFlush', 'isFourOfAKind', 'isFullHouse', 'isFlush',
  'isStraight', 'isThreeOfAKind', 'isTwoPair', 'isPair', 'isHighCard'
]);

/** A criterion name or flag to its flag ('Top Pair' -> 'isTopPair'), or the input unchanged. */
export const criterionFlag = criterion => CRITERIA_LOOKUP.get(criterion) || criterion;
