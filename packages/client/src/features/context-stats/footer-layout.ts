import { COMPOSER_ATTR, STATS_POSITION_FOOTER } from '../../constants'
import { readPrefs } from '../../core/prefs'
import { COMPOSER_STACK, findComposerCard, findComposerStats } from '@dsh-claude-style/engine/host'
import { requestFrame } from '@dsh-claude-style/engine/frame'
import { setAttributeIfChanged } from '@dsh-claude-style/engine/dom'
import { inPageBox } from '../../shared/page-zoom'

export const FOOTER_DOCK_ATTR = 'data-dsh-claude-footer-dock'
export const FOOTER_LINE_ATTR = 'data-dsh-claude-footer-line'

/** Older hosts mark a stats container; newer ones mark each figure in the dock. */
export function findStatsDock() {
  return findComposerStats()?.closest<HTMLElement>('[data-dsh-claude-part~="composer-dock"]') ?? null
}

/** The host dock keeps its React parent; only its containing box is positioned. */
export function createFooterLayout() {
  let dock: HTMLElement | null = null
  let line: HTMLElement | null = null
  let cancel: (() => void) | null = null
  const properties = ['--dsh-claude-footer-left', '--dsh-claude-footer-bottom', '--dsh-claude-footer-height']

  function clear() {
    cancel?.()
    cancel = null
    line?.removeAttribute(FOOTER_LINE_ATTR)
    if (dock !== null) {
      dock.removeAttribute(FOOTER_DOCK_ATTR)
      for (const property of properties) dock.style.removeProperty(property)
    }
    dock = null
    line = null
  }

  function sync(root: HTMLElement) {
    if (readPrefs().statsPosition !== STATS_POSITION_FOOTER || !document.body.hasAttribute(COMPOSER_ATTR)) {
      clear()
      return
    }
    if (line !== root) line?.removeAttribute(FOOTER_LINE_ATTR)
    line = root
    setAttributeIfChanged(root, FOOTER_LINE_ATTR, '')
    if (cancel !== null) return
    let measured: { dock: HTMLElement, mode: string, left: number, bottom: number, height: number } | null = null
    cancel = requestFrame({
      read() {
        const card = findComposerCard()
        const nextDock = findStatsDock()
        const row = card?.querySelector<HTMLElement>('[data-dsh-claude-part~="trailing"]')?.parentElement
        const stack = card?.closest<HTMLElement>(COMPOSER_STACK)
        if (!nextDock || !row || !stack || !root.isConnected) return
        const tools = row.querySelector<HTMLElement>('[data-dsh-claude-part~="tools"]')
        const trailing = row.querySelector<HTMLElement>('[data-dsh-claude-part~="trailing"]')
        const meter = nextDock.querySelector<HTMLElement>('[data-dsh-claude-context-meter]')
        // The room the meter takes beside the line, its gap included: the gap is
        // the dock's own, so the footer stands apart exactly like the line on its
        // own line.
        const gap = Number.parseFloat(getComputedStyle(nextDock).columnGap) || 0
        const rowBox = inPageBox(row.getBoundingClientRect())
        const stackBox = inPageBox(stack.getBoundingClientRect())
        const start = tools ? inPageBox(tools.getBoundingClientRect()).right + 12 : rowBox.left
        const end = trailing ? inPageBox(trailing.getBoundingClientRect()).left - 12 : rowBox.right
        const width = inPageBox(root.getBoundingClientRect()).width + (meter ? inPageBox(meter.getBoundingClientRect()).width + gap : 0)
        const align = readPrefs().statsFooterAlign
        const left = align === 'left' ? start : align === 'right' ? end - width : (start + end - width) / 2
        measured = {
          dock: nextDock,
          mode: width <= end - start ? 'overlay' : 'below',
          left: Math.max(start, left) - stackBox.left,
          bottom: stackBox.bottom - rowBox.bottom,
          height: rowBox.height,
        }
      },
      write() {
        cancel = null
        if (measured === null) {
          clear()
          return
        }
        if (dock !== measured.dock) {
          clear()
          line = root
          setAttributeIfChanged(root, FOOTER_LINE_ATTR, '')
          dock = measured.dock
        }
        setAttributeIfChanged(dock, FOOTER_DOCK_ATTR, measured.mode)
        const values = [measured.left, measured.bottom, measured.height]
        for (let i = 0; i < properties.length; i++) {
          const value = `${Math.round(values[i] * 100) / 100}px`
          if (dock.style.getPropertyValue(properties[i]) !== value) dock.style.setProperty(properties[i], value)
        }
      },
    })
  }
  return { sync, clear }
}
