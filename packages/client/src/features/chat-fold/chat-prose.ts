import { observeMatches, subscribeMutations } from '@dsh-claude-style/engine/bus'
import { CHAT_PROSE_ATTR } from '../../constants'
import { ASSISTANT_STEP_KIND, CHAT_CALL_SELECTOR, FLOW_BLOCK_SELECTOR, FLOW_KIND_ATTRIBUTE, PROCESS_GROUP_SELECTOR, THINK_ROW_SELECTOR, TOOL_CALL_KIND } from '@dsh-claude-style/contracts/dom'

/** The host's markdown renderer's own marks: the prose it sets is set by its rules. */
const RENDERED = '[data-dsh-claude-part~="markdown"], [data-markdown-variant], ._markdown_'

/**
 * Mark the prose the conversation shows — the lines a turn says between its
 * process steps — so the stylesheet can set it as a document
 * (theme/typography.css).
 *
 * The host renders its markdown with a renderer whose parts the skin styles by
 * that renderer's own names; the lines a turn interleaves with its tools carry no
 * such part, and every flow item arrives with a zero margin, so they read as one
 * run of text against the paragraphs around them.
 *
 * A run is a flow's own row: the element carrying the flow key that stands in the
 * flow. The group a turn's steps live in carries the same key on its own box and
 * on the body inside it, and neither is the conversation's prose — the steps in
 * there are the skin's process rows, laid out by the fold.
 *
 * Only the steps of a turn and the calls a tool made are read: the reader's own
 * messages, a turn's process section as a whole, its tail and the waiting line
 * are the host's boxes with their own layout, and a face written onto them would
 * reach the controls those rows hold.
 *
 * The mark goes on the run and on the boxes under it that hold plain text, left
 * out from under anything the renderer has drawn. A thinking row is passed over
 * whole: what it holds is the reasoning the reader watches, and its window's own
 * rules own that.
 *
 * The batch is dressed in the callback that hears it, before the browser computes
 * style: the host reads a row's layout in the task that wrote it (D78), and a mark
 * a frame late would reach the stylesheet after that read.
 *
 * @returns teardown: the mark comes off.
 */
export function createChatProse() {
  const isFlowRow = (element: Element) => element.matches(`${FLOW_BLOCK_SELECTOR}:is([${FLOW_KIND_ATTRIBUTE}="${ASSISTANT_STEP_KIND}"], [${FLOW_KIND_ATTRIBUTE}="${TOOL_CALL_KIND}"]), ${CHAT_CALL_SELECTOR}`)
    && !element.matches(PROCESS_GROUP_SELECTOR)
    && element.parentElement !== null
    && !element.parentElement.matches(PROCESS_GROUP_SELECTOR)
    && !element.closest(THINK_ROW_SELECTOR)

  /** Whether a box holds text the renderer did not draw. */
  const holdsPlainText = (box: Element) => !box.matches(RENDERED)
    && box.querySelector(RENDERED) === null
    && ((box.textContent ?? '').trim() !== '' || box.querySelector('img, table, pre, ul, ol') !== null)

  /**
   * Mark one run and the boxes that hold its plain text, wherever the host has
   * put them under the run: a step's own node may hand the text down a chain of
   * boxes with no mark of their own, and only the renderer's own box ends that.
   */
  const dress = (run: Element) => {
    if (!isFlowRow(run)) return

    const walk = (box: Element): boolean => {
      let holds = false
      for (const child of box.children) {
        const marked = holdsPlainText(child)
        if (marked) {
          if (!child.hasAttribute(CHAT_PROSE_ATTR)) child.setAttribute(CHAT_PROSE_ATTR, '')
          holds = true
          continue
        }
        // The renderer's own box is left exactly as the host draws it, and a run
        // standing inside one — a tool call in a group — is not this reading's.
        if (child.matches(RENDERED)) continue
        if (child.querySelector(RENDERED) !== null) holds = walk(child) || holds
        else if (child.hasAttribute(CHAT_PROSE_ATTR)) child.removeAttribute(CHAT_PROSE_ATTR)
      }
      return holds
    }

    const holds = walk(run)
    if (holds !== run.hasAttribute(CHAT_PROSE_ATTR)) run.toggleAttribute(CHAT_PROSE_ATTR, holds)
  }

  /** The runs a node stands in or holds, read from the node's own tree. */
  const runsAround = (element: Element): Element[] => {
    const found: Element[] = []
    for (let up: Element | null = element; up !== null; up = up.parentElement) if (isFlowRow(up)) found.push(up)
    for (const inside of element.querySelectorAll(`${FLOW_BLOCK_SELECTOR}, ${CHAT_CALL_SELECTOR}`)) if (isFlowRow(inside)) found.push(inside)
    return found
  }

  /** Every row on the page, kept current by the bus (the rows themselves, not what stands inside them). */
  const rows = observeMatches<Element>(`${FLOW_BLOCK_SELECTOR}, ${CHAT_CALL_SELECTOR}`)

  /** Mark the runs a page already holds, at install or for a session restored whole. */
  const dressPage = () => {
    for (const run of rows.all()) dress(run)
  }

  const stopWatch = subscribeMutations(document.body, { childList: true, subtree: true, characterData: true }, (records) => {
    const nodes = new Set<Node>()
    for (const record of records) {
      nodes.add(record.target)
      for (const node of record.addedNodes) nodes.add(node)
    }
    for (const node of nodes) {
      const element = node instanceof Element ? node : node.parentElement
      if (element === null) continue
      for (const run of runsAround(element)) dress(run)
    }
    // A session switch or a history restored in one batch brings runs whose
    // parts follow in later batches: the page is lined up after each, so a run
    // whose text arrives late is read with the batch that brings it.
    if (records.some(record => record.type === 'characterData' || record.addedNodes.length > 0)) dressPage()
  })

  dressPage()

  return () => {
    stopWatch()
    for (const item of rows.all()) item.removeAttribute(CHAT_PROSE_ATTR)
    for (const row of rows.all()) for (const child of row.children) child.removeAttribute(CHAT_PROSE_ATTR)
    rows.release()
  }
}
