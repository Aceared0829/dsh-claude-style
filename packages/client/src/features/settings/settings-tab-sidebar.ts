import { BAN_LOCALE_EN, BAN_LOCALE_OFF, BAN_LOCALE_ZH, SEARCH_STYLE_ICON, SEARCH_STYLE_OVERLAY, SEARCH_STYLE_STANDALONE, SIDEBAR_LAYOUT_COMPACT, SIDEBAR_LAYOUT_RELAXED } from '../../constants'
import { settingsCopy } from '../../core/i18n'
import type { SettingsRow, SettingsTab, SettingsView } from './settings-controls'

/**
 * The settings page's Sidebar tab: the footer takeover, the search box and
 * the In progress / Archived view — three feature switches placed here by
 * their manifests (D42) — and the right sidebar's docked panels and the
 * sidebar's own spacing, whose looks belong to no feature
 * (packages/client/src/theme/sidebar.css, theme/chrome.css), so the tab writes
 * those two rows itself.
 *
 * Two sub-rows follow a switch and are written here, since a manifest carries
 * one row: the account-hold easter egg under the footer takeover, whose
 * account popover holds the row that opens it, and the search box's style
 * under the search box. Each is disabled while the row above it is off.
 */
export function createSettingsSidebarTab(): SettingsTab {
  const rows = (view: SettingsView): SettingsRow[] => {
    const prefs = view.prefs
    const write = view.write
    const controls = view.controls
    const footerOn = prefs.collapseFooter !== false
    const banOptions = [
      { value: BAN_LOCALE_OFF, label: settingsCopy('banLocaleOff', 'Off') },
      { value: BAN_LOCALE_ZH, label: settingsCopy('banLocaleZh', '中文') },
      { value: BAN_LOCALE_EN, label: settingsCopy('banLocaleEn', 'English') },
    ]
    const searchOn = prefs.sidebarSearch !== false
    const searchStyleOptions = [
      { value: SEARCH_STYLE_ICON, label: settingsCopy('searchStyleIcon', 'Icon') },
      { value: SEARCH_STYLE_OVERLAY, label: settingsCopy('searchStyleOverlay', 'Cover the brand') },
      { value: SEARCH_STYLE_STANDALONE, label: settingsCopy('searchStyleStandalone', 'Standalone') },
    ]
    const layoutOptions = [
      { value: SIDEBAR_LAYOUT_RELAXED, label: settingsCopy('sidebarLayoutRelaxed', 'Relaxed') },
      { value: SIDEBAR_LAYOUT_COMPACT, label: settingsCopy('sidebarLayoutCompact', 'Compact') },
    ]
    return [
      {
        rank: 15,
        node: controls.subRow(
          'banLocale',
          settingsCopy('banLocaleTitle', 'Account-hold easter egg'),
          settingsCopy('banLocaleDesc', 'The account row in the account popover opens a replica of Claude\'s account-hold page, in the language chosen here; Off leaves a plain name.'),
          controls.segment(banOptions, prefs.banLocale, value => { write({ banLocale: value }) }, !footerOn),
          footerOn,
        ),
      },
      {
        rank: 30,
        node: controls.subRow(
          'searchStyle',
          settingsCopy('searchStyleTitle', 'Search box style'),
          settingsCopy('searchStyleDesc', 'Where the search box stands: over the brand, on a row of its own, or as the host\'s own search icon.'),
          controls.segment(searchStyleOptions, prefs.searchStyle, value => { write({ searchStyle: value }) }, !searchOn),
          searchOn,
        ),
      },
      {
        rank: 40,
        node: controls.row(
          'dockCards',
          settingsCopy('dockCardsTitle', 'Float docked panels'),
          settingsCopy('dockCardsDesc', 'Draws the right sidebar\'s docked panels as floating cards; Off fills the column edge to edge.'),
          view.controls.toggle(view.prefs.dockCards !== false, value => { view.write({ dockCards: value }) }),
        ),
      },
      {
        rank: 50,
        node: controls.row(
          'sidebarLayout',
          settingsCopy('sidebarLayoutTitle', 'Sidebar layout'),
          settingsCopy('sidebarLayoutDesc', 'How tight the sidebar is: Relaxed is the default look; Compact trims row heights, gaps and padding.'),
          controls.segment(layoutOptions, prefs.sidebarLayout, value => { write({ sidebarLayout: value }) }),
        ),
      },
    ]
  }
  return { id: 'sidebar', label: () => settingsCopy('tabSidebar', 'Sidebar'), rows }
}
