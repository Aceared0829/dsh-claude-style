import { RIGHTBAR_COLUMN_SELECTOR, RIGHTBAR_HANDLE_SELECTOR, RIGHTBAR_PANEL_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { subscribeMutations } from '@dsh-claude-style/engine/bus'
import { PAGE_ZOOM_ATTR } from '../../constants'
import { pageZoomFactor } from '../../shared/page-zoom'

/**
 * The right column's own box, in the page's pixels.
 *
 * The host states the panel's width from the viewport's pixels and places the
 * drag handle from the same measurement, while the page's zoom scales both a
 * second time: the panel stands wider than the track the frame gives it and
 * covers the centre, and the handle leaves the edge it exists to drag. The
 * frame's own columns are carried by the page-scale module; these two
 * declarations are rewritten here, each on the write the host makes, and a page
 * at scale 1 keeps the host's numbers.
 */

interface Held {
  raw: string
  written: string
}

/** Trim a computed page length to the shape a CSS declaration keeps. */
function length(value: number) {
  return `${Math.round(value * 100) / 100}px`
}

export function install() {
  const held = new Map<HTMLElement, Map<string, Held>>()
  let panel: HTMLElement | null = null
  let handle: HTMLElement | null = null
  const stops: (() => void)[] = []
  let queued = false

  function apply(element: HTMLElement, property: string, raw: string, next: string) {
    const own = held.get(element)
    if (next === raw) {
      if (own !== undefined) {
        own.delete(property)
        if (own.size === 0) held.delete(element)
      }
      return
    }
    element.style.setProperty(property, next)
    const map = own ?? new Map<string, Held>()
    map.set(property, { raw, written: next })
    held.set(element, map)
  }

  function restore() {
    for (const [element, declarations] of held) {
      for (const [property, record] of declarations) {
        if (element.style.getPropertyValue(property) === record.written) element.style.setProperty(property, record.raw)
      }
    }
    held.clear()
  }

  /** The host's own value, unwrapping this feature's write while it still stands. */
  function hostValue(element: HTMLElement, property: string, current: string) {
    const record = held.get(element)?.get(property)
    return record !== undefined && record.written === current ? record.raw : current
  }

  function fixPanel(factor: number) {
    if (panel === null) return
    const current = panel.style.getPropertyValue('width').trim()
    if (!current.endsWith('px')) return
    const raw = hostValue(panel, 'width', current)
    const width = Number.parseFloat(raw)
    if (!Number.isFinite(width)) return
    // The column the grid gives this panel is its ceiling: a panel wider than
    // its own track stands over the centre, and a track narrowed to nothing
    // leaves the panel with no room to stand in at all. A column that has not
    // been given a width yet (the panel mounts before the grid expands) says
    // nothing, so the host's own value stands until the track is there.
    const column = document.querySelector<HTMLElement>(RIGHTBAR_COLUMN_SELECTOR)
    const limit = column === null || column.clientWidth <= 0 ? Number.POSITIVE_INFINITY : column.clientWidth
    const page = length(Math.min(width / factor, limit))
    apply(panel, 'width', raw, page)
    apply(panel, '--dsh-sidebar-width', raw, page)
  }

  function fixHandle(factor: number) {
    if (handle === null || panel === null) return
    const current = handle.style.getPropertyValue('left').trim()
    if (!current.endsWith('px')) return
    const raw = hostValue(handle, 'left', current)
    const left = Number.parseFloat(raw)
    if (!Number.isFinite(left)) return
    // The handle sits on the panel's visible left edge, which is the width the
    // panel actually took rather than the one the host wrote for it.
    const page = length(document.documentElement.clientWidth / factor - panel.offsetWidth)
    apply(handle, 'left', raw, page)
  }

  function sync() {
    queued = false
    const nextPanel = document.querySelector<HTMLElement>(RIGHTBAR_PANEL_SELECTOR)
    const nextHandle = document.querySelector<HTMLElement>(RIGHTBAR_HANDLE_SELECTOR)
    if (nextPanel !== panel || nextHandle !== handle) {
      for (const stop of stops.splice(0)) stop()
      panel = nextPanel
      handle = nextHandle
      for (const element of [panel, handle]) {
        if (element !== null) stops.push(subscribeMutations(element, { attributes: true, attributeFilter: ['style'] }, schedule))
      }
    }
    const factor = pageZoomFactor()
    if (factor === 1) {
      restore()
      return
    }
    fixPanel(factor)
    fixHandle(factor)
  }

  function schedule() {
    if (queued) return
    queued = true
    // A microtask keeps the rewrite ahead of the frame the host's write would paint.
    queueMicrotask(sync)
  }

  schedule()
  const stopBody = subscribeMutations(document.body, { childList: true }, schedule)
  // The factor rides an attribute on the body, so a change of zoom re-derives both.
  const stopZoom = subscribeMutations(document.body, { attributes: true, attributeFilter: [PAGE_ZOOM_ATTR] }, schedule)
  // The panel mounts inside the frame, not under the body: the child list of the
  // body does not hear it, so the look is repeated while the page is scaled.
  const timer = setInterval(schedule, 500)

  return () => {
    clearInterval(timer)
    stopBody()
    stopZoom()
    for (const stop of stops.splice(0)) stop()
    restore()
  }
}
