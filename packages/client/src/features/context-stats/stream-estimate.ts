import { CHAT_CALL_SELECTOR, CONVERSATION_SCROLL_SELECTOR, STREAMING_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { subscribeMutations } from '@dsh-claude-style/engine/bus'
import { findConversationScroller } from '@dsh-claude-style/engine/host'

/**
 * The tokens a streaming answer has added so far, as an estimate.
 *
 * The host settles its usage a step at a time (`tokenUsage` moves on
 * `assistant/message`), so the written-back figure would stand still while the
 * answer streams and jump once when the step ends. The text the host streams is
 * on the page: counting the characters the streaming containers have grown by
 * is enough to let the figure move, and the settlement replaces the estimate
 * with the provider's own number.
 *
 * The page's text is thinner than what the provider bills: a tool call's
 * arguments are not on the page as text at all, and the renderer drops the
 * markers it parses. So each call row of the step counts `CALL_TOKENS` beside
 * the text — a wide (CJK) character at `WIDE_TOKENS`, everything else at
 * `NARROW_TOKENS` — and the figure is corrected as soon as the step's usage
 * lands, so only the written-back side rides on them: a request's prompt is
 * fixed while it streams. The counts are read off the structure bus, not per
 * frame, and the readings stay on the interval above.
 */

/**
 * A wide character's share of a token, and a narrow one's: a page's own word
 * is worth well under a token, and the arguments no page shows are held apart
 * in `CALL_TOKENS` rather than folded into these.
 */
const WIDE_TOKENS = 1
const NARROW_TOKENS = 0.3
/**
 * What one call adds, wherever the page has put its arguments behind.
 *
 * The host settles a step's usage with the calls' arguments in it, and those
 * arguments are not on the page as text; a step that only calls tools streams
 * no text at all, so its written-back figure would stand still until the
 * settlement. A call's row arrives as the call starts, which is when its
 * arguments go by, so one count per row is the moment the figure can move.
 * The figure is a mean over calls and the set is wide: `read` and `grep` are
 * worth a few dozen, `write` and `send_message` thousands.
 */
const CALL_TOKENS = 170
/** How old the last reading may be before the streamed text is read again, in milliseconds. */
const SCAN_MS = 100

/** One streaming container's character counts at the last reading. */
interface Counts {
  wide: number
  narrow: number
}

/**
 * The estimate's reader.
 *
 * A batch is heard as the page's changes settle, so the page it meets is not
 * always the page it leaves: the rest of the bus moves a conversation of this
 * skin's own under a container of the skin's. Every row's column is therefore
 * asked at the reading, after the batch has been handed on.
 *
 * @returns { settle, tokens, watch, reset, stop }, where `watch` puts the
 *   structure bus behind the call rows, `reset` is a session switch and `stop`
 *   takes the bus away with the rest of the teardown.
 */
export function createStreamEstimate() {
  /** The settled output total the estimate rides on, or null before the first reading. */
  let settled: number | null = null
  /** The tokens the streamed text has grown by since that settlement. */
  let grown = 0
  /** When the page was last read; zero, so the first reading is always due. */
  let readAt = 0
  /** The frame clock the estimate's readings run on; zero before the first reading. */
  let clock = 0
  /** The streaming containers seen, with the counts their text stood at. */
  const seen = new Map<Element, Counts>()
  /** The streaming container the page has held since the settlement, or null. */
  let streamingSeen: Element | null = null
  /** The call rows this session has accounted for, so none of them counts twice. */
  const holds = new Set<Element>()
  /** The rows this reading has to count, with the column each was met in. */
  let batchRows: (Element | null)[] = []
  /** The batch's nodes the page did not hold, asked for their column at the reading. */
  let batchNodes: Element[] = []
  /** How many structure batches have come, so a reading knows when to look again. */
  let batches = 0
  let readBatches = 0
  /** The structure bus, and the token that marks the batches gathered under it. */
  let watching: (() => void) | null = null
  let watchingToken = 0

  /** The conversation column a node stands in, or null when it stands in none. */
  function conversationOf(node: Element | null): Element | null {
    if (node === null || node.parentElement === null) return null
    return node.parentElement.closest(CONVERSATION_SCROLL_SELECTOR)
  }

  /** Note the streaming container the batch's nodes brought, if the settlement has met none yet. */
  function markStreaming(nodes: Iterable<Node>) {
    if (streamingSeen !== null) return
    for (const node of nodes) {
      if (!(node instanceof Element) || node.matches(CONVERSATION_SCROLL_SELECTOR)) continue
      streamingSeen = node.matches(STREAMING_SELECTOR) ? node : node.querySelector(STREAMING_SELECTOR)
      if (streamingSeen !== null) return
    }
  }

  /** Note the rows `node` carries as belonging to `column`. */
  function noteRows(column: Element | null, node: Element) {
    if (node.matches(CHAT_CALL_SELECTOR)) batchRows.push(node, column)
    for (const row of node.querySelectorAll(CHAT_CALL_SELECTOR)) batchRows.push(row, column)
  }

  /**
   * Take the nodes one structure batch brought in, without reading the
   * conversation. A node put into a column holds that column's rows; a node
   * found inside a column holds the rows the record's target carries; a node
   * the page does not hold yet is asked for its column at the reading, once the
   * rest of the bus has attached the page it came in with.
   *
   * Every other addition the page makes — streamed text, the composer, another
   * panel — carries no call row, and is left after one scoped query rather than
   * walked to the root for a column it does not have.
   *
   * @param records - this batch's records.
   */
  function noteStructure(records: MutationRecord[]) {
    for (const record of records) {
      if (record.type !== 'childList' || record.addedNodes.length === 0) continue
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue
        const carries = node.matches(CHAT_CALL_SELECTOR) || node.querySelector(CHAT_CALL_SELECTOR) !== null
        if (!carries) continue
        if (node.matches(CONVERSATION_SCROLL_SELECTOR)) noteRows(node, node)
        else {
          const column = conversationOf(node)
          if (column !== null) noteRows(column, node)
          else batchNodes.push(node)
        }
      }
    }
  }

  /** Count the wide and the narrow characters of one container's text nodes. */
  function countText(container: Element) {
    const counts: Counts = { wide: 0, narrow: 0 }
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = (node as Text).data
      for (let index = 0; index < text.length; index++) {
        const code = text.charCodeAt(index)
        if (code < 0x2e80) {
          counts.narrow += 1
          continue
        }
        counts.wide += 1
        // A surrogate pair is one character, not two.
        if (code >= 0xd800 && code <= 0xdbff) index += 1
      }
    }
    return counts
  }

  /**
   * The estimate right now, reading the page again when the last reading is old
   * enough.
   *
   * A reading between the two due ones is not idle: the structure batches came
   * since the last one, and whether they count is asked of the page as it stands
   * then. Asking costs the streaming mark and the nodes a batch brought, while
   * a full reading walks every container's text.
   *
   * @param now - the frame's time, so the interval is read off the pipeline's
   *   own clock.
   */
  function tokens(now = performance.now()) {
    if (clock === 0) clock = now
    // A reading between the two due ones answers the structure batches alone,
    // and only when one brought a call row: the conversation seat is resolved
    // when a reading is due or a row is waiting, never per frame, and a batch
    // of streamed text leaves nothing waiting.
    if (now - readAt < SCAN_MS) {
      if (readBatches === batches) return grown
      if (batchRows.length === 0 && batchNodes.length === 0) {
        readBatches = batches
        return grown
      }
      return readCalls(findConversationScroller())
    }
    readAt = now
    const scroller = findConversationScroller()
    const containers = [...(scroller ?? document.body).querySelectorAll(STREAMING_SELECTOR)]
    markStreaming(containers)
    const live = new Set<Element>()
    for (const container of containers) {
      // A reasoning body inside the answer's own streaming markdown is counted
      // with the outer container alone.
      const parent = container.parentElement
      if (parent !== null && parent.closest(STREAMING_SELECTOR) !== null) continue
      live.add(container)
      const counts = countText(container)
      // A container seen for the first time is a baseline: text already on the
      // page belongs to a settlement or to an answer that started before this
      // reader asked, and counting it again would double the figure.
      const before = seen.get(container)
      if (before !== undefined) {
        grown += Math.max(0, counts.wide - before.wide) * WIDE_TOKENS
          + Math.max(0, counts.narrow - before.narrow) * NARROW_TOKENS
      }
      seen.set(container, counts)
    }
    for (const container of seen.keys()) if (!live.has(container)) seen.delete(container)
    return readCalls(scroller)
  }

  /**
   * Count the call rows the structure batches brought since the last reading.
   *
   * A step that streams no text (a call inside a call) has no streaming
   * container, so its rows count as they arrive: the step the last settlement
   * ended in is over, and those rows are behind. A step that streams text is
   * the one the batch met from its first row on, so everything the batch brings
   * in that step counts; a row the session has already accounted for stays
   * accounted for, a row the host re-renders in place being still the same row.
   *
   * Before this session's first settlement the page's rows are history, and
   * none of them is a call of a step that ran here: they are held without
   * counting, and the settlement that follows takes them as its own.
   *
   * @param scroller - the conversation column, or null outside one.
   */
  function readCalls(scroller: Element | null) {
    if (readBatches === batches) return grown
    readBatches = batches
    const streaming = streamingSeen !== null
    const nodes = batchNodes
    batchNodes = []
    for (const node of nodes) if (node.isConnected) noteRows(conversationOf(node), node)
    const rows = batchRows.splice(0)
    for (let index = 0; index < rows.length; index += 2) {
      const row = rows[index] as Element
      if (!row.isConnected || holds.has(row)) continue
      if (streaming) {
        // The step that streams owns the rows its column has just taken in.
        if (conversationOf(row) !== scroller) continue
        grown += CALL_TOKENS
        holds.add(row)
      } else {
        holds.add(row)
        if (settled !== null) grown += CALL_TOKENS
      }
    }
    return grown
  }

  /** Forget the estimate, every container and every row. */
  function forget() {
    settled = null
    grown = 0
    clock = 0
    readAt = 0
    seen.clear()
    streamingSeen = null
    holds.clear()
    batchRows = []
    batchNodes = []
    readBatches = batches
  }

  return {
    /**
     * Take the settled output total. A new one is a step's settlement: the
     * estimate starts over, and the next reading re-baselines the containers
     * still streaming, so the text the settled number already covers is not
     * counted again. The rows the step counted are already accounted for and
     * stay so, a row the host re-renders in place being still the same row; the
     * ones the page has dropped go, and a settlement makes the next reading due
     * whatever the clock says.
     */
    settle(outputTokens: number) {
      if (settled === outputTokens) return
      settled = outputTokens
      readAt = clock
      grown = 0
      seen.clear()
      streamingSeen = null
      // What arrived before this settlement is the settled step's: the batch
      // still waiting for a reading is dropped with it.
      batchRows = []
      batchNodes = []
      for (const row of holds) if (!row.isConnected) holds.delete(row)
    },
    /** The estimate, reading the page again if the last reading is old enough. */
    tokens,
    /**
     * Watch the structure: the call rows, and the streaming container that
     * marks the step now running. It is made before any other subscriber, so a
     * record of the page reaching here first finds the page as the change left
     * it.
     */
    watch() {
      watching?.()
      watchingToken += 1
      const token = watchingToken
      watching = subscribeMutations(document.body, { childList: true, subtree: true }, (records) => {
        if (token !== watchingToken) return
        batches += 1
        for (const record of records) markStreaming(record.addedNodes)
        noteStructure(records)
      })
    },
    /** Forget the estimate, every container and every row (a session switch). */
    reset() {
      forget()
    },
    /** Forget the estimate and let the bus go (the teardown). */
    stop() {
      watching?.()
      watching = null
      watchingToken += 1
      forget()
    },
  }
}
