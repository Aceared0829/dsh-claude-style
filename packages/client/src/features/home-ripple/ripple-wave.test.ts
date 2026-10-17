import { expect, test } from 'vitest'
import { RIPPLE } from './ripple-params'
import { createWaveField } from './ripple-wave'

const COLUMNS = 160
const ROWS = 70
const CENTRE_COLUMN = 80
const CENTRE_ROW = 35

/** The farthest cell along the centre row, to the right, whose height exceeds `level`. */
function reach(height: Float32Array, level: number) {
  let far = 0
  for (let column = CENTRE_COLUMN + 1; column < COLUMNS; column++) {
    if (Math.abs(height[CENTRE_ROW * COLUMNS + column]!) > level) far = (column - CENTRE_COLUMN) * RIPPLE.cellWidth
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
  expect(early).toBeGreaterThan(100)
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
