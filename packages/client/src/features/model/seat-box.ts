/**
 * The box the composer's two seat texts share: the model's name and the effort
 * level's.
 *
 * The host's own seat is one button carrying both texts; the skin needs two hit
 * areas — the model list and the effort card are two decisions with two cards —
 * and a button cannot hold a button. So one element holds both and the row lays
 * it out as a single item: it sits against the row's right end and grows
 * leftward as either text widens, which is what lets both cards hang from its
 * right edge and stand still while a level's name changes.
 *
 * The node is the skin's own, so the two features may put their buttons inside
 * it; the host's slot above it stays React's.
 */
export const SEAT_BOX_CLASS = 'dsh-claude-model-seat'

/** The seat box already in the slot, or a fresh one appended to it. */
export function ensureSeatBox(slot: HTMLElement, current: HTMLElement | null): HTMLElement {
  if (current !== null && current.parentElement === slot) return current
  if (current !== null && current.parentElement !== null) current.parentElement.removeChild(current)
  const box = document.createElement('div')
  box.className = SEAT_BOX_CLASS
  slot.appendChild(box)
  return box
}
