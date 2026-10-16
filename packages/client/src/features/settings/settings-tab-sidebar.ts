import { BAN_LOCALE_EN, BAN_LOCALE_OFF, BAN_LOCALE_ZH, SEARCH_STYLE_ICON, SEARCH_STYLE_OVERLAY, SEARCH_STYLE_STANDALONE, SIDEBAR_LAYOUT_COMPACT, SIDEBAR_LAYOUT_RELAXED } from '../../constants'
import type { SegmentOption, SettingsRow, SettingsTab, SettingsView } from './settings-controls'
import type { Prefs } from '../../constants'
import { copy } from './copy'

/**
 * The settings page's Sidebar tab: the search box and the In progress /
 * Archived view — feature switches placed here by their manifests (D72) — and
 * the right sidebar's docked panels and the sidebar's own spacing, whose looks
 * belong to no feature (packages/client/src/theme/sidebar.css, theme/chrome.css),
 * so the tab writes those two rows itself.
 *
 * One sub-row follows a switch and is written here, since a manifest carries
 * one row: the search box's style under the search box, disabled while the box
 * itself is off.
 */
export function createSettingsSidebarTab(): SettingsTab {
  const rows = (view: SettingsView): SettingsRow[] => {
    const prefs = view.prefs
    const write = view.write
    const controls = view.controls
    const searchOn = prefs.sidebarSearch !== false
    const searchStyleOptions: SegmentOption<Prefs['searchStyle']>[] = [
      { value: SEARCH_STYLE_ICON, label: copy('searchStyleIcon') },
      { value: SEARCH_STYLE_OVERLAY, label: copy('searchStyleOverlay') },
      { value: SEARCH_STYLE_STANDALONE, label: copy('searchStyleStandalone') },
    ]
    const layoutOptions: SegmentOption<Prefs['sidebarLayout']>[] = [
      { value: SIDEBAR_LAYOUT_RELAXED, label: copy('sidebarLayoutRelaxed') },
      { value: SIDEBAR_LAYOUT_COMPACT, label: copy('sidebarLayoutCompact') },
    ]
    return [
      {
        rank: 30,
        node: controls.subRow(
          'searchStyle',
          copy('searchStyleTitle'),
          copy('searchStyleDesc'),
          controls.segment(searchStyleOptions, prefs.searchStyle, value => { write({ searchStyle: value }) }, !searchOn),
          searchOn,
        ),
      },
      {
        rank: 40,
        node: controls.row(
          'dockCards',
          copy('dockCardsTitle'),
          copy('dockCardsDesc'),
          view.controls.toggle(view.prefs.dockCards !== false, value => { view.write({ dockCards: value }) }),
        ),
      },
      {
        rank: 50,
        node: controls.row(
          'sidebarLayout',
          copy('sidebarLayoutTitle'),
          copy('sidebarLayoutDesc'),
          controls.segment(layoutOptions, prefs.sidebarLayout, value => { write({ sidebarLayout: value }) }),
        ),
      },
    ]
  }
  return { id: 'sidebar', label: () => copy('tabSidebar'), rows }
}
