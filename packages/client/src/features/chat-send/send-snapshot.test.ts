import { expect, test } from 'vitest'
import { chatSendOpaque } from './send-snapshot'

test('a translucent fill is written as the colour the screen paints', () => {
  // The host's own light user bubble over its canvas, so the stand-in's plate
  // matches what the row shows.
  expect(chatSendOpaque('rgba(0, 0, 0, 0.08)', 'rgb(252, 252, 251)')).toBe('rgb(232, 232, 231)')
  // An opaque fill is already the screen's colour and is left byte for byte.
  expect(chatSendOpaque('rgb(234, 240, 254)', 'rgb(251, 252, 255)')).toBe('rgb(234, 240, 254)')
  expect(chatSendOpaque('rgba(234, 240, 254, 1)', 'rgb(251, 252, 255)')).toBe('rgba(234, 240, 254, 1)')
})

test('an unreadable colour or backdrop leaves the fill alone', () => {
  // `color-mix()` and system keywords are not parsed here, and a fill nobody
  // can read is better left as the page wrote it than guessed at.
  expect(chatSendOpaque('color-mix(in srgb, black 8%, transparent)', 'rgb(252, 252, 251)')).toBe('color-mix(in srgb, black 8%, transparent)')
  expect(chatSendOpaque('rgba(0, 0, 0, 0.08)', 'canvastext')).toBe('rgba(0, 0, 0, 0.08)')
  expect(chatSendOpaque('rgba(0, 0, 0, 0.08)', 'rgba(0, 0, 0, 0)')).toBe('rgba(0, 0, 0, 0.08)')
})
