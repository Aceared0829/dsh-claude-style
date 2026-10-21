import { conversationSessionId, findConversationSession, hostSessions } from '@dsh-claude-style/engine/host'
import { hostChatSeat } from '../../core/i18n'
import { readPrefs } from '../../core/prefs'
import { peerPresent } from '../../shared/peer-plugin'
import { STATS_POSITION_INLINE } from '../../constants'
import { createContextStatsBinding } from './stats-binding'
import { createInlineStats } from './inline-stats'
import { createStatsBlock } from './stats-block'
import { createStreamEstimate } from './stream-estimate'
import { createSessionCost, loadPrices, priceDocument, priceGeneration } from './session-cost'
import { paintContextPie, readPieColours, releaseContextPie } from './context-meter-pie'
import { CONTEXT_STATS_ATTR, CONTEXT_PANEL_ATTR, clearStrayContextNodes, contextPanel, findContextMeter, meterOccupancy, releaseDialogWatch } from './stats-panel'
import { CONTEXT_STOPS, rampPosition, writeRamp } from './stats-ramp'
import { priceFor, priceTierAt } from '@dsh-claude-style/contracts/prices'
import type { Currency } from '@dsh-claude-style/contracts/prices'
import type { HostContext, HostText } from '@dsh-claude-style/engine/host'
import type { HostSessionStatsProjection, HostSnapshotSource, HostTokenUsageProjection } from '@dsh-claude-style/contracts/services'
import type { StatsReading } from './stats-count'
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
  /** The projections the reading follows: the figures, and the route the cost prices at. */
  const STATS_KEYS = ['sessionStats', 'tokenUsage', 'modelSelection']

  /**
   * How long the line stands without a reading across a session switch. The new
   * session's faces usually answer within a frame or two; the hold covers the
   * host's own re-render on the way, and gives up rather than leave stale
   * figures standing.
   */
  const SWITCH_HOLD_MS = 800

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
  estimate.watch()

  /** The settled cost the host priced, and the table the estimate ticks by. */
  const cost = createSessionCost()

  /** The session's route from the host's model-selection projection. */
  interface ModelSelection {
    next?: { model?: string }
    lastUsed?: { model?: string }
  }

  /** The host's `chat` namespace translate seat, or null when it is absent (core/i18n). */
  function chatText(): HostText | null {
    return hostChatSeat(ctx)
  }

  /** Which official price table the reader chose. */
  function currency(): Currency {
    return readPrefs().billingCurrency as Currency
  }

  /** One projection's current whole value, with no stream estimate added. */
  function faceValue<Value>(key: string): Value | undefined {
    const face = watch === null ? undefined : watch.faces[key]
    if (typeof face?.getSnapshot !== 'function') return undefined
    return face.getSnapshot() as Value | undefined
  }

  /**
   * What the session has cost so far, in micro units: the host's settled total
   * plus the tokens the streaming answer has grown by, priced at the output
   * rate in force now. The increment stays output-only — the prompt and the
   * cache are settled with the call — so the figure steps up when a step ends.
   */
  function costOfReading(usage: HostTokenUsageProjection | null, grown: number): number | null {
    const answered = cost.value()
    if (answered === null || usage === null) return null
    // The host names the route the last settlement was billed at; the
    // selection projection is the fallback for a session that has not settled
    // yet, and it is not always served.
    const selection = faceValue<ModelSelection>('modelSelection')
    const model = answered.model ?? selection?.lastUsed?.model ?? selection?.next?.model
    const document = priceDocument()
    if (model === null || model === undefined || document === null) return null
    const price = priceFor(document, model, currency())
    if (price === undefined) return null
    const tier = priceTierAt(price, Date.now(), document.schedule)
    const settled = currency() === 'CNY' ? answered.cny : answered.usd
    return settled + grown * tier.output
  }

  /** The whole reading, with the stream's estimate on both the usage and the cost. */
  function readReading(): StatsReading {
    const stats = faceValue<HostSessionStatsProjection>('sessionStats') ?? null
    const raw = faceValue<HostTokenUsageProjection>('tokenUsage') ?? null
    let usage: HostTokenUsageProjection | null = raw
    let grown = 0
    if (raw !== null) {
      estimate.settle(raw.outputTokens)
      grown = estimate.tokens()
      if (grown > 0) usage = { ...raw, outputTokens: Math.round(raw.outputTokens + grown) }
    }
    return { stats, usage, cost: costOfReading(usage, grown) }
  }

  /** One reading per pass, so the block and the line price the same frame the same way. */
  let readingMemo: StatsReading | null = null
  function reading(): StatsReading {
    readingMemo ??= readReading()
    return readingMemo
  }

  const block = createStatsBlock(reading, chatText, currency)
  const inline = createInlineStats(reading, chatText, findContextMeter, currency)
  const binding = createContextStatsBinding()

  /**
   * A settled total landed. The figures on screen were priced from the previous
   * one, so the reading is taken again and both surfaces are written once more
   * — the count they are on is the same, so the new figure travels from where
   * the old one stands rather than jumping (stats-count.ts).
   */
  const offCost = cost.onChange(() => {
    readingMemo = null
    renderNumbers()
  })

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
    // The settled cost and the reading belong to the session they were read
    // from; the next one starts from its own.
    cost.follow('')
    readingMemo = null
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
    readingMemo = null
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
    // A settlement is what moves the settled cost. The ask is throttled like a
    // pass's own: several projections can change on one settlement.
    cost.ask(Date.now())
    renderNumbers()
  }

  /**
   * Follow the shown conversation's projections, one subscription per
   * session: a switch releases the old faces and binds the new ones.
   */
  function syncWatch() {
    const sessionId = shownSessionId()
    if (watch !== null && watch.sessionId === sessionId) return
    // The old session's faces go before the new ones answer, and the host
    // re-renders the row the line stands beside: the line keeps its place for
    // a moment instead of folding and unfolding the composer's bottom line.
    if (watch !== null) inline.hold(SWITCH_HOLD_MS)
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
    cost.follow(watch?.sessionId ?? '')
    // A table that arrives after the page's first pass re-prices everything:
    // the host clears its totals on the swap, so its settled figure is asked
    // for again before the new rate is drawn. The pass itself never waits on
    // the fetch — the figures of this frame are drawn from what is in hand.
    const before = priceGeneration()
    void loadPrices(Date.now()).then(() => {
      if (priceGeneration() === before) return
      cost.ask(Date.now(), true)
      renderNumbers()
    })
    cost.ask(Date.now())
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
     * budget for the line of figures, which is measured again on the next
     * frame (inline-stats.ts).
     */
    reposition(reason: 'viewport' | 'composer') {
      if (reason === 'viewport') {
        const panel = contextPanel()
        if (panel !== null) binding.align(panel)
      }
      inline.refit()
    },
    /** Drop the appends, the line, the projection subscriptions and the host-node bindings. */
    teardown() {
      releaseWatch()
      offCost()
      // The structure bus behind the estimate's call rows goes with the rest.
      estimate.stop()
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
