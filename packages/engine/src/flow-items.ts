import { CHAT_FLOW_SLOT_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { observeMatches, subscribeMutations } from './bus'
import type { MatchList } from './bus'

/**
 * Keep the mark the sodium rewrite's gap rules fall back on (D78): on every
 * child of a chat column and of the flow slot.
 *
 * Those rules are bucketed on what the host writes on the flow's children when
 * it creates them; the mark is the branch that catches a child of any other
 * kind. A child that leaves keeps its mark, which every rule reading it ignores
 * outside the flow.
 *
 * The bus hands the records over in the mutation observer's callback, after the
 * host's change and before the browser computes style for a frame: a child only
 * the mark catches has no gap in a layout the host reads in the task that
 * inserted it.
 *
 * @param columns - the host chat module's hashed class of a chat column, as its rules name it.
 * @param childMark - the attribute the rewritten rules read.
 * @returns stop: the watch ends, and the mark comes off every container's children.
 */
export function keepFlowChildMark(columns: readonly string[], childMark: string) {
  const containers: MatchList<Element>[] = [CHAT_FLOW_SLOT_SELECTOR, ...columns.map((name) => `.${name}`)].map((selector) => observeMatches(selector))
  const isContainer = (element: Element) => columns.some((name) => element.classList.contains(name)) || element.matches(CHAT_FLOW_SLOT_SELECTOR)

  const markChildren = (container: Element) => {
    for (const child of container.children) if (!child.hasAttribute(childMark)) child.setAttribute(childMark, '')
  }

  /** The containers a subtree that arrived brings, the subtree itself among them. */
  const settleWithin = (root: Element) => {
    if (isContainer(root)) markChildren(root)
    if (root.firstElementChild === null) return
    for (const name of columns) for (const column of root.getElementsByClassName(name)) markChildren(column)
    for (const slot of root.querySelectorAll(CHAT_FLOW_SLOT_SELECTOR)) markChildren(slot)
  }

  // A container's new child arrives as a child list change on the container.
  const stop = subscribeMutations(document.body, { childList: true, subtree: true }, (records) => {
    for (const record of records) {
      if (record.target instanceof Element && isContainer(record.target)) markChildren(record.target)
      for (const node of record.addedNodes) if (node instanceof Element) settleWithin(node)
    }
  })
  for (const list of containers) for (const container of list.all()) markChildren(container)

  return () => {
    stop()
    for (const list of containers) {
      for (const container of list.all()) for (const child of container.children) child.removeAttribute(childMark)
      list.release()
    }
  }
}
