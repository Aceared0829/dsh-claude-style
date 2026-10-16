import { observeSize } from '../core/bus'

/**
 * The sliding highlight of a segmented control: one pseudo-element on the
 * control (shared/sliding-pill.css) that travels to the active item,
 * instead of each item fading its own background out and the next one in.
 * Every segmented control in the skin places it through this one factory, so
 * they share one feel.
 *
 * The attribute and the first placement land in the same call: the
 * pseudo-element does not exist before it, so the pill appears in place and
 * only later moves slide. The whole box is measured, so a control that wraps
 * onto two lines still lands the pill on the item's own line. Font loading
 * changes widths with no DOM mutation, hence the ResizeObserver. Reduced
 * motion does not stop the slide; the movement is required of the control.
 *
 * @param activeSelector - the active item, relative to the control.
 * @returns `{ measure(control), sync(control), release() }`: `measure` takes
 *   the reading in the pass's read phase and `sync` places the pill from it in
 *   the write phase; a `sync` whose pass took no reading measures then, which
 *   is what a control built during the write phase needs. A different control
 *   takes the placement off the previous one, null just takes it off;
 *   `release` takes it off and stops watching.
 */
export function createSlidingPill(activeSelector: string) {
  const PILL_ATTR = 'data-dsh-claude-pill'
  let control: HTMLElement | null = null
  /** The last written box, so an unchanged placement writes nothing. */
  let lastX: number | null = null
  let lastY: number | null = null
  let lastW: number | null = null
  let lastH: number | null = null
  /** Stops watching the current control's size. */
  let stopSize: (() => void) | null = null
  /** What the read phase measured: the item's box against the control's. */
  let reading: { x: number, y: number, w: number, h: number } | null = null
  /** The control that reading belongs to, and whether a pass took one. */
  let measured: HTMLElement | null = null
  let taken = false

  function clear(el: HTMLElement) {
    el.removeAttribute(PILL_ATTR)
    el.style.removeProperty('--dsh-claude-pill-x')
    el.style.removeProperty('--dsh-claude-pill-y')
    el.style.removeProperty('--dsh-claude-pill-w')
    el.style.removeProperty('--dsh-claude-pill-h')
    lastX = null
    lastY = null
    lastW = null
    lastH = null
  }

  /** The pass's read phase: where the active item sits inside the control. */
  function measure(next: HTMLElement | null) {
    taken = true
    measured = next
    if (next === null) {
      reading = null
      return
    }
    const active = next.querySelector(activeSelector)
    const box = next.getBoundingClientRect()
    const itemBox = active === null ? null : active.getBoundingClientRect()
    if (box.width === 0 || itemBox === null || itemBox.width === 0) {
      reading = null
      return
    }
    reading = {
      x: Math.round((itemBox.left - box.left - next.clientLeft) * 100) / 100,
      y: Math.round((itemBox.top - box.top - next.clientTop) * 100) / 100,
      w: Math.round(itemBox.width * 100) / 100,
      h: Math.round(itemBox.height * 100) / 100,
    }
  }

  /** The write phase: the control's four custom properties, from that reading. */
  function place(next: HTMLElement, measured: { x: number, y: number, w: number, h: number } | null) {
    // A fresh placement is measured here. The control's own feature stamps it in
    // this same task, and those stamps can move it: a reading taken before them
    // would place the pill a step off and slide it there on the next pass. One
    // task computes its styles once, so the values written after the attribute
    // is on are the ones it is first drawn with — no slide.
    const fresh = !next.hasAttribute(PILL_ATTR)
    if (fresh) {
      measure(next)
      measured = reading
    }
    if (measured === null) {
      if (next.hasAttribute(PILL_ATTR)) clear(next)
      return
    }
    const { x, y, w, h } = measured
    if (x === lastX && y === lastY && w === lastW && h === lastH && next.hasAttribute(PILL_ATTR)) return
    lastX = x
    lastY = y
    lastW = w
    lastH = h
    next.style.setProperty('--dsh-claude-pill-x', `${x}px`)
    next.style.setProperty('--dsh-claude-pill-y', `${y}px`)
    next.style.setProperty('--dsh-claude-pill-w', `${w}px`)
    next.style.setProperty('--dsh-claude-pill-h', `${h}px`)
    if (!next.hasAttribute(PILL_ATTR)) next.setAttribute(PILL_ATTR, '')
  }

  function sync(next: HTMLElement | null) {
    // A pass that took its reading places from it; one that did not — the
    // control was built in this frame's write phase — measures here.
    if (!taken || measured !== next) measure(next)
    taken = false
    if (next !== control) {
      if (stopSize !== null) stopSize()
      stopSize = null
      if (control !== null) clear(control)
      control = next
      if (control === null) return
      stopSize = observeSize(control, () => {
        if (control !== null) {
          measure(control)
          taken = false
          place(control, reading)
        }
      })
    }
    if (control === null) return
    place(control, reading)
  }

  function release() {
    if (stopSize !== null) stopSize()
    stopSize = null
    if (control !== null) clear(control)
    control = null
    reading = null
    measured = null
    taken = false
  }

  return { measure, sync, release }
}
