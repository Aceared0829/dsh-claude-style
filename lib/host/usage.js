// packages/host/src/usage.ts
import { join, resolve } from "node:path";
import { harnessPath } from "./harness-home.js";
import { readRecord, writeRecord } from "./usage-record.js";
import { readEvents } from "./session-events.js";
import { foldSession, listSessionLogs } from "./usage-fold.js";
import { readLedger } from "./usage-ledger.js";
import { mergeLedgerFold, summarize } from "./usage-summary.js";
var LEDGER_SOURCE = "cost-meter";
var LOCAL_SOURCE = "local";
function hoursOf(days) {
  const hours = new Array(24).fill(0);
  for (const buckets of days.values()) {
    if (buckets.hours === void 0) continue;
    for (let hour = 0; hour < 24; hour += 1) hours[hour] += Number(buckets.hours[hour]) || 0;
  }
  return hours;
}
function recordChanged(stored, sessions, read) {
  if (read > 0 || stored.size !== sessions.size) return true;
  for (const [id, entry] of sessions) {
    const held = stored.get(id);
    if (held === void 0 || held.days.size !== entry.days.size) return true;
    if (held.fingerprint !== void 0 !== (entry.fingerprint !== void 0)) return true;
  }
  return false;
}
function createUsage(ctx) {
  const home = () => harnessPath(ctx);
  let state = null;
  let pending = null;
  let disposed = false;
  async function computeLocal(logs, ledgerDays) {
    const record = readRecord(ctx);
    const sessions = /* @__PURE__ */ new Map();
    let read = 0;
    let failed = 0;
    for (const log of logs) {
      const stored = record.sessions.get(log.id);
      const fingerprint = stored?.fingerprint;
      if (stored !== void 0 && fingerprint !== void 0 && fingerprint.size === log.size && fingerprint.mtimeMs === log.mtimeMs) {
        sessions.set(log.id, stored);
        continue;
      }
      const events = await readEvents(ctx, log.id, "the usage roll-up");
      if (events === null) {
        failed += 1;
        if (stored !== void 0) sessions.set(log.id, stored);
        continue;
      }
      sessions.set(log.id, { fingerprint: { size: log.size, mtimeMs: log.mtimeMs }, days: foldSession(events).days });
      read += 1;
    }
    for (const [id, stored] of record.sessions) {
      if (!sessions.has(id) && stored.days.size > 0) sessions.set(id, { days: stored.days });
    }
    const recorded = record.writable && (record.mustWrite || recordChanged(record.sessions, sessions, read)) ? writeRecord(ctx, sessions, new Set(logs.map((log) => log.id))) : sessions;
    const merge = mergeLedgerFold(ledgerDays, recorded);
    const source = ledgerDays === null ? LOCAL_SOURCE : merge.folded ? `${LEDGER_SOURCE}+${LOCAL_SOURCE}` : LEDGER_SOURCE;
    const summary = summarize(
      merge.days,
      merge.sessionIds.size,
      source,
      merge.days.size === 0 ? void 0 : hoursOf(merge.days),
      { sessionIds: merge.sessionIds }
    );
    if (sessions.size === 0 && failed > 0) {
      return { ...summary, unavailable: true, reason: "session-query-unavailable" };
    }
    return { ...summary, read, failed, sessions: logs.length };
  }
  async function compute(publish) {
    const root = resolve(join(home(), "sessions"));
    const logs = listSessionLogs(root);
    const ledgerDays = readLedger(home());
    if (ledgerDays !== null && ledgerDays.size > 0) {
      const sessionIds = /* @__PURE__ */ new Set();
      for (const buckets of ledgerDays.values()) {
        for (const id of buckets.sessionIds ?? []) sessionIds.add(id);
      }
      publish({ ...summarize(ledgerDays, sessionIds.size, LEDGER_SOURCE), sessions: logs.length });
    }
    return await computeLocal(logs, ledgerDays);
  }
  function refresh() {
    if (disposed) return Promise.resolve(null);
    if (pending !== null) return pending;
    state = state === null ? { value: null, computing: true } : { ...state, computing: true };
    pending = compute((partial) => {
      if (!disposed) state = { value: partial, computing: true };
    }).then(
      (value) => {
        pending = null;
        if (disposed) return value;
        state = { value, computing: false };
        return value;
      },
      (error) => {
        pending = null;
        if (!disposed) state = { value: state?.value ?? null, computing: false, error: String(error?.message ?? error) };
        return null;
      }
    );
    return pending ?? Promise.resolve(null);
  }
  return {
    /** The current state: a value, a computing flag, and the last error if any. */
    snapshot() {
      return state === null ? { ok: true, value: null, computing: false } : { ok: true, value: state.value, computing: state.computing === true, error: state.error };
    },
    refresh,
    dispose() {
      disposed = true;
    }
  };
}
export {
  createUsage
};
