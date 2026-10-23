import { SEARCH_STYLE_ICON, SEARCH_STYLE_STANDALONE } from '../../constants'
import { findSidebarBrand, findSidebarLogoRow, hostShortcuts } from '@dsh-claude-style/engine/host'
import { readPrefs } from '../../core/prefs'
import { buildElement, createStamp, setAttributeIfChanged } from '@dsh-claude-style/engine/dom'
import type { HostContext } from '@dsh-claude-style/engine/host'
import { copy } from './copy'

/**
 * The search box in the sidebar: where it stands under the style in force.
 * The `icon` style places nothing of the skin's (the host's own button keeps
 * its seat); `overlay` and `standalone` share the box and differ in what holds
 * it — the host's logo row, or the skin's own row under it — and in the
 * collapsed rail the box moves to the seat the rail has for it. The press
 * opens the palette through `onOpen` (search.ts).
 */
export function createSearchTrigger(ctx: HostContext, onOpen: () => void) {
  /** The sidebar box, and the logo row it was placed in. */
  let trigger: HTMLButtonElement | null = null
  const rowStamp = createStamp('data-dsh-claude-search-row')
  /** The box's own row in the `standalone` style, under the brand row. */
  let bar: HTMLElement | null = null

  function buildTrigger() {
    const button = buildElement('button', 'dsh-claude-search-trigger')
    button.type = 'button'
    const icon = buildElement('span', 'dsh-claude-search-trigger-icon')
    icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="M10.4 10.4 13.5 13.5"/></svg>'
    button.appendChild(icon)
    button.appendChild(buildElement('span', 'dsh-claude-search-trigger-label'))
    button.appendChild(buildElement('span', 'dsh-claude-search-keys'))
    button.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      onOpen()
    })
    return button
  }

  /** Take the box and its own row off the page, giving the host's brand row back. */
  function dropTrigger() {
    if (trigger !== null && trigger.parentElement !== null) trigger.parentElement.removeChild(trigger)
    if (bar !== null && bar.parentElement !== null) bar.parentElement.removeChild(bar)
    rowStamp.release()
  }

  /**
   * Place the box for the style in force. The `icon` style places nothing of
   * the skin's; `overlay` and `standalone` share the box and differ in what
   * holds it — the host's logo row, or the skin's own row under it. In the
   * collapsed rail the host keeps no wide brand at all, and the box moves to the
   * seat the rail has for it.
   *
   * The sidebar's brand row is read through the host access module, which
   * keeps the answer while the element stays the first match (D40).
   */
  function syncTrigger() {
    const brand = findSidebarBrand()
    const row = brand === null ? null : brand.parentElement
    const style = readPrefs().searchStyle
    if (style === SEARCH_STYLE_ICON) {
      dropTrigger()
      return
    }
    if (brand === null || row === null) {
      seatRailTrigger()
      return
    }
    if (trigger === null) trigger = buildTrigger()
    if (style === SEARCH_STYLE_STANDALONE) {
      if (bar === null) bar = buildElement('div', 'dsh-claude-search-bar')
      // The box's row stands under the brand row, in the sidebar's own list;
      // the host may re-render around it, so the pass re-seats it.
      if (bar.parentElement !== row.parentElement || bar.previousElementSibling !== row) row.after(bar)
      if (trigger.parentElement !== bar) bar.appendChild(trigger)
      rowStamp.release()
    } else {
      if (bar !== null && bar.parentElement !== null) bar.parentElement.removeChild(bar)
      if (trigger.parentElement !== row) row.insertBefore(trigger, brand.nextSibling)
      rowStamp.mark(row)
    }
    syncTriggerText()
  }

  /**
   * The collapsed rail's seat: the rail keeps its top row for the mark and
   * drops the wide brand, and the column is as wide as one icon. The box takes
   * a row of its own under the mark — the wide order of brand row, box, New
   * session kept — and stands there as the rail's icon button (search.css).
   * No row of the skin's: the rail's own rhythm is what steps between them.
   */
  function seatRailTrigger() {
    const seat = findSidebarLogoRow()
    if (seat === null) {
      dropTrigger()
      return
    }
    if (trigger === null) trigger = buildTrigger()
    if (bar !== null && bar.parentElement !== null) bar.parentElement.removeChild(bar)
    // The host re-renders around the box as the rail settles; the pass re-seats
    // it against the mark's row rather than trusting last pass's parent.
    if (trigger.parentElement !== seat.parentElement || trigger.previousElementSibling !== seat) seat.after(trigger)
    rowStamp.release()
    syncTriggerText()
  }

  /** The box's word, its accessible name and its shortcut, in every seat it takes. */
  function syncTriggerText() {
    if (trigger === null) return
    const label = copy('searchPlaceholder')
    const text = trigger.children[1]
    if (text.textContent !== label) text.textContent = label
    setAttributeIfChanged(trigger, 'aria-label', label)
    syncTriggerKeys(trigger.children[2])
  }

  /**
   * The host's search shortcut on the box's right, as the palette's action
   * rows show theirs; it follows a rebinding, and a shortcut left unbound
   * shows no caps.
   */
  let triggerKeys: string | null = null
  function syncTriggerKeys(group: Element) {
    const shortcuts = hostShortcuts(ctx)
    let keys: string[] = []
    if (shortcuts) {
      const rows = shortcuts.catalog.getSnapshot()
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].id === 'session.search') keys = rows[i].keys.filter((key: string) => key !== '+')
      }
    }
    const joined = keys.join('\n')
    if (joined === triggerKeys && group.childNodes.length === keys.length) return
    triggerKeys = joined
    while (group.firstChild) group.removeChild(group.firstChild)
    for (let k = 0; k < keys.length; k++) group.appendChild(buildElement('kbd', 'dsh-claude-search-key', keys[k]))
  }

  return {
    /** Place or re-seat the box for the style in force. */
    sync: syncTrigger,
    /** Take the box and its row off the page. */
    drop: dropTrigger,
  }
}
