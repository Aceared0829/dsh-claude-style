import { conversationSessionId, findConversationSession, hostSessions } from '@dsh-claude-style/engine/host'
import { hostChatSeat } from '../../core/i18n'
import { readPrefs } from '../../core/prefs'
import { peerPresent } from '../../shared/peer-plugin'
import { STATS_POSITION_INLINE } from '../../constants'
import { createContextStatsBinding } from './stats-binding'
import { createInlineStats } from './inline-stats'
import { createStatsBlock } from './stats-block'
import { createStreamEstimate } from './stream-estimate'
import { paintContextPie, readPieColours, releaseContextPie } from './context-meter-pie'
import { CONTEXT_STATS_ATTR, CONTEXT_PANEL_ATTR, clearStrayContextNodes, contextPanel, findContextMeter, meterOccupancy, releaseDialogWatch } from './stats-panel'
import { CONTEXT_STOPS, rampPosition, writeRamp } from './stats-ramp'
import type { HostContext, HostText } from '@dsh-claude-style/engine/host'
import type { HostSnapshotSource, HostTokenUsageProjection } from '@dsh-claude-style/contracts/services'
import type { PieColours } from './context-meter-pie'

/**
 * The session's numbers, read from the host's own projections
 *
 * Where they show follows the `statsPosition` choice: `context` hides the
 * composer's statistics row and moves the numbers into the popover the context
 * meter owns (features/composer/inline-bar.css), while `inline` leaves the host
 * row hidden too and writes them onto a line of its own under the card, with
 * the meter at that line's end. The choice is read on every pass, so switching
 * it moves the numbers without a reload. The panel carries the rows in both
 * positions: with the numbers on their own line, that line is the panel's
 * second trigger, so the figures expand into the rows a reader asks for.
 *
 * They are read as DATA: the host computes `sessionStats` and `tokenUsage` as
 * durable whole-log session projections, and the session face carries their
 * key-addressed read faces (`session.projections.faceOf`) — the same seat the
 * host's own `useProjection` resolves. The host's two stat dialogs are never
 * opened, so nothing is rendered twice, and both surfaces are filled the moment
 * they appear (and again on every projection frame). The written-back figure
 * carries an estimate of the text streaming now (stream-estimate.ts): the host
 * settles a step's usage at its end, so without it that figure would stand
 * still through the answer.
 *
 * The WORDS come from the host's own `chat` locale namespace, the one its
 * pills read, so the three surfaces agree letter for letter and follow the
 * shell language together; the formatting rules the host applies before it
 * paints are mirrored in stats-format.ts. The meter's own reading takes the
 * occupancy colour band (stats-ramp.ts).
 *
 * The projections are followed here, the rows and sections are built in
 * stats-model.ts, the host's panel and its marks are read in stats-panel.ts,
 * the popover block is written in stats-block.ts, the line of its own in
 * inline-stats.ts, and the hover path and the alignment reading are in
 * stats-binding.ts.
 *
 * @param ctx - client context: the session binding and the locale seat.
 * @returns { measure, sync, close, reposition, teardown }.
 */
