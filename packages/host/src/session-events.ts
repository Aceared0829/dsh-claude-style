/**
 * Reading one session's raw log through the host's own reader.
 *
 * Both host-half readers (the usage roll-up and the search corpus) go through
 * this one call: the `sessionQuery` service is the only path to a log that may
 * be live, stored, or both. The read is an observation, which answers one log
 * directly; `readSession` preflights each read with a listing of the whole
 * corpus, so a pass over every stored log would pay that listing once per log.
 * The host ships no type for the events, so the caller names the shape it reads.
 *
 * D12 tolerates the two codes that mean "this session has nothing to give right
 * now": a corrupt record and an id the store no longer holds. A storage failure
 * is not one of them and propagates.
 *
 * @param ctx - host plugin context, for the `sessionQuery` service.
 * @param sessionId - the session whose log is read.
 * @param label - what the caller is doing, for the warning a tolerated failure leaves.
 * @returns the events, or null when there is no reader or the log cannot be read.
 */
import type { DshContext, DshSessionObservation } from './dsh.js'

/** The `sessionQuery` service, in the one member this module reads. */
interface ObservationReader {
  observeSession(sessionId: string, options?: { projectionMode?: 'all' | 'none' }): Promise<DshSessionObservation>
}

/**
 * Release one observation's lease.
 *
 * The host's lease exposes its release as `Symbol.dispose`; a named `dispose` is
 * what a host that publishes one carries instead.
 */
function release(observation: DshSessionObservation) {
  const release = (observation as { dispose?: () => void }).dispose
  if (typeof release === 'function') release.call(observation)
  else if (Symbol.dispose in observation) (observation as unknown as { [Symbol.dispose](): void })[Symbol.dispose]()
}

export async function readEvents<T>(ctx: DshContext, sessionId: string, label: string): Promise<T[] | null> {
  const query = ctx.get('sessionQuery') as ObservationReader | null | undefined
  if (query === null || query === undefined || typeof query.observeSession !== 'function') return null
  let observation: DshSessionObservation
  try {
    // `projectionMode: 'none'` keeps the host's own projection computation off a
    // read that only wants the events.
    observation = await query.observeSession(sessionId, { projectionMode: 'none' })
  } catch (error) {
    const failure = error as { code?: string, message?: string }
    if (failure?.code !== 'SESSION_QUERY_CORRUPT_SESSION' && failure?.code !== 'SESSION_QUERY_SESSION_NOT_FOUND') throw error
    ctx.logger?.warn?.(`dsh-claude-style: session ${sessionId} left out of ${label}: ${failure.message}`)
    return null
  }
  try {
    const events = observation.events
    return Array.isArray(events) ? events as T[] : null
  } finally {
    release(observation)
  }
}
