import { CHAT_CALL_SELECTOR, PROCESS_CONTENT_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { notifyAll } from '../../shared/notify'
import type { FileHunk, FileRowState } from './file-row-model'

/**
 * The file-change row's read-across-calls half (D62): the edits and writes of
 * one file inside one process group stand as a single row.
 *
 * The host renders one row per call and hands each of them only its own block,
 * so a row that has to know what the others did reads it here: every row
 * registers the file it touched and what its own call changed, and the row the
 * registry names as the group's head draws the whole file's tail and its whole
 * diff card. A file touched once is drawn exactly as it was before this module
 * existed.
 *
 * A group is one process group's content layer (D44), so two pieces of work in
 * one turn are never read together, and the head is the group's earliest call
 * in document order: a number that grows stays where the file was first
 * touched. The calls a program dispatched are the case with several rows of one
 * file on the page at once: the host renders them side by side under the
 * program's own row, inside the same content layer.
 */

/** One file-change row as the registry knows it: its element, its file, what its own call changed. */
export interface FileMergeRow {
  element: HTMLElement
  path: string
  hunks: readonly FileHunk[]
  state: FileRowState
}

/** What one row draws once its file's calls are read together. */
export interface FileMergeView {
  /** This row stands for the file: it draws the merged tail and the merged diff card. */
  head: boolean
  /** How many calls of the file are read together. */
  count: number
  /** Every call's hunks, in document order. */
  hunks: FileHunk[]
  /** Whether any call of the file is still running. */
  running: boolean
}

/** The content layer a row sits in, or null when it is in no process group. */
export function rowContainer(element: HTMLElement) {
  return element.closest(PROCESS_CONTENT_SELECTOR)
}

/**
 * The element whose box a row takes in its list: the host's call row for this
 * call. For a directly called tool that row is the content layer's own child;
 * for a call a program dispatched it is the sub-call's own row, and the
 * program's row around them must stay. Hiding this one takes the host row's
 * spacing with it; hiding the row inside it would leave the box behind.
 *
 * @returns the carrier, or null for a row the host drew outside a call row.
 */
export function rowCarrier(element: HTMLElement) {
  return element.closest(CHAT_CALL_SELECTOR)
}

/** The earlier of two rows first, by document order. */
export function byDocumentOrder(a: FileMergeRow, b: FileMergeRow) {
  if (a.element === b.element) return 0
  return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1
}

/**
 * Read every registered row's group.
 *
 * @param rows - the registered rows.
 * @returns each registered row's element → the view it draws.
 */
export function mergeViews(rows: readonly FileMergeRow[]) {
  const groups = new Map<Element, Map<string, FileMergeRow[]>>()
  for (const row of rows) {
    const container = rowContainer(row.element)
    if (container === null) continue
    let byPath = groups.get(container)
    if (byPath === undefined) {
      byPath = new Map()
      groups.set(container, byPath)
    }
    const members = byPath.get(row.path)
    if (members === undefined) byPath.set(row.path, [row])
    else members.push(row)
  }
  const views = new Map<HTMLElement, FileMergeView>()
  for (const byPath of groups.values()) {
    for (const members of byPath.values()) {
      const ordered = [...members].sort(byDocumentOrder)
      // One group shares one hunk list: the tail and the diff card both read it,
      // so the numbers can never disagree with the card.
      const hunks = ordered.flatMap((member) => [...member.hunks])
      const running = ordered.some((member) => member.state === 'running')
      ordered.forEach((member, at) => {
        views.set(member.element, { head: at === 0, count: ordered.length, hunks, running })
      })
    }
  }
  return views
}

/**
 * The registry one install owns: rows put themselves in, their views are read
 * back out. The views are rebuilt whole on every change and each one stands
 * until the next change, which is the stable snapshot a React subscriber reads
 * between renders.
 */
export function createFileMerge() {
  const rows = new Map<HTMLElement, FileMergeRow>()
  const listeners: (() => void)[] = []
  let views = new Map<HTMLElement, FileMergeView>()

  const rebuild = () => {
    views = mergeViews([...rows.values()])
    notifyAll(listeners)
  }

  return {
    /** The view one row draws, or null while it is not registered. */
    viewFor(element: HTMLElement | null) {
      return element === null ? null : views.get(element) ?? null
    },
    /**
     * Register one row, replacing what the same element registered before.
     * @returns the unregister: it takes this row out while the element still holds it.
     */
    put(row: FileMergeRow) {
      rows.set(row.element, row)
      rebuild()
      return () => {
        if (rows.get(row.element) !== row) return
        rows.delete(row.element)
        rebuild()
      }
    },
    /** Hear about every change; returns the unsubscriber. */
    subscribe(listener: () => void) {
      listeners.push(listener)
      return () => {
        const at = listeners.indexOf(listener)
        if (at !== -1) listeners.splice(at, 1)
      }
    },
  }
}
