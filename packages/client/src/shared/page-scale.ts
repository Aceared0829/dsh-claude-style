import { installScaledLayer } from '@dsh-claude-style/engine/page-scale'
import { subscribePrefs } from '../core/prefs'
import { pageViewport, pageZoomFactor } from './page-zoom'

/**
 * Whether a node is one the skin places itself: it carries one of the skin's own
 * classes, or one of the marks the skin stamps onto a host node it manages. The
 * host's own floating cards carry neither, and the host elements the skin places
 * — the context panel among them — are written in the page's own pixels by the
 * skin and must not be given the host's space back.
 */
function isSkinNode(node: Element) {
  if (/(^| )dsh-claude-/.test(typeof node.className === 'string' ? node.className : '')) return true
  return Array.from(node.attributes).some(attribute => attribute.name.startsWith('data-dsh-claude-'))
}

/**
 * The page's own size, as custom properties (D81).
 *
 * A `vh` or a `vw` inside the scaled page is the window's size multiplied by the
 * scale again (theme/chrome.css), so a card capped with one comes out taller or
 * wider than the window it was capped against. These two carry the window in the
 * page's own pixels, which is what a cap written into the page needs; a rule
 * reads each with its own viewport unit as the fallback.
 */
export const PAGE_HEIGHT = '--dsh-claude-page-height'
export const PAGE_WIDTH = '--dsh-claude-page-width'

/**
 * Carry the host's floating layer in a page the skin draws at a scale, and put
 * the page's own size where a stylesheet can cap a card with it
 * (engine/src/page-scale.ts, D81).
 *
 * The skin's own cards are excluded from the carried layer: they are placed in
 * the page's own pixels at the write, so they carry no double scale. The
 * reader's choice of factor moves every card already carried, and the teardown
 * hands each one back.
 *
 * @returns the teardown.
 */
export function installPageScale() {
  const layer = installScaledLayer({
    isOwn: isSkinNode,
    scale: () => pageZoomFactor(),
  })
  const body = document.body
  /** Write the page's own size, or take it away while the page is not scaled. */
  const measure = () => {
    if (pageZoomFactor() === 1) {
      body.style.removeProperty(PAGE_HEIGHT)
      body.style.removeProperty(PAGE_WIDTH)
      return
    }
    const view = pageViewport()
    body.style.setProperty(PAGE_HEIGHT, `${Math.round(view.height)}px`)
    body.style.setProperty(PAGE_WIDTH, `${Math.round(view.width)}px`)
  }
  const sync = () => {
    measure()
    layer.settle()
  }
  const offPrefs = subscribePrefs(sync)
  sync()
  return () => {
    offPrefs()
    body.style.removeProperty(PAGE_HEIGHT)
    body.style.removeProperty(PAGE_WIDTH)
    layer.stop()
  }
}
