import { COMPOSER_INPUT_SELECTOR } from '@dsh-claude-style/contracts/dom'

/**
 * The composer's selection, carried across the two focus moves the skin makes
 * itself.
 *
 * The composer input is the host's contenteditable editor, and the document
 * selection is the reader's caret. A bare `focus()` re-homes that selection:
 * the caret lands at the start of the draft, and the editor's own stored
 * selection does not put it back. The inline card's press and the process
 * fold's programmatic header toggle both take the focus away and hand it back,
 * so both carry the range across whatever the move itself does.
 */

/**
 * The composer's live caret or selection.
 * @param doc - the document to read; the page's own by default.
 * @returns a copy of the range while a composer input holds it, else null.
 */
export function captureComposerCaret(doc: Document = document): Range | null {
  const selection = doc.getSelection()
  if (selection === null || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  const start = range.startContainer
  const composer = start instanceof Element
    ? start.closest(COMPOSER_INPUT_SELECTOR)
    : start.parentElement?.closest(COMPOSER_INPUT_SELECTOR) ?? null
  if (composer === null) return null
  return range.cloneRange()
}

/**
 * Focus `el`, then put a captured composer caret back.
 *
 * The restore only happens when the range stands inside the element being
 * focused: a press that gives the focus to a control elsewhere leaves the
 * composer's selection where it was. A range the editor has already replaced
 * is dropped with it.
 * @param el - the element to focus.
 * @param caret - a range from {@link captureComposerCaret}, or null.
 */
export function focusKeepingComposerCaret(el: HTMLElement, caret: Range | null): void {
  el.focus({ preventScroll: true })
  if (caret === null || !el.contains(caret.startContainer)) return
  const selection = el.ownerDocument.getSelection()
  if (selection === null) return
  selection.removeAllRanges()
  selection.addRange(caret)
}
