import { SIDEBAR_LAYOUT_COMPACT, SIDEBAR_LAYOUT_RELAXED } from '../../constants'
import type { SegmentOption, SettingsRow, SettingsTab, SettingsView } from './settings-controls'
import type { Prefs } from '../../constants'
import { copy } from './copy'

/**
 * The settings page's Sidebar tab: the right sidebar's docked panels and the
 * sidebar's own spacing, whose looks belong to no feature
 * (packages/client/src/theme/sidebar.css, theme/chrome.css), so the tab writes
 * those two rows itself. The footer takeover, the account-hold language, the
 * search box with its style and the In progress / Archived view are the
 * features' own rows, placed here by their manifests (D72).
 */
export function createSettingsSidebarTab(): SettingsTab {
  const rows = (view: SettingsView): SettingsRow[] => {
    const prefs = view.prefs
    const write = view.write
    const controls = view.controls
    const layoutOptions: SegmentOption<Prefs['sidebarLayout']>[] = [
      { value: SIDEBAR_LAYOUT_RELAXED, label: copy('sidebarLayoutRelaxed') },
      { value: SIDEBAR_LAYOUT_COMPACT, label: copy('sidebarLayoutCompact') },
    ]
    return [
      {
        rank: 40,
        node: controls.row(
          'dockCards',
          copy('dockCardsTitle'),
          null,
          view.controls.toggle(view.prefs.dockCards !== false, value => { view.write({ dockCards: value }) }),
        ),
      },
      {
        rank: 50,
        node: controls.row(
          'sidebarLayout',
          copy('sidebarLayoutTitle'),
          null,
          controls.segment(layoutOptions, prefs.sidebarLayout, value => { write({ sidebarLayout: value }) }),
        ),
      },
    ]
  }
  return { id: 'sidebar', label: () => copy('tabSidebar'), rows }
}
