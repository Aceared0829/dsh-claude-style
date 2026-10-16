/**
 * The usage record: this plugin's own account of usage, kept at
 * `$DSH_HOME/dsh-claude-style/usage.json`.
 *
 * One entry per session: the fingerprint of the log it was folded from, while
 * that log exists, and the days it settled on. An entry whose log is gone stays
 * as it stands — the days it holds are then the only account of them left, and
 * folding cannot bring them back — so deleting a conversation no longer takes
 * its tokens off the panel. That is also why the file sits in the plugin's own
 * directory rather than under `cache/`, which anything may clear (D53).
 *
 * A stored day carries its tokens per route: the day's own buckets are the sum
 * of its routes, a settlement that named no model rides under the empty key, and
 * the hour histogram keeps its non-zero slots alone. The session's own histogram
 * is not stored: the summary reads the days'.
 *
 * The file is written when the pass changed something, and a version this build
 * does not write is left as it stands rather than overwritten from the logs that
 * happen to remain. The one document before this one — the fold cache at
 * `cache/dsh-claude-style/usage.json` — is migrated whenever this file is
 * absent, so the days of sessions deleted before it are carried across.
 */
import type { DshContext } from './dsh.js'
import { cachePath, readJsonDocument, writeJsonDocument } from './cache-file.js'
import { pluginPath } from './harness-home.js'
import { BUCKET_KEYS, addBuckets, emptyBuckets } from './usage-ledger.js'
import type { Buckets, DayBuckets } from './usage-ledger.js'

/** The version of the document this build writes. */
const RECORD_VERSION = 1
/** The version of the fold cache this document replaced, read once to migrate it. */
const LEGACY_CACHE_VERSION = 4
/** The route of the settlements that named no model, which count toward their day alone. */
const NO_ROUTE = ''
/**
 * A route cell's fields in the order it carries them. Fixed rather than written
 * out by name: a cell repeats the same five names for every route of every day,
 * and it is the session id and the model names that have to stay readable.
 */
const CELL_KEYS: (keyof Buckets)[] = [...BUCKET_KEYS, 'calls']

/** One session in the record: the log it was folded from, and the days it settled on. */
export interface RecordSession {
  /** Absent for a session whose log is gone: it is never folded again, so there is nothing to compare. */
  fingerprint?: { size: number, mtimeMs: number }
  days: Map<string, DayBuckets>
}

/** What reading the document produced: the entries it holds, and what may be written back. */
export interface RecordRead {
  sessions: Map<string, RecordSession>
  /** Whether the pass must write even when nothing changed: the file is absent, unreadable, or an older shape. */
  mustWrite: boolean
  /** Whether the file may be written at all: a version this build does not read is left as it stands. */
  writable: boolean
}

/** The buckets one stored route cell carries, or null when the value is not a cell. */
function bucketsFromCell(cell: unknown): Buckets | null {
  if (!Array.isArray(cell)) return null
  const buckets = emptyBuckets()
  for (let at = 0; at < CELL_KEYS.length; at += 1) {
    const value = Number(cell[at])
    if (Number.isFinite(value)) buckets[CELL_KEYS[at]] = value
  }
  return buckets
}

/** One route cell as stored: the four buckets and the settled calls, in `CELL_KEYS` order. */
function cellFromBuckets(buckets: Buckets): number[] {
  return CELL_KEYS.map((key) => buckets[key])
}

/** A stored day's hour histogram, of which only the settled hours are written. */
function hoursFromSlots(raw: unknown): number[] | null {
  if (raw === null || typeof raw !== 'object') return null
  const hours = new Array(24).fill(0) as number[]
  let settled = false
  for (const [slot, count] of Object.entries(raw as Record<string, unknown>)) {
    const hour = Number(slot)
    const value = Number(count)
    // A slot that is not an hour of the day is not one of ours and is left out.
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isFinite(value) || value === 0) continue
    hours[hour] += value
    settled = true
  }
  return settled ? hours : null
}

/** An hour histogram as stored, or null when the day holds no settled hour. */
function slotsFromHours(hours: number[] | undefined): Record<string, number> | null {
  if (!Array.isArray(hours)) return null
  const slots: Record<string, number> = {}
  let settled = false
  for (let hour = 0; hour < 24; hour += 1) {
    const count = Number(hours[hour]) || 0
    if (count === 0) continue
    slots[String(hour)] = count
    settled = true
  }
  return settled ? slots : null
}