export function createSessionStats(ctx: HostContext) {
  /** The projections the block reads, in the order its sections appear. */
  const STATS_KEYS = ['sessionStats', 'tokenUsage']

  /** The projection keys this page is following, and how to stop. */
  let watch: { sessionId: string, faces: Record<string, HostSnapshotSource<unknown>>, off: (() => void)[] } | null = null

  /**
   * The shown conversation's host session id.
   *
   * Read off the active conversation's own column (features/chat-wait
   * does the same): the id names the conversation on screen, which is the
   * composer whose meter opened the popover.
   */
  function shownSessionId() {
    const id = conversationSessionId(findConversationSession())
    return id === null ? '' : id
  }

  /**
   * The host's key-addressed read faces for one session, or null while the
   * session or its projections cannot be reached.
   */
  function statsFaces(sessionId: string) {
    const sessions = hostSessions(ctx)
    const binding = typeof sessions?.binding === 'function' ? sessions.binding(sessionId) : undefined
    const projections = binding?.session?.projections
    if (typeof projections?.faceOf !== 'function') return null
    const faces: Record<string, HostSnapshotSource<unknown>> = {}
    for (let i = 0; i < STATS_KEYS.length; i++) faces[STATS_KEYS[i]] = projections.faceOf(STATS_KEYS[i])
    return faces
  }

  /** The estimate of the text streaming now, riding on the settled written-back total. */
  const estimate = createStreamEstimate()

  /**
   * One usage reading with the stream's estimate added: the host's settled
   * total plus the tokens its streaming text has grown by, and the raw total
   * again once the step settles.
   */
  function streamedUsage(usage: HostTokenUsageProjection) {
    estimate.settle(usage.outputTokens)
    const grown = estimate.tokens()
    return grown <= 0 ? usage : { ...usage, outputTokens: Math.round(usage.outputTokens + grown) }
  }

  /** One projection's current whole value, with the stream's estimate on the usage side. */
  function statsValue<Value>(key: string): Value | undefined {
    const face = watch === null ? undefined : watch.faces[key]
    if (typeof face?.getSnapshot !== 'function') return undefined
    const value = face.getSnapshot()
    if (key !== 'tokenUsage' || value === undefined || value === null) return value as Value
    return streamedUsage(value as HostTokenUsageProjection) as Value
  }

  /** The host's `chat` namespace translate seat, or null when it is absent (core/i18n). */
  function chatText(): HostText | null {
    return hostChatSeat(ctx)
  }

  const block = createStatsBlock(statsValue, chatText)
  const inline = createInlineStats(statsValue, chatText, findContextMeter)
  const binding = createContextStatsBinding()

  /** The pie's colours this frame's read phase took, until the pass's sync uses them. */
  let pieColours: PieColours | null = null

  /** Stop following the projections (a different session, or the teardown). */
  function releaseWatch() {
    if (watch !== null) {
      for (let i = 0; i < watch.off.length; i++) watch.off[i]()
      watch = null
    }
    // The stream's estimate belongs to the session it was read from; the next
    // session counts its own text from a fresh baseline (stream-estimate.ts).
    estimate.reset()
    // The skeleton's wait holds the panel's place, not the session's: it goes
    // whether a session was ever bound or not (stats-block.ts). The line keeps
    // the numbers it is showing: another session's readings are counted to
    // from them (stats-count.ts).
    block.stopSkeleton()
  }

  /**
   * Write the numbers onto whichever surface the position names. The host's
   * panel carries the rows in BOTH positions: with the numbers on a line of
   * their own, that panel is what the line opens (stats-binding.ts), so the
   * line's figures and the panel's rows stay the same session's numbers.
   */
  function renderNumbers() {
    if (readPrefs().statsPosition === STATS_POSITION_INLINE) inline.render()
    else inline.clear()
    block.render()
  }

  /**
   * A projection frame landed. Both surfaces are the skin's own nodes — the
   * block inside the host's panel, the line beside the host's statistics row —
   * so they are rewritten here rather than through a pass.
   */
  function onStatsFrame() {
    renderNumbers()
  }

  /**
   * Follow the shown conversation's projections, one subscription per
   * session: a switch releases the old faces and binds the new ones.
   */
  function syncWatch() {
    const sessionId = shownSessionId()
    if (watch !== null && watch.sessionId === sessionId) return
    releaseWatch()
    block.resetContent()
    if (sessionId === '') return
    const faces = statsFaces(sessionId)
    if (faces === null) return
    const off: (() => void)[] = []
    for (let i = 0; i < STATS_KEYS.length; i++) {
      const face = faces[STATS_KEYS[i]]
      if (typeof face?.subscribe === 'function') off.push(face.subscribe(onStatsFrame))
    }
    watch = { sessionId, faces, off }
  }

  /**
   * A pass over the session's numbers: follow the shown conversation's
   * projections, paint the meter's own reading, then keep whichever surface
   * the position names current.
   */
  function syncNumbers() {
    syncWatch()
    const meter = findContextMeter()
    if (meter !== null) {
      binding.bindMeter(meter)
      const occupancy = meterOccupancy(meter)
      const rampMoved = writeRamp(meter, 'context', occupancy === null ? null : rampPosition(occupancy, CONTEXT_STOPS))
      // The pie is dsh-chat-ux's own reading of the same meter: while that
      // plugin draws it, the host's ring is left to that plugin's draw
      // (THIRD_PARTY_NOTICES.md).
      if (peerPresent('dsh-chat-ux')) paintContextPie(meter, null, null)
      else {
        // The read phase's colours hold until this pass moves the band they
        // come from; only then are they read again, after the write (D40).
        const stale = rampMoved || pieColours === null || pieColours.trigger !== meter.querySelector('button')
        paintContextPie(meter, occupancy, stale ? readPieColours(meter) : pieColours)
      }
    }
    pieColours = null
    // The line of numbers is the panel's second trigger, so it is bound (and
    // told whether the panel stands open) on every pass, in either position: a
    // reader who switches back finds the same line driving the same panel.
    const line = inline.root()
    if (line !== null) {
      binding.bindLine(line)
      binding.syncLine(line)
    }
    // The panel is both surfaces' popover, so its own bindings — the stamp the
    // stylesheet reads and the reading that lines it up with the meter — are
    // taken in either position.
    const panel = contextPanel()
    if (panel !== null) binding.bindPanel(panel)
    renderNumbers()
  }

  clearStrayContextNodes()

  return {
    /**
     * The pass's read phase: take the pie's colours while the frame's styles
     * are settled anyway, since a read after the pass's writes would settle
     * them a second time (D40).
     */
    measure() {
      const meter = findContextMeter()
      pieColours = meter === null || peerPresent('dsh-chat-ux') ? null : readPieColours(meter)
    },
    /** One pass: keep the numbers current on whichever surface the position names. */
    sync() {
      syncNumbers()
    },
    /** Composer focus closes the panel the host's trigger opened. */
    close() {
      binding.close()
    },
    /**
     * The viewport moved under the panel: the host re-places it from its
     * anchor, so the skin's own reading of where its right edge belongs
     * is taken again in the same frame. A narrower card is also a new
     * budget for the line of figures, which measures again here.
     */
    reposition(reason: 'viewport' | 'composer') {
      if (reason === 'viewport') {
        const panel = contextPanel()
        if (panel !== null) binding.align(panel)
      }
      inline.fit()
    },
    /** Drop the appends, the line, the projection subscriptions and the host-node bindings. */
    teardown() {
      releaseWatch()
      releaseDialogWatch()
      // Everything this generation bound on the host's own meter, line and
      // panel comes off with it (stats-binding.ts's release).
      binding.release()
      inline.clear()
      // A count still running would write the block back after the nodes are
      // taken off below (stats-block.ts).
      block.stop()
      const meter = findContextMeter()
      if (meter !== null) {
        writeRamp(meter, 'context', null)
        // The host's ring comes back with the stylesheet the pie replaced.
        releaseContextPie(meter)
      }
      const blocks = document.querySelectorAll(`[${CONTEXT_STATS_ATTR}]`)
      for (let i = 0; i < blocks.length; i++) {
        blocks[i].remove()
      }
      const panels = document.querySelectorAll(`[${CONTEXT_PANEL_ATTR}]`)
      for (let i = 0; i < panels.length; i++) panels[i].removeAttribute(CONTEXT_PANEL_ATTR)
    }
  }
}
