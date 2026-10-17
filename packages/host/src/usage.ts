/**
 * The usage aggregation service the `usage` route reads, and the pass that fills
 * it.
 *
 * The dashboard needs cross-session token totals bucketed by day, which no host
 * service publishes: the `tokenUsage` projection is per session and the session
 * list carries only that session's own totals. This module owns the pass and the
 * state; the four parts below own the sources and the shapes:
 *
 *   - `usage-ledger.ts` reads the cost-meter plugin's ledger, read-only, and
 *     declares the bucket shapes. Its days are the whole history the cost meter
 *     saw, every provider included.
 *   - `usage-fold.ts` finds the session logs and folds them, which is what covers
 *     the dates past the ledger's newest day.
 *   - `usage-record.ts` keeps each session's fold: the account that outlives the
 *     log, so a deleted session keeps its days.
 *   - `usage-summary.ts` merges the two accounts by date, and shapes the payload.
 *
 * The two accounts are combined, never added: both describe the same days, so a
 * day the ledger knows stays the ledger's and the fold answers only for the days
 * past its newest one. A ledger that answers is published before the fold starts,
 * so a ledger the cost meter stopped updating still shows its days at once.
 * `totals.sessions` can count a session twice when it spans a ledger day and a
 * folded one: the two sources name sessions in different shapes.
 *
 * A host that publishes cross-session usage totals, or keeps the usage of deleted
 * sessions, retires the matching path here.
 */
import { PACKAGE_NAME } from '@dsh-claude-style/contracts/package'
import { join, resolve } from 'node:path'
import type { DshContext } from '@dsh-claude-style/engine/node/dsh'
import { harnessPath } from '@dsh-claude-style/engine/node/harness-home'
import { readRecord, writeRecord } from './usage-record.js'
import type { RecordSession } from './usage-record.js'
import { readEvents } from '@dsh-claude-style/engine/node/session-events'
import { foldSession, listSessionLogs } from './usage-fold.js'
import type { SessionLog, UsageEvent } from './usage-fold.js'
import { readLedger } from './usage-ledger.js'
import type { DayBuckets } from './usage-ledger.js'
import { mergeLedgerFold, summarize } from './usage-summary.js'
import type { UsageSummary } from './usage-summary.js'

/** The `source` field of an answer that came from the cost meter's ledger. */
const LEDGER_SOURCE = 'cost-meter'
/** The `source` field of an answer our own fold over the session logs produced. */
const LOCAL_SOURCE = 'local'

/** The hour histogram of a merged day map: its days' histograms, slot by slot. */
function hoursOf(days: ReadonlyMap<string, DayBuckets>): number[] {
  const hours = new Array(24).fill(0) as number[]
  for (const buckets of days.values()) {
    if (buckets.hours === undefined) continue
    for (let hour = 0; hour < 24; hour += 1) hours[hour] += Number(buckets.hours[hour]) || 0
  }
  return hours
}

/**
 * Whether this pass's entries differ from the ones the document holds, which is
 * the whole reason to write it again: a session folded afresh, one the record did
 * not know, one it no longer holds, or one whose log went away since the document
 * was written, whose fingerprint goes with it.
 */
function recordChanged(stored: ReadonlyMap<string, RecordSession>, sessions: ReadonlyMap<string, RecordSession>, read: number): boolean {
  if (read > 0 || stored.size !== sessions.size) return true
  for (const [id, entry] of sessions) {
    const held = stored.get(id)
    if (held === undefined || held.days.size !== entry.days.size) return true
    if ((held.fingerprint !== undefined) !== (entry.fingerprint !== undefined)) return true
  }
  return false
}

/** The service's state: the last summary, whether more is coming, and why not. */
interface UsageState {
  value: UsageSummary | null
  computing: boolean
  error?: string
}

/**
 * Build the usage service.
 *
 * @param ctx - the host plugin context, used for its home path and the
 *   `sessionQuery` service.
 * @returns the service: `snapshot()` reads the current state, `refresh()`
 *   recomputes in the background.
 */
