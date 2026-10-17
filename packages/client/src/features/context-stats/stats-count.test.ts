import { afterEach, expect, test } from 'vitest'
import { MOTION_ATTR, MOTION_FULL, MOTION_REDUCED } from '../../constants'
import { createStatsCount } from './stats-count'
import type { StatsReading } from './stats-count'

/**
 * The count between two readings: a reading with nothing before it is written
 * as it is, a later one is chased from the value on show, a reading that lands
 * mid-count becomes the new destination, and the reduced-motion choice writes
 * the reading where it stands.
 */

/** One reading at `turns` turns and `tokens` written back, to watch the figures move. */
function reading(turns: number, tokens: number): StatsReading {
  return {
    stats: { turns, steps: turns, llmMs: 0, toolMs: 0, ttftMs: 0, ttftSteps: 0, decodeMs: 0, decodeTokens: 0 },
    usage: { uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: tokens },
  }
}

/** Wait for the frames a count needs. */
const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

afterEach(() => {
  document.body.removeAttribute(MOTION_ATTR)
})

test('a reading with no figure before it is written as it is', () => {
  document.body.setAttribute(MOTION_ATTR, MOTION_FULL)
  const seen: StatsReading[] = []
  const count = createStatsCount((value) => seen.push(value))
  count.to(reading(4, 100))
  expect(seen).toHaveLength(1)
  expect(seen[0].stats?.turns).toBe(4)
  count.stop()
})

test('a new reading is counted to: part way there the figures stand between the two', async () => {
  document.body.setAttribute(MOTION_ATTR, MOTION_FULL)
  const written: StatsReading[] = []
  const count = createStatsCount((value) => written.push(value))
  count.to(reading(2, 100))
  count.to(reading(20, 1_000))
  await settle(70)
  const middle = count.current()
  expect(middle.stats?.turns).toBeGreaterThan(2)
  expect(middle.stats?.turns).toBeLessThan(20)
  expect(middle.usage?.outputTokens).toBeGreaterThan(100)
  expect(middle.usage?.outputTokens).toBeLessThan(1_000)
  await settle(900)
  expect(count.current().stats?.turns).toBe(20)
  expect(count.current().usage?.outputTokens).toBe(1_000)
  // A frame at a time, not one step from the old reading to the new one.
  expect(written.length).toBeGreaterThan(3)
  count.stop()
})

test('a reading that lands mid-count becomes the new destination', async () => {
  document.body.setAttribute(MOTION_ATTR, MOTION_FULL)
  const count = createStatsCount(() => {})
  count.to(reading(2, 100))
  count.to(reading(20, 1_000))
  await settle(70)
  count.to(reading(30, 2_000))
  await settle(900)
  expect(count.current().stats?.turns).toBe(30)
  expect(count.current().usage?.outputTokens).toBe(2_000)
  count.stop()
})

test('the reduced-motion choice writes a reading where it stands', () => {
  document.body.setAttribute(MOTION_ATTR, MOTION_REDUCED)
  const count = createStatsCount(() => {})
  count.to(reading(2, 100))
  count.to(reading(20, 1_000))
  expect(count.current().stats?.turns).toBe(20)
  expect(count.current().usage?.outputTokens).toBe(1_000)
  count.stop()
})

test('a reading is kept as its own copy: the host moving its own object does not move the count', () => {
  document.body.setAttribute(MOTION_ATTR, MOTION_FULL)
  const host = reading(2, 100)
  const count = createStatsCount(() => {})
  count.to(host)
  host.stats!.turns = 9
  expect(count.current().stats?.turns).toBe(2)
  expect(count.goal()?.stats?.turns).toBe(2)
  count.stop()
})
