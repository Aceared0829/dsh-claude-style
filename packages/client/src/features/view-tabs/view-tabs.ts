import { windowsDesktop } from '../../core/desktop-band'
import { createStamp } from '../../shared/dom'
import { VIEW_SWITCH_CLASS } from '../../shared/segment-control'
import { createSlidingPill } from '../../shared/sliding-pill'
import type { HostContext } from '../../core/host'
import type { FeatureUi } from '../../core/feature'
import type manifest from './view-tabs.manifest'

/**
 * The conversation view-tab strip's vertical placement — measured, not guessed.
 *
 * The strip's own row sits below the header's title row, and that title row
 * ALSO carries the header actions (the background-task chip, the workspace /
 * preset picker, the overflow menu, the panel toggle). Whether the strip can
 * rise onto the title's line therefore depends on the window: centred, it fits
 * beside a short title on a wide header and collides with the actions on a
 * narrow one. A fixed offset cannot be right in both cases — this was learned
 * the hard way, with -38px landing the strip on top of the task chip.
 *
 * So the skin measures the boxes and writes ONE custom property,
 * `--dsh-view-tabs-shift`, which the stylesheet turns into the translate. The
 * stylesheet keeps the fallback (its own row); this only lifts the strip when
 * the room above is real — the title and the actions both clear it, and the
 * header's top inset still holds.
 *
 * Windows titlebar mode is the one case where no measurement is needed: the
 * desktop shell marks <html> with `data-windows-titlebar` and the strip is
 * placed fixed in the titlebar row, centred (view-tabs.css). This mirrors that
 * marker onto <body> so the stylesheet can switch, and skips the measured
 * shift entirely there.
 *
 * macOS keeps the measured path. Its shell hands the top of the window to
 * the traffic lights and pads no content around them: the host sets
 * `--dsh-frame-top-clearance: 48px` under `html[data-platform=darwin]` and
 * leaves `--dsh-frame-chrome-top` at 0, so the conversation header keeps its
 * own top inset and draws its first row inside that strip. A fixed strip
 * would land on the title and the header actions; the measured shift already
 * seats it on the row beneath the strip.
 *
 * The strip itself is stamped `data-dsh-view-tabs`, and every strip rule in
 * view-tabs.css keys on that attribute. Finding the strip is a query this pass
 * runs once; as a stylesheet selector (`header:has(tabs) tabs`) it would make
 * the browser re-match the whole document on every DOM change.
 *
 * The strip's active pill slides between tabs (packages/client/src/shared/sliding-pill.ts).
 *
 * @param ctx - client context.
 * @param ui - shared handle table.
 * @returns teardown.
 */
