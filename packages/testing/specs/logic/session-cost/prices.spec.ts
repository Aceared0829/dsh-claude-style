/**
 * What one settlement costs: the bucket arithmetic, the tier the clock picks,
 * the route the snapshot resolves, and the fold that turns a session's
 * settlements into one figure.
 *
 * @capability session-cost
 * @features context-stats
 * @risk A session's cost is billed at the wrong tier or the wrong model, or a retry is priced twice, so the figure beside the tokens disagrees with the official bill.
 */
import { expect, test } from 'vitest'
import { costMicro, formatMoneyMicro, isPeak, priceFor, priceTierAt } from '@dsh-claude-style/contracts/prices'
import type { PriceDocument, PriceSchedule } from '@dsh-claude-style/contracts/prices'

const schedule: PriceSchedule = {
  timeZone: 'Asia/Shanghai',
  peakDays: [1, 2, 3, 4, 5],
  peakWindows: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }],
  holidays: ['2026-10-01'],
  holidayZone: 'Asia/Shanghai',
}

const document: PriceDocument = {
  schemaVersion: 1,
  updatedAt: '2026-10-20',
  schedule,
  models: {
    'deepseek-flash': {
      CNY: {
        offPeak: { cacheHit: 0.02, cacheMiss: 1, output: 4 },
        peak: { cacheHit: 0.04, cacheMiss: 2, output: 8 },
      },
      USD: {
        offPeak: { cacheHit: 0.003, cacheMiss: 0.15, output: 0.6 },
        peak: { cacheHit: 0.006, cacheMiss: 0.3, output: 1.2 },
      },
    },
  },
  aliases: { 'deepseek-v4-flash': 'deepseek-flash', 'k3-256k': 'kimi-k3' },
  catalog: {
    'kimi-k3': '3 3 15',
    'gemini-3.8-flash': '0.75 0.75 3.75',
    'plan-only': '0 0 0',
  },
  usdToCny: 7.2,
}

test('the clock reads Beijing weekdays, windows and holidays', () => {
  // Monday 10:00 Beijing.
  expect(isPeak(Date.parse('2026-10-19T02:00:00Z'), schedule)).toBe(true)
  // Monday 13:00 Beijing, between the two windows.
  expect(isPeak(Date.parse('2026-10-19T05:00:00Z'), schedule)).toBe(false)
  // Saturday 10:00 Beijing.
  expect(isPeak(Date.parse('2026-10-17T02:00:00Z'), schedule)).toBe(false)
  // Thursday 10:00 Beijing, a listed holiday.
  expect(isPeak(Date.parse('2026-10-01T02:00:00Z'), schedule)).toBe(false)
})

test('a UTC clock reads the holiday list on the calendar it names', () => {
  // The shipped snapshot copies the catalog's clock: windows in UTC, holidays
  // on the Beijing calendar. The holiday must still match at 10:00 Beijing.
  const utc: PriceSchedule = {
    timeZone: 'UTC',
    peakDays: [1, 2, 3, 4, 5],
    peakWindows: [{ start: '01:00', end: '04:00' }, { start: '06:00', end: '10:00' }],
    holidays: ['2026-10-01'],
    holidayZone: 'Asia/Shanghai',
  }
  expect(isPeak(Date.parse('2026-09-30T02:00:00Z'), utc)).toBe(true)
  expect(isPeak(Date.parse('2026-10-01T02:00:00Z'), utc)).toBe(false)
})

test('a price is the sum of the buckets against their own rates', () => {
  const offPeak = priceTierAt(document.models['deepseek-flash'].CNY, Date.parse('2026-10-17T02:00:00Z'), schedule)
  expect(costMicro({ input: 1_000_000, output: 1_000_000, cacheRead: 0, cacheWrite: 0 }, offPeak)).toBe(5_000_000)
  const peak = priceTierAt(document.models['deepseek-flash'].CNY, Date.parse('2026-10-19T02:00:00Z'), schedule)
  expect(costMicro({ input: 1_000_000, output: 1_000_000, cacheRead: 0, cacheWrite: 0 }, peak)).toBe(10_000_000)
  // Cache writes follow the hit rate; reasoning tokens are already inside output.
  expect(costMicro({ input: 0, output: 0, cacheRead: 0, cacheWrite: 1_000_000 }, peak)).toBe(40_000)
})

test('a route is resolved through its aliases and a provider prefix', () => {
  expect(priceFor(document, 'deepseek-v4-flash', 'CNY')?.peak.output).toBe(8)
  expect(priceFor(document, 'deepseek-official/deepseek-flash', 'USD')?.offPeak.cacheMiss).toBe(0.15)
  expect(priceFor(document, 'unknown-model', 'CNY')).toBeUndefined()
})

test('a model the official table does not carry is priced from the catalogue', () => {
  // The picker's own id for Kimi K3, aliased to the catalogue's id.
  expect(priceFor(document, 'k3-256k', 'USD')?.offPeak.output).toBe(15)
  expect(priceFor(document, 'k3-256k', 'CNY')?.offPeak.output).toBe(108)
  // A variant suffix falls back to the base id the catalogue lists.
  expect(priceFor(document, 'gemini-3.8-flash-high', 'USD')?.offPeak.cacheMiss).toBe(0.75)
  // A plan listing (every number zero) is no price at all.
  expect(priceFor(document, 'plan-only', 'USD')).toBeUndefined()
})

test('the figure keeps four decimals and its currency symbol', () => {
  expect(formatMoneyMicro(200, 'USD')).toBe('$0.0002')
  expect(formatMoneyMicro(1500, 'CNY')).toBe('¥0.0015')
  expect(formatMoneyMicro(0, 'CNY')).toBe('¥0.0000')
})
