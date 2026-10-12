import { expect, test } from 'vitest'
import { accentInk, cssString } from './brand'

test('the brand name becomes a CSS string that keeps quotes and backslashes and reads a line break as a space', () => {
  expect(cssString('Acme')).toBe('"Acme"')
  expect(cssString('Say "hi"')).toBe('"Say \\"hi\\""')
  expect(cssString('a\\b')).toBe('"a\\\\b"')
  expect(cssString('two\nlines')).toBe('"two lines"')
})

test('the ink on an accent fill is whichever canvas colour reads better on it', () => {
  expect(accentInk('#d97757')).toBe('#141413')
  expect(accentInk('#1a7f5a')).toBe('#faf9f5')
  expect(accentInk('#f2c94c')).toBe('#141413')
  expect(accentInk('#2b2b80')).toBe('#faf9f5')
})
