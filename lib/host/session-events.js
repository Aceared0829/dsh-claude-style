// packages/host/src/session-events.ts
function eventsOf(events) {
  return Array.isArray(events) ? events : null;
}
function unreadableLog(error) {
  const failure = error;
  return failure?.code === "SESSION_QUERY_CORRUPT_SESSION" || failure?.code === "SESSION_QUERY_SESSION_NOT_FOUND" ? failure : null;
}
function reportUnreadable(ctx, error, sessionId, label) {
  ctx.logger?.warn?.(`dsh-claude-style: session ${sessionId} left out of ${label}: ${unreadableLog(error)?.message}`);
}
function releaseObservation(observation) {
  const named = observation.dispose;
  if (typeof named === "function") named.call(observation);
  else if (Symbol.dispose in observation) observation[Symbol.dispose]();
}
async function readEvents(ctx, sessionId, label) {
  const query = ctx.get("sessionQuery");
  if (query === null || query === void 0) return null;
  try {
    if (typeof query.observeSession === "function") {
      const observation = await query.observeSession(sessionId, { projectionMode: "none" });
      try {
        return eventsOf(observation.events);
      } finally {
        releaseObservation(observation);
      }
    }
    if (typeof query.readSession !== "function") return null;
    const snapshot = await query.readSession(sessionId);
    return eventsOf(snapshot?.events);
  } catch (error) {
    if (unreadableLog(error) === null) throw error;
    reportUnreadable(ctx, error, sessionId, label);
    return null;
  }
}
export {
  readEvents
};
