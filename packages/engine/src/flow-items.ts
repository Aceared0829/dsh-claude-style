import { CHAT_FLOW_SLOT_SELECTOR, CHAT_NODE_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { observeMatches, subscribeMutations } from './bus'
import type { MatchList } from './bus'

/** The host chat module's hashed classes the marks are kept for, as its own rules name them. */
export interface FlowClasses {
  /** A flow item. */
  readonly items: readonly string[]
  /** The chat column, whose children the flow rules space beside the flow slot's. */
  readonly columns: readonly string[]
}

/**
 * Keep the two marks the sodium rewrite's selectors read in place of the host's
 * own structural tests (D78, D9).
 *
 * The empty mark stands for `:is(:empty, :has(> <chat node>:empty))`, the
 * verdict the browser's own `:empty` gives one element at a time. The child
 * mark names the elements the flow rules space: those rules end in a compound almost every
 * element on the page matches, so the browser tries each one against them
 * after every change; with the mark in that compound only the flow's own
 * children are tried. A child that leaves keeps its mark, which every rule
 * reading it ignores outside the flow.
 *
 * The bus hands the records over in the mutation observer's callback, after the
 * host's change and before the browser computes style, so the marks and the
 * tree never disagree in a painted frame.
 *
 * @param emptyMark - on a flow item while it is empty or holds an empty chat node as a direct child.
 * @param childMark - on every child of a chat column and of the flow slot.
 * @returns stop: the watch ends, and the marks come off every item and every
 *          container's children.
 */
export function keepFlowMarks(classes: FlowClasses, emptyMark: string, childMark: string) {
  const containers: MatchList<Element>[] = [CHAT_FLOW_SLOT_SELECTOR, ...classes.columns.map((name) => `.${name}`)].map((selector) => observeMatches(selector))
  const isItem = (element: Element) => classes.items.some((name) => element.classList.contains(name))
  const isContainer = (element: Element) => classes.columns.some((name) => element.classList.contains(name)) || element.matches(CHAT_FLOW_SLOT_SELECTOR)

  const settleItem = (item: Element) => {
    let empty = item.matches(':empty')
    for (const child of item.children) {
      if (empty) break
      empty = child.matches(`${CHAT_NODE_SELECTOR}:empty`)
    }
    if (item.hasAttribute(emptyMark) !== empty) item.toggleAttribute(emptyMark, empty)
  }

  const markChildren = (container: Element) => {
    for (const child of container.children) if (!child.hasAttribute(childMark)) child.setAttribute(childMark, '')
  }

  /** Everything a subtree that arrived brings: its items, and the children of its containers. */
  const settleWithin = (root: Element) => {
    if (isItem(root)) settleItem(root)
    if (isContainer(root)) markChildren(root)
    if (root.firstElementChild === null) return
    for (const name of classes.items) for (const item of root.getElementsByClassName(name)) settleItem(item)
    for (const name of classes.columns) for (const column of root.getElementsByClassName(name)) markChildren(column)
    for (const slot of root.querySelectorAll(CHAT_FLOW_SLOT_SELECTOR)) markChildren(slot)
  }

  // An item turns empty or full when its own children change, or when the chat
  // node under it does; a container's new child arrives as a child list change
  // on the container.
  const stop = subscribeMutations(document.body, { childList: true, subtree: true }, (records) => {
    for (const record of records) {
      const target = record.target
      if (target instanceof Element) {
        if (isItem(target)) settleItem(target)
        if (isContainer(target)) markChildren(target)
        const parent = target.parentElement
        if (parent !== null && isItem(parent) && target.matches(CHAT_NODE_SELECTOR)) settleItem(parent)
      }
      for (const node of record.addedNodes) if (node instanceof Element) settleWithin(node)
    }
  })
  for (const name of classes.items) for (const item of document.getElementsByClassName(name)) settleItem(item)
  for (const list of containers) for (const container of list.all()) markChildren(container)

  return () => {
    stop()
    for (const name of classes.items) for (const item of document.getElementsByClassName(name)) item.removeAttribute(emptyMark)
    for (const list of containers) {
      for (const container of list.all()) for (const child of container.children) child.removeAttribute(childMark)
      list.release()
    }
  }
}