export function install(ctx: HostContext, ui: FeatureUi<typeof manifest>) {
  const STRIP = '[class*="_tabs"]'
  const HEADER = `[class*="_header"]:has(${STRIP})`
  /**
   * The title's TEXT, not its row or cluster: `.titleRow` is a flex row and the
   * cluster takes up the slack, so testing against them reported a clash on
   * every window and the strip never lifted. The crumb is the content-sized
   * element that actually draws the words.
   */
  const TITLE = '[class*="crumbCurrent"], [class*="_crumb"], [class*="titleCluster"]'
  const ACTIONS = '[class*="headerActions"], [class*="headerUtilities"]'
  /** The stylesheet's fallback: the strip's own row, 10px up from y=50. */
  const FALLBACK = -10
  /** The header's own top inset; the lifted strip may not enter it. */
  const TOP_INSET = 8
  /** Breathing room between the lifted strip and whatever shares the line. */
  const CLEARANCE = 6
  let last: number | null = null
  /** The element last was written to: a re-rendered strip must be told again. */
  let lastEl: HTMLElement | null = null
  /** The body marker the stylesheet reads for the fixed titlebar placement. */
  const TITLEBAR_ATTR = 'data-dsh-titlebar-tabs'
  /** Whether the last pass saw the host's Windows titlebar marker. */
  let titlebar = false
  /** The strip mark every strip rule in view-tabs.css keys on. */
  const stripStamp = createStamp<HTMLElement>('data-dsh-view-tabs')
  /** The strip also wears the shared small segment look (shared/segment-control.css): a class, since the look is the control's own, not the mark's. */
  let classedStrip: HTMLElement | null = null
  function classStamp(strip: HTMLElement | null) {
    if (classedStrip !== null && classedStrip !== strip) classedStrip.classList.remove(VIEW_SWITCH_CLASS)
    classedStrip = strip
    if (strip !== null) strip.classList.add(VIEW_SWITCH_CLASS)
  }
  const pill = createSlidingPill('[aria-selected="true"]')

  /**
   * Mirror the host's Windows titlebar marker onto <body>, the way D9 moves
   * structure-sensitive branches from CSS to a JS-written attribute. The
   * observer's attributeFilter is aria-* only, so this write cannot feed
   * itself another pass; value-change only, so an unchanged mode writes
   * nothing.
   */
  function syncTitlebar() {
    const next = windowsDesktop()
    if (next === titlebar) return
    titlebar = next
    if (next) document.body.setAttribute(TITLEBAR_ATTR, '')
    else document.body.removeAttribute(TITLEBAR_ATTR)
  }

  function rect(el: Element | null | undefined) {
    if (el === null || el === undefined) return null
    const box = el.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) return null
    return box
  }

  /**
   * The title's box. `querySelector` on the selector list returns the first
   * match in DOCUMENT order, which is the wrapper (`.titleCluster` contains
   * the crumb) — and the wrapper stretches, so the strip never lifted. Take
   * the narrowest match instead: that is the element drawing the words.
   */
  function titleBoxOf(header: Element) {
    const all = header.querySelectorAll(TITLE)
    let best: DOMRect | null = null
    for (let i = 0; i < all.length; i++) {
      const box = rect(all[i])
      if (box === null) continue
      if (best === null || box.width <= best.width) best = box
    }
    return best
  }

  /**
   * The header holding the strip, and the strip with it.
   *
   * The header is the FIRST `[class*="_header"]` carrying a strip in document
   * order, so a header mounted before the one found last time takes that answer
   * while leaving the old header connected, and a kept one would go on stamping
   * and placing a strip the page no longer reads as the conversation's. The pair
   * is resolved on every pass (D9); the boxes inside it are read once each.
   */
  function findStrip() {
    const header = document.querySelector(HEADER)
    if (header === null) return null
    const strip = header.querySelector<HTMLElement>(STRIP)
    return strip === null ? null : { header, strip }
  }

  function sync() {
    syncTitlebar()
    const found = findStrip()
    if (found === null) {
      stripStamp.mark(null)
      classStamp(null)
      pill.sync(null)
      return
    }
    const { header, strip } = found
    stripStamp.mark(strip)
    classStamp(strip)
    pill.sync(strip)
    // Windows titlebar mode places the strip itself (view-tabs.css): it is
    // fixed there, so neither the measured shift nor the fallback applies.
    if (titlebar) return
    const stripBox = rect(strip)
    if (stripBox === null) return
    const headerBox = rect(header)
    if (headerBox === null) return
    // The strip's own layout position, with the shift we may already have
    // applied taken back out: rect.top moves with the transform.
    let applied = parseFloat(strip.style.getPropertyValue('--dsh-view-tabs-shift'))
    if (!isFinite(applied)) applied = FALLBACK
    const naturalTop = stripBox.top - applied
    const titleBox = titleBoxOf(header)
    let shift = FALLBACK
    if (titleBox !== null) {
      let want = titleBox.top + titleBox.height / 2 - naturalTop - stripBox.height / 2
      // Room above: the lifted strip stays under the header's top inset.
      const top = naturalTop + want
      if (top < headerBox.top + TOP_INSET) want = headerBox.top + TOP_INSET - naturalTop
      // Room sideways: centred, it must clear the title and the actions, the
      // boxes it would share the title's line with.
      const actionsBox = rect(header.querySelector(ACTIONS))
      const clash = [titleBox, actionsBox].some((box) => box !== null && stripBox.right > box.left - CLEARANCE && stripBox.left < box.right + CLEARANCE)
      if (!clash) shift = Math.round(want)
    }
    if (shift === last && strip === lastEl) return
    last = shift
    lastEl = strip
    strip.style.setProperty('--dsh-view-tabs-shift', `${shift}px`)
  }

  ui.viewTabs = { sync }

  return () => {
    if (titlebar) {
      document.body.removeAttribute(TITLEBAR_ATTR)
      titlebar = false
    }
    // The strip the passes wrote to: the placement belongs to the element the
    // last pass held, and the page may have moved on since.
    const strip = stripStamp.current()
    if (strip !== null) strip.style.removeProperty('--dsh-view-tabs-shift')
    pill.release()
    stripStamp.release()
    classStamp(null)
    last = null
    lastEl = null
    delete ui.viewTabs
  }
}
