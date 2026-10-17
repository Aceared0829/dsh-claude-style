import { STREAMING_SELECTOR } from '@dsh-claude-style/contracts/dom'
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
 * arguments stream through a summary line rather than the page, and the
 * renderer drops the markers it parses. The ratios below are calibrated so the
 * estimate tracks settled usage on that thinner text — a wide (CJK) character
 * at `WIDE_TOKENS`, everything else at `NARROW_TOKENS` — and the figure is
 * corrected as soon as the step's usage lands, so only the written-back side
 * rides on them: a request's prompt is fixed while it streams.
 */

/** A wide character's share of a token, and a narrow one's. */
const WIDE_TOKENS = 1
const NARROW_TOKENS = 0.4
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
 * @returns { settle, tokens, reset }.
 */
export function createStreamEstimate() {
  /** The settled output total the estimate rides on, or null before the first reading. */
  let settled: number | null = null
  /** The tokens the streamed text has grown by since that settlement. */
  let grown = 0
  /** When the page was last read; before the first read, so it is always due. */
  let readAt = Number.NEGATIVE_INFINITY
  /** The streaming containers seen, with the counts their text stood at. */
  const seen = new Map<Element, Counts>()

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
   * @param now - the frame's time, so the interval is read off the pipeline's
   *   own clock.
   */
  function tokens(now = performance.now()) {
    if (now - readAt < SCAN_MS) return grown
    readAt = now
    const root = findConversationScroller() ?? document.body
    const containers = [...root.querySelectorAll(STREAMING_SELECTOR)]
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
    return grown
  }

  return {
    /**
     * Take the settled output total. A new one is a step's settlement: the
     * estimate starts over, and the next reading re-baselines the containers
     * still streaming, so the text the settled number already covers is not
     * counted again.
     */
    settle(outputTokens: number) {
      if (settled === outputTokens) return
      settled = outputTokens
      grown = 0
      seen.clear()
    },
    /** The estimate, reading the page again if the last reading is old enough. */
    tokens,
    /** Forget the estimate and every container (a session switch, or the teardown). */
    reset() {
      settled = null
      grown = 0
      readAt = Number.NEGATIVE_INFINITY
      seen.clear()
    },
  }
}
