import type { PartsVocabulary } from './parts'

/**
 * The vocabulary the parts tests mark under: the engine's own tests hand their
 * own attributes over, the way a skin hands its own (D73).
 */
export const PART_ATTR = 'data-test-part'
export const HOLDS_ATTR = 'data-test-holds'

export const TEST_VOCABULARY: PartsVocabulary = {
  part: PART_ATTR,
  holds: HOLDS_ATTR,
  regions: { account: 'data-test-account-menu', hero: 'data-test-hero-menu' },
}
