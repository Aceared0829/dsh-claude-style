/**
 * The price snapshot both halves read, and the arithmetic over it (D73).
 *
 * The document is maintained by `scripts/fetch-prices.mjs` and shipped beside
 * the bundle as `lib/prices.json`; the host half refreshes it from the
 * repository once a day. Values are the official list prices per million
 * tokens, in the two currencies DeepSeek publishes them in, and they are kept
 * apart per currency: the two official tables are not one table converted at a
 * rate, so one of them can never be derived from the other.
 *
 * `costMicro` prices one settlement. Its unit is 1e-6 of the chosen currency,
 * which makes a per-million-token price the per-token cost: `tokens × rate`
 * lands in micro units with no division, and the count can chase it without
 * losing the fourth decimal.
 */

/** The two currencies the snapshot carries, in the settings' order. */
export const CURRENCY_CNY = 'CNY'
export const CURRENCY_USD = 'USD'
export const CURRENCIES = [CURRENCY_CNY, CURRENCY_USD] as const
export type Currency = typeof CURRENCIES[number]

/** The symbol each currency writes before its amount. */
export const CURRENCY_SYMBOL: Record<Currency, string> = {
  [CURRENCY_CNY]: '¥',
  [CURRENCY_USD]: '$',
}

/** The document version this reader understands. */
export const PRICE_SCHEMA_VERSION = 1

/** One tier's three rates, per million tokens. Cache writes bill at the hit rate: the official page lists no write price. */
export interface PriceTier {
  cacheHit: number
  cacheMiss: number
  output: number
}

/** One model's two tiers. */
export interface ModelPrice {
  offPeak: PriceTier
  peak: PriceTier
}

/** One peak window, `HH:mm` in the schedule's own zone. */
export interface PriceWindow {
  start: string
  end: string
}

/**
 * The clock the tiers follow: weekdays and windows in one zone, with the
 * public holidays (in `holidayZone`, a date's own zone) fully off-peak.
 */
export interface PriceSchedule {
  timeZone: string
  peakDays: number[]
  peakWindows: PriceWindow[]
  holidays: string[]
  holidayZone: string
}

/** The price snapshot. */
export interface PriceDocument {
  schemaVersion: number
  /** The day the document was captured, `YYYY-MM-DD`. */
  updatedAt: string
  /** The instant of the capture. */
  capturedAt?: string
  source?: { zh?: string, en?: string }
  schedule: PriceSchedule
  /** Model id → currency → its two tiers. */
  models: Record<string, Record<Currency, ModelPrice>>
  /** Retired or provider-prefixed ids that bill as another model. */
  aliases: Record<string, string>
}

/** One usage sample's four disjoint buckets. */
export interface PriceUsage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

/** What a session's cost route answers, in both currencies. */
export interface SessionCostAnswer {
  cny: number
  usd: number
  /** Whether every settlement could be priced: a settlement with no route is left out. */
  partial: boolean
  /** The route the latest settlement named; a streaming estimate is priced at it. */
  model: string | null
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string) {
  let held = formatters.get(timeZone)
  if (held === undefined) {
    held = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    formatters.set(timeZone, held)
  }
  return held
}

/**
 * One instant read on a zone's own calendar: its weekday, its date and its
 * minutes since midnight, or null when the zone cannot be resolved.
 */
export function clockAt(atMs: number, timeZone: string): { weekday: number, date: string, minutes: number } | null {
  if (!Number.isFinite(atMs)) return null
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = formatter(timeZone).formatToParts(new Date(atMs))
  } catch {
    return null
  }
  const field = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  const weekday = WEEKDAYS.indexOf(field('weekday'))
  const year = Number(field('year'))
  const month = Number(field('month'))
  const day = Number(field('day'))
  const hour = Number(field('hour'))
  const minute = Number(field('minute'))
  if (weekday < 0 || !Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)
    || !Number.isFinite(hour) || !Number.isFinite(minute)) return null
  const pad = (value: number) => String(value).padStart(2, '0')
  return { weekday, date: `${year}-${pad(month)}-${pad(day)}`, minutes: hour * 60 + minute }
}

/** `HH:mm` in minutes, or NaN. */
function clockMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (match === null) return Number.NaN
  return Number(match[1]) * 60 + Number(match[2])
}

/**
 * Whether one instant bills at the peak tier: a listed weekday, an hour inside
 * one of the windows, and a date the holiday list does not name.
 *
 * A machine whose zone database lacks the schedule's zone judges every instant
 * off-peak, which is the lower of the two rates and keeps the figure honest.
 */
export function isPeak(atMs: number, schedule: PriceSchedule): boolean {
  const clock = clockAt(atMs, schedule.timeZone)
  if (clock === null || !schedule.peakDays.includes(clock.weekday)) return false
  if (schedule.holidays.includes(clock.date)) return false
  for (let i = 0; i < schedule.peakWindows.length; i++) {
    const window = schedule.peakWindows[i]
    const start = clockMinutes(window.start)
    const end = clockMinutes(window.end)
    if (clock.minutes >= start && clock.minutes < end) return true
  }
  return false
}

/** The model id the document prices, following the aliases the snapshot carries. */
export function priceModelId(document: PriceDocument, modelId: string): string | null {
  const raw = modelId.trim().toLowerCase()
  if (raw === '') return null
  const bare = raw.includes('/') ? raw.slice(raw.lastIndexOf('/') + 1) : raw
  if (Object.hasOwn(document.models, bare)) return bare
  const alias = document.aliases[bare]
  return alias !== undefined && Object.hasOwn(document.models, alias) ? alias : null
}

/** One model's two tiers for one currency, or undefined when the document does not price it. */
export function priceFor(document: PriceDocument, modelId: string, currency: Currency): ModelPrice | undefined {
  const id = priceModelId(document, modelId)
  return id === null ? undefined : document.models[id]?.[currency]
}

/** The tier in force at one instant. */
export function priceTierAt(price: ModelPrice, atMs: number, schedule: PriceSchedule): PriceTier {
  return isPeak(atMs, schedule) ? price.peak : price.offPeak
}

/**
 * One settlement's cost in micro units: every bucket against its rate, with
 * cache writes at the hit rate and reasoning tokens already inside `output`.
 */
export function costMicro(usage: PriceUsage, tier: PriceTier): number {
  const count = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0)
  const cost = count(usage.input) * tier.cacheMiss
    + count(usage.cacheRead) * tier.cacheHit
    + count(usage.cacheWrite) * tier.cacheHit
    + count(usage.output) * tier.output
  return Number.isFinite(cost) && cost > 0 ? cost : 0
}

/** One amount in micro units, as the four-decimal figure the line carries. */
export function formatMoneyMicro(micro: number, currency: Currency): string {
  const amount = Number.isFinite(micro) && micro > 0 ? micro / 1_000_000 : 0
  return `${CURRENCY_SYMBOL[currency]}${amount.toFixed(4)}`
}