export function createUsage(ctx: DshContext) {
  // The harness home, resolved per read through the one shared accessor.
  const home = () => harnessPath(ctx)

  let state: UsageState | null = null
  let pending: Promise<UsageSummary | null> | null = null
  let disposed = false

  /** Fold every session whose log changed since the record was written. */
  async function computeLocal(logs: SessionLog[], ledgerDays: ReadonlyMap<string, DayBuckets> | null) {
    const record = readRecord(ctx)
    const sessions = new Map<string, RecordSession>()
    let read = 0
    let failed = 0
    for (const log of logs) {
      const stored = record.sessions.get(log.id)
      const fingerprint = stored?.fingerprint
      if (stored !== undefined && fingerprint !== undefined
        && fingerprint.size === log.size && fingerprint.mtimeMs === log.mtimeMs) {
        sessions.set(log.id, stored)
        continue
      }
      // Each changed log is read by id. That read resolves the session through
      // the host's listing-free observation, so a pass costs one `stat`
      // per log read and never walks the stored corpus.
      const events = await readEvents<UsageEvent>(ctx, PACKAGE_NAME, log.id, 'the usage roll-up')
      if (events === null) {
        // The reader refused (no `sessionQuery` service, or a log it cannot
        // parse). Leave the entry as it stands, so the next pass retries this log
        // instead of freezing an empty day map behind a fresh fingerprint.
        failed += 1
        if (stored !== undefined) sessions.set(log.id, stored)
        continue
      }
      sessions.set(log.id, { fingerprint: { size: log.size, mtimeMs: log.mtimeMs }, days: foldSession(events).days })
      read += 1
    }
    // A session whose log is gone keeps the days the record holds for it: they
    // are the only account of those days left, and no fold can bring them back.
    // An entry with no day goes: the log is gone, so nothing compares
    // against it and it holds nothing to keep.
    for (const [id, stored] of record.sessions) {
      if (!sessions.has(id) && stored.days.size > 0) sessions.set(id, { days: stored.days })
    }
    const recorded = record.writable && (record.mustWrite || recordChanged(record.sessions, sessions, read))
      ? writeRecord(ctx, sessions, new Set(logs.map((log) => log.id)))
      : sessions
    const merge = mergeLedgerFold(ledgerDays, recorded)
    // The source names what answered: with no ledger at all the fold is the
    // whole account, and saying `cost-meter+local` there would credit a plugin
    // that is not installed.
    const source = ledgerDays === null
      ? LOCAL_SOURCE
      : merge.folded ? `${LEDGER_SOURCE}+${LOCAL_SOURCE}` : LEDGER_SOURCE
    const summary = summarize(
      merge.days,
      merge.sessionIds.size,
      source,
      merge.days.size === 0 ? undefined : hoursOf(merge.days),
      { sessionIds: merge.sessionIds },
    )
    if (sessions.size === 0 && failed > 0) {
      return { ...summary, unavailable: true, reason: 'session-query-unavailable' }
    }
    return { ...summary, read, failed, sessions: logs.length }
  }

  /**
   * @param publish - receives an answer that is already worth serving while the
   *   rest of the pass is still running.
   */
  async function compute(publish: (partial: UsageSummary) => void): Promise<UsageSummary> {
    const root = resolve(join(home(), 'sessions'))
    const logs = listSessionLogs(root)
    const ledgerDays = readLedger(home())

    if (ledgerDays !== null && ledgerDays.size > 0) {
      // The ledger is the wider account: it saw every provider, so it answers
      // for the older days whether or not their logs are still stored. Hand its
      // own answer over before the fold runs, so a stale ledger shows the whole
      // history at once and the uncovered days land a moment later.
      const sessionIds = new Set<string>()
      for (const buckets of ledgerDays.values()) {
        for (const id of buckets.sessionIds ?? []) sessionIds.add(id)
      }
      publish({ ...summarize(ledgerDays, sessionIds.size, LEDGER_SOURCE), sessions: logs.length })
    }
    return await computeLocal(logs, ledgerDays) as UsageSummary
  }

  function refresh(): Promise<UsageSummary | null> {
    if (disposed) return Promise.resolve(null)
    if (pending !== null) return pending
    state = state === null ? { value: null, computing: true } : { ...state, computing: true }
    pending = compute((partial: UsageSummary) => {
      if (!disposed) state = { value: partial, computing: true }
    }).then(
      (value): UsageSummary | null => {
        pending = null
        if (disposed) return value
        state = { value, computing: false }
        return value
      },
      (error): UsageSummary | null => {
        pending = null
        if (!disposed) state = { value: state?.value ?? null, computing: false, error: String((error as { message?: string } | null)?.message ?? error) }
        return null
      },
    )
    return pending ?? Promise.resolve(null)
  }

  return {
    /** The current state: a value, a computing flag, and the last error if any. */
    snapshot() {
      return state === null
        ? { ok: true, value: null, computing: false }
        : { ok: true, value: state.value, computing: state.computing === true, error: state.error }
    },
    refresh,
    dispose() {
      disposed = true
    },
  }
}
