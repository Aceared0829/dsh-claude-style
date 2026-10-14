import { expect, test } from 'vitest'
import { BRAND_CLAUDE, BRAND_DEEPSEEK } from '../constants'
import { waitingWord } from './turn-activity'

test('the one word a wait stands on is the brand\'s own, whichever word the host would have said', () => {
  // Claude: the skin's own word, so a wait does not change places when its
  // state stops being readable.
  expect(waitingWord(BRAND_CLAUDE, 'Deep diving')).toBe('Thinking…')
  expect(waitingWord(BRAND_CLAUDE, '深度求索中')).toBe('Thinking…')
  // DeepSeek: the host's own word, in the host's own language.
  expect(waitingWord(BRAND_DEEPSEEK, 'Deep diving')).toBe('Deep diving')
  expect(waitingWord(BRAND_DEEPSEEK, '深度求索中')).toBe('深度求索中')
})
