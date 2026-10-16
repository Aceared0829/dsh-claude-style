import { UNTAGGED_SHEET_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { STYLESHEET } from 'virtual:dsh-claude-style/generated'
import { FOREIGN_SHEET_TAG, PACKAGE_NAME, STYLE_ID, STYLE_PLUGIN_CSS } from '../constants'

/** The generation whose copy of each sheet is mounted, by the sheet's element id. */
const mountedGenerations = new Map<string, number>()
/** The last generation handed out, across the sheets. */
let lastGeneration = 0

/**
 * Park a sibling's untagged stylesheet so no package's bookkeeping can take it.
 *
 * The client module system claims every untagged `<style>` in the document
 * for the package whose factory has just materialized (`claimStyles`, reading
 * `style:not([data-plugin])`), and that package's next reload removes every
 * tag carrying its id (`removeOwnedStyles`). A sibling that mounts its sheet
 * from `apply()` — after its own materialization — leaves it untagged, so the
 * next package to materialize would take it into custody and delete it at
 * that package's next reload, stripping the sibling's rules off a page that
 * keeps running. Every untagged sheet that is not this package's own is
 * therefore parked under a resting tag: the tag carries a slash, can never
 * equal a package name, and matches no removal step, so the sibling keeps its
 * sheet — and its own teardown still removes that sheet by reference when its
 * generation ends. Two moments call this, because a sweep never waits for the
 * skin: the module scope of packages/client/src/entry.ts, the only code of ours that runs
 * before the sweep of our own materialization, and the head watch, which sees
 * a sheet arriving after it.
 */
export function parkForeignSheets() {
  const untagged = document.querySelectorAll<HTMLStyleElement>(UNTAGGED_SHEET_SELECTOR)
  for (const el of untagged) {
    if (el.id !== STYLE_ID) el.dataset.plugin = FOREIGN_SHEET_TAG
  }
}

/**
 * Mount one of the skin's stylesheets, once per generation: the theme's own
 * by default, or the surface sheets under their own id (D49).
 *
 * The sheet wears this package's own `data-plugin` and its own
 * `data-plugin-css` from the moment it exists — the claim sweep reads
 * untagged tags alone — so no sibling package's bookkeeping can take it, and
 * it is refreshed in place rather than replaced, so a stale generation's
 * stop can never take a newer generation's sheet away (D9).
 *
 * @param id - the `<style>` element's id.
 * @param text - the sheet.
 * @param pluginCss - the sheet's key in the client module system's bookkeeping.
 * @returns this generation's stop function: it unmounts the sheet unless a
 *          newer generation mounted after it.
 */
export function mountStylesheet(id = STYLE_ID, text = STYLESHEET, pluginCss = STYLE_PLUGIN_CSS) {
  const generation = ++lastGeneration
  mountedGenerations.set(id, generation)
  let sheet = document.getElementById(id)
  if (sheet === null) {
    sheet = document.createElement('style')
    sheet.id = id
    document.head.appendChild(sheet)
  }
  sheet.dataset.plugin = PACKAGE_NAME
  sheet.dataset.pluginCss = pluginCss
  sheet.dataset.skinChrome = id
  if (sheet.textContent !== text) sheet.textContent = text
  return () => {
    if (mountedGenerations.get(id) === generation) sheet.remove()
  }
}
