/**
 * The home page's ripple field: a click starts waves that travel outward and
 * slow with distance, die out and leave the field flat, and a late frame
 * advances them by a capped step so a page shown again does not replay its
 * absence.
 *
 * @capability home-ripple
 * @features home-ripple
 * @risk A click on the home page leaves the background rippling forever, burns frames after the waves have died, or bursts into a flash of motion when the reader returns to a hidden tab.
 */
import { expect, test } from 'vitest'
import fc from 'fast-check'
import { createWaveField } from '@dsh-claude-style/client/pure'

const COLUMNS = 160
const ROWS = 70
const CENTRE_COLUMN = 80
const CENTRE_ROW = 35

/** How many cells to the right of the centre the farthest cell above `level` lies on the centre row. */
function reach(height: Float32Array, level: number) {
  let far = 0
  for (let column = CENTRE_COLUMN + 1; column < COLUMNS; column++) {
    if (Math.abs(height[CENTRE_ROW * COLUMNS + column]!) > level) far = column - CENTRE_COLUMN
  }
  return far
}

test('a field nobody has clicked stays flat and at rest', () => {
  const waves = createWaveField(COLUMNS, ROWS)
  waves.advance(0.05)
  expect(waves.active()).toBe(false)
  expect(waves.height.every(value => value === 0)).toBe(true)
})

test('a click starts waves that travel outward, slowing with distance', () => {
  const waves = createWaveField(COLUMNS, ROWS)
  waves.disturb(CENTRE_COLUMN, CENTRE_ROW)
  expect(waves.active()).toBe(true)
  for (let frame = 0; frame < 15; frame++) waves.advance(1 / 60)
  const early = reach(waves.height, 0.05)
  for (let frame = 0; frame < 15; frame++) waves.advance(1 / 60)
  const late = reach(waves.height, 0.05)
  // A quarter second carries the first ring past a hundred pixels of the page (seven-pixel cells).
  expect(early).toBeGreaterThan(14)
  expect(late).toBeGreaterThan(early)
  // The second quarter second covers less ground than the first: the speed fell with the distance.
  expect(late - early).toBeLessThan(early)
  expect(waves.height.every(Number.isFinite)).toBe(true)
})

test('the waves die out and the field comes to rest', () => {
  const waves = createWaveField(COLUMNS, ROWS)
  waves.disturb(CENTRE_COLUMN, CENTRE_ROW)
  for (let frame = 0; frame < 60 * 8; frame++) waves.advance(1 / 60)
  expect(waves.active()).toBe(false)
  expect(waves.height.every(value => value === 0)).toBe(true)
})

test('a late frame advances the waves by at most the cap, so a hidden page does not replay its absence', () => {
  const waves = createWaveField(COLUMNS, ROWS)
  waves.disturb(CENTRE_COLUMN, CENTRE_ROW)
  waves.advance(60)
  // Sixty seconds replayed would have brought the field to rest; a capped advance leaves the waves moving.
  expect(waves.active()).toBe(true)
})

test('clicks anywhere on the field, at any frame rate, keep every height finite and bounded', () => {
  const click = fc.tuple(fc.integer({ min: 0, max: COLUMNS - 1 }), fc.integer({ min: 0, max: ROWS - 1 }))
  fc.assert(fc.property(fc.array(click, { minLength: 1, maxLength: 4 }), fc.constantFrom(1 / 30, 1 / 60, 1 / 144), (clicks, frame) => {
    const waves = createWaveField(COLUMNS, ROWS)
    for (const [column, row] of clicks) waves.disturb(column, row)
    for (let elapsed = 0; elapsed < 2; elapsed += frame) waves.advance(frame)
    expect(waves.height.every(value => Number.isFinite(value) && Math.abs(value) < 10)).toBe(true)
  }), { numRuns: 12 })
})