/** Whether a day carries anything at all: a day of nothing belongs to no session. */
function isEmptyDay(buckets: DayBuckets, hours: number[] | null): boolean {
  if (hours !== null) return false
  return BUCKET_KEYS.every((key) => buckets[key] === 0) && buckets.calls === 0
}

/** One stored day's value read as the shape the caller wants, or null when the value is not a day of ours. */
function storedDay<T>(raw: unknown): (T & Record<string, unknown>) | null {
  return raw !== null && typeof raw === 'object' ? raw as T & Record<string, unknown> : null
}

/** The days one stored value carries: its route cells summed into the day, its hours as 24 slots. */
function daysFromStored(raw: unknown): Map<string, DayBuckets> {
  const days = new Map<string, DayBuckets>()
  if (raw === null || typeof raw !== 'object') return days
  for (const [day, value] of Object.entries(raw as Record<string, unknown>)) {
    const stored = storedDay<{ m?: unknown, h?: unknown }>(value)
    if (stored === null) continue
    const buckets: DayBuckets = emptyBuckets()
    const models = new Map<string, Buckets>()
    if (stored.m !== null && typeof stored.m === 'object') {
      for (const [route, cell] of Object.entries(stored.m as Record<string, unknown>)) {
        const counts = bucketsFromCell(cell)
        if (counts === null) continue
        // Every route counts toward its day; the one that named no model is the
        // day's own remainder and belongs in no model's row.
        addBuckets(buckets, counts, 1)
        if (route !== NO_ROUTE) models.set(route, counts)
      }
    }
    const hours = hoursFromSlots(stored.h)
    if (isEmptyDay(buckets, hours)) continue
    if (models.size > 0) buckets.models = models
    if (hours !== null) buckets.hours = hours
    days.set(day, buckets)
  }
  return days
}

/** One day as stored: the route cells whose sum is the day, and its settled hours. */
function dayToStored(buckets: DayBuckets): Record<string, unknown> {
  // The day's own buckets are the sum of its routes, so only the routes are
  // written: what no model claimed rides under the empty key, which is what
  // keeps the sum the day's own figure.
  const rest = emptyBuckets()
  addBuckets(rest, buckets, 1)
  const routes: Record<string, number[]> = {}
  if (buckets.models !== undefined) {
    for (const [model, cell] of buckets.models) {
      routes[model] = cellFromBuckets(cell)
      addBuckets(rest, cell, -1)
    }
  }
  if (CELL_KEYS.some((key) => rest[key] !== 0)) routes[NO_ROUTE] = cellFromBuckets(rest)
  const stored: Record<string, unknown> = { m: routes }
  const hours = slotsFromHours(buckets.hours)
  if (hours !== null) stored.h = hours
  return stored
}

/** One session as stored: the fingerprint of its log while that log exists, and its days. */
function sessionToStored(entry: RecordSession): Record<string, unknown> {
  const stored: Record<string, unknown> = {}
  if (entry.fingerprint !== undefined) {
    stored.size = entry.fingerprint.size
    stored.mtimeMs = entry.fingerprint.mtimeMs
  }
  if (entry.days.size === 0) return stored
  const days: Record<string, unknown> = {}
  for (const [day, buckets] of entry.days) days[day] = dayToStored(buckets)
  stored.days = days
  return stored
}

/** One session out of the stored value, or null when it carries no day and no fingerprint to skip a log with. */
function sessionFromStored(value: unknown): RecordSession | null {
  if (value === null || typeof value !== 'object') return null
  const stored = value as { size?: unknown, mtimeMs?: unknown, days?: unknown }
  const days = daysFromStored(stored.days)
  if (!Number.isFinite(stored.size) || !Number.isFinite(stored.mtimeMs)) {
    return days.size === 0 ? null : { days }
  }
  return { fingerprint: { size: Number(stored.size), mtimeMs: Number(stored.mtimeMs) }, days }
}

/** A legacy day's hour histogram, written out as 24 slots. */
function hoursFromArray(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length !== 24) return null
  const hours = new Array(24).fill(0) as number[]
  let settled = false
  for (let hour = 0; hour < 24; hour += 1) {
    const count = Number(raw[hour]) || 0
    hours[hour] = count
    if (count !== 0) settled = true
  }
  return settled ? hours : null
}

