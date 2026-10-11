/**
 * Reading raw session logs through the host's own reader.
 *
 * Both host-half readers (the usage roll-up and the content search) go through
 * this one call, and which `sessionQuery` entry point it uses is a performance
 * decision as much as a correctness one:
 *
 *   - `readSession` resolves one session by id, but `SessionCorpus.load` finds
 *     that id by listing the WHOLE stored corpus first, and a listing opens and
 *     decompresses every stored session's header. A fold that reads every log
 *     this way pays that walk once per session, which makes a pass over a whole
 *     corpus quadratic — what the usage roll-up's fold did (docs/decisions D53).
 *   - `observeSession` resolves one session from `persistence.stat(id)` alone:
 *     no corpus listing at all (its own documentation calls this "without a
 *     persistence listing preflight"), and it caches the restored Session by the
 *     `stat` revision, so a session whose log has not moved is served from
 *     memory. It hands back a disposable lease over the same complete event log.
 *
 * `observeSession` is what this module reads through, so N sessions cost N
 * `stat` calls and no listings. It has been published in every engine release
 * this package supports; `readSession` stays as the fallback for a host that
 * publishes only it (docs/decisions D12).
 *
 * Either way, the same two codes mean "this session has nothing to give right
 * now" (docs/decisions D12): an unreadable or vanished log is one session left
 * out, reported once, and every other failure propagates.
 *
 * The host ships no type for the events, so the caller names the shape it reads.
 *
 * @param ctx - host plugin context, for the `sessionQuery` service.
 * @param sessionId - the session whose log is read.
 * @param label - what the caller is doing, for the warning a tolerated failure leaves.
 * @returns the events, or null when there is no reader or the log cannot be read.
 */
import type { DshContext } from './dsh.js'

/** The caller's events out of whatever the host hands back, or null when it is not a log. */
function eventsOf<T>(events: unknown): T[] | null {
  return Array.isArray(events) ? events as T[] : null
}

/**
 * The refusal the two tolerated codes stand for: the service read no log for
 * this session, and the next pass may do better.
 *
 * @param error - what the reader threw.
 * @returns the failure, or null when it is a failure the caller must handle itself.
 */
function unreadableLog(error: unknown): { message?: string } | null {
  const failure = error as { code?: string, message?: string } | null
  return failure?.code === 'SESSION_QUERY_CORRUPT_SESSION' || failure?.code === 'SESSION_QUERY_SESSION_NOT_FOUND'
    ? failure
    : null
}

/** Report one session the reader refused, naming the pass it was left out of. */
function reportUnreadable(ctx: DshContext, error: unknown, sessionId: string, label: string) {
  ctx.logger?.warn?.(`dsh-claude-style: session ${sessionId} left out of ${label}: ${unreadableLog(error)?.message}`)
}

export async function readEvents<T>(ctx: DshContext, sessionId: string, label: string): Promise<T[] | null> {
  const query = ctx.get('sessionQuery')
  if (query === null || query === undefined) return null
  try {
    // The observation is the listing-free read: its events are a complete,
    // detached log, and the lease is released as soon as they are in hand. A
    // live session never decrypts a file at all.
    if (typeof query.observeSession === 'function') {
      const observation = await query.observeSession(sessionId, { projectionMode: 'none' })
      const events = eventsOf<T>(observation?.events)
      observation?.[Symbol.dispose]?.()
      return events
    }
    if (typeof query.readSession !== 'function') return null
    const snapshot = await query.readSession(sessionId)
    return eventsOf<T>(snapshot?.events)
  } catch (error) {
    if (unreadableLog(error) === null) throw error
    reportUnreadable(ctx, error, sessionId, label)
    return null
  }
}
