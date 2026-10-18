/**
 * The room the reasoning-effort trigger reserves beside the model trigger.
 *
 * The effort trigger is mounted on the body and pinned from the model trigger's
 * box, so the picker reserves its own width on that trigger's right edge — a
 * margin, which shifts the model trigger's label left and leaves the trigger
 * standing in the space the label gave up. A margin makes the row wider, and a
 * row with slack absorbs that; one without — the window narrowed, a long model
 * name — is pushed past the card's edge by it, which is the row's horizontal
 * scrollbar and a trigger pinned from a box outside the card.
 *
 * So the row is asked first: where its content no longer fits, the model name
 * gives up exactly the overflow. Its cap and the margin together leave the row
 * the width it had, and the name takes the truncation a narrow card already
 * asks of it. The cap has to come off for the name's own width to be read, so
 * this runs where the seat settles — a new label, a viewport or card change —
 * and the passes between keep what it found.
 */

/** The composer row the seat's controls share: the width the reserve has to fit in. */
export const EFFORT_ROW_SELECTOR = '[data-dsh-claude-part~="row"]'

/**
 * Reserve `need` pixels on the model trigger's right edge, out of the row's
 * slack where there is any and out of the model name where there is not, and
 * return the model trigger's box as it stands after the writes.
 */
export function reserveEffortRoom(modelBtn: HTMLElement, need: number): DOMRect {
  if (modelBtn.style.maxWidth !== '') modelBtn.style.maxWidth = ''
  if (modelBtn.style.marginRight !== `${need}px`) modelBtn.style.marginRight = `${need}px`
  const row = modelBtn.closest(EFFORT_ROW_SELECTOR)
  if (row !== null && row.scrollWidth > row.clientWidth) {
    const over = row.scrollWidth - row.clientWidth
    modelBtn.style.maxWidth = `${Math.max(0, Math.round(modelBtn.getBoundingClientRect().width - over))}px`
  }
  return modelBtn.getBoundingClientRect()
}

/** Hand the reserved room back — the cap and the margin both. */
export function releaseEffortRoom(modelBtn: HTMLElement): void {
  if (modelBtn.style.maxWidth !== '') modelBtn.style.maxWidth = ''
  if (modelBtn.style.marginRight !== '') modelBtn.style.marginRight = ''
}