/** The days of one legacy entry: the day's own buckets and models, and its hour histogram. */
function legacyDays(raw: unknown): Map<string, DayBuckets> {
  const days = new Map<string, DayBuckets>()
  if (raw === null || typeof raw !== 'object') return days
  for (const [day, value] of Object.entries(raw as Record<string, unknown>)) {
    const stored = storedDay<Partial<Buckets> & { hours?: unknown, models?: unknown }>(value)
    if (stored === null) continue
    const buckets: DayBuckets = emptyBuckets()
    addBuckets(buckets, stored, 1)
    if (stored.models !== null && typeof stored.models === 'object') {
      const models = new Map<string, Buckets>()
      for (const [model, cell] of Object.entries(stored.models as Record<string, unknown>)) {
        if (cell === null || typeof cell !== 'object') continue
        const counts = emptyBuckets()
        addBuckets(counts, cell as Partial<Buckets>, 1)
        models.set(model, counts)
      }
      if (models.size > 0) buckets.models = models
    }
    const hours = hoursFromArray(stored.hours)
    if (isEmptyDay(buckets, hours)) continue
    if (hours !== null) buckets.hours = hours
    days.set(day, buckets)
  }
  return days
}

/**
 * The entries of the fold cache this record replaced, which the record is
 * migrated from when it does not exist yet.
 *
 * The cache is read at its own path and its own version: it is no longer written
 * (the record covers the same sessions and more), and a home that never ran the
 * earlier build simply has none.
 */
function legacyRecord(ctx: DshContext): Map<string, RecordSession> {
  const sessions = new Map<string, RecordSession>()
  const parsed = readJsonDocument(ctx, cachePath(ctx, 'usage.json'), 'usage cache')
  if (parsed === null || typeof parsed !== 'object') return sessions
  const document = parsed as { version?: unknown, sessions?: unknown }
  if (document.version !== LEGACY_CACHE_VERSION) return sessions
  if (document.sessions === null || typeof document.sessions !== 'object') return sessions
  for (const [id, value] of Object.entries(document.sessions as Record<string, unknown>)) {
    if (value === null || typeof value !== 'object') continue
    const entry = value as { size?: unknown, mtimeMs?: unknown, days?: unknown }
    if (!Number.isFinite(entry.size) || !Number.isFinite(entry.mtimeMs)) continue
    const days = legacyDays(entry.days)
    if (days.size === 0) continue
    sessions.set(id, { fingerprint: { size: Number(entry.size), mtimeMs: Number(entry.mtimeMs) }, days })
  }
  return sessions
}

/**
 * The record's entries, and what this pass may write back.
 *
 * An absent, unreadable or older document is read as far as its own shape allows
 * and written out again whatever the pass found. A version this build does not
 * write is reported once and left as it stands: it was written by a build that
 * knew more, and overwriting it would drop the days of the sessions deleted in
 * between, which nothing can fold again (docs/decisions D53, D12).
 *
 * @param ctx - host plugin context, for the record's path and the warning a
 *   failure leaves.
 */
export function readRecord(ctx: DshContext): RecordRead {
  const parsed = readJsonDocument(ctx, pluginPath(ctx, 'usage.json'), 'usage record')
  if (parsed === null || typeof parsed !== 'object') {
    return { sessions: legacyRecord(ctx), mustWrite: true, writable: true }
  }
  const document = parsed as { version?: unknown, sessions?: unknown }
  if (document.version !== RECORD_VERSION) {
    ctx.logger?.warn?.(`dsh-claude-style: usage record version ${String(document.version)} is not one this build reads; it is left as it stands`)
    return { sessions: new Map(), mustWrite: false, writable: false }
  }
  const sessions = new Map<string, RecordSession>()
  if (document.sessions === null || typeof document.sessions !== 'object') return { sessions, mustWrite: false, writable: true }
  for (const [id, value] of Object.entries(document.sessions as Record<string, unknown>)) {
    const entry = sessionFromStored(value)
    if (entry !== null) sessions.set(id, entry)
  }
  return { sessions, mustWrite: false, writable: true }
}

/**
 * Write down the sessions this pass ended up with.
 *
 * @param ctx - host plugin context, for the record's path and the warning a
 *   failed write leaves.
 * @param sessions - each session's fingerprint and days, keyed by session id.
 */
export function writeRecord(ctx: DshContext, sessions: ReadonlyMap<string, RecordSession>) {
  const document: { version: number, computedAt: number, sessions: Record<string, unknown> } = {
    version: RECORD_VERSION,
    computedAt: Date.now(),
    sessions: {},
  }
  for (const [id, entry] of sessions) document.sessions[id] = sessionToStored(entry)
  writeJsonDocument(ctx, pluginPath(ctx, 'usage.json'), 'usage record', document)
}
