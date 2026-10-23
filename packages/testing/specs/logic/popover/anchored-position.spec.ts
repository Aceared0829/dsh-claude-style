/**
 * Where a card that opens over its trigger stands: above the trigger while it
 * fits there, below it while it fits there instead, and against the window's
 * edge on the roomier side when it fits neither way.
 *
 * @capability popover
 * @features shared
 * @risk A card opened from a row near the window's bottom that is a little too tall for the room above it flips below the row, is pinned to the window's bottom edge and covers the row it opened from.
 */
import { expect, test } from 'vitest'
import { resolveAnchoredPosition } from '@dsh-claude-style/client/pure'

const viewport = { width: 1000, height: 640 }
const row = (top: number, height = 32) => new DOMRect(20, top, 200, height)

test('a card that fits above its trigger opens there, a gap over it', () => {
  expect(resolveAnchoredPosition(row(400), 240, 300, { side: 'above-left', gap: 4, viewport })).toEqual({ x: 20, y: 96 })
  expect(resolveAnchoredPosition(row(400), 240, 300, { side: 'above', gap: 4, viewport })).toEqual({ x: 8, y: 96 })
})

test('a card with no room above but room below opens below its trigger', () => {
  expect(resolveAnchoredPosition(row(40), 240, 300, { side: 'above-left', gap: 4, viewport }).y).toBe(76)
})

test('a card that fits neither way stays on the roomier side, against the window\'s edge', () => {
  // A row near the window's bottom: the card is one pixel too tall for the room
  // above, and far too tall for the room below.
  const near = row(394)
  const { y } = resolveAnchoredPosition(near, 240, 383, { side: 'above-left', gap: 4, viewport })
  expect(y).toBe(8)
  expect(y + 383).toBeLessThanOrEqual(near.top)
  // A row near the window's top keeps the card below it, held to the bottom edge.
  expect(resolveAnchoredPosition(row(100), 240, 600, { side: 'above', gap: 4, viewport }).y).toBe(32)
})
