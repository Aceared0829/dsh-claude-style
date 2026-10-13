import { windowsDesktop } from '../../core/desktop-band'
import { settingsCopy } from '../../core/i18n'
import type { SettingsTab } from './settings-controls'

/**
 * The settings page's Desktop tab: what the skin does to the Windows desktop
 * window alone. Its rows are feature switches placed here by their manifests
 * (D42), so the tab writes none itself.
 *
 * The preferences live in the host's settings document, shared by every page
 * of the instance, so the rows stay usable on a page that is not the Windows
 * window (the browser, the macOS window): there the tab opens with a line
 * saying the change shows in the Windows window.
 */
export function createSettingsDesktopTab(): SettingsTab {
  return {
    id: 'desktop',
    label: () => settingsCopy('tabDesktop', 'Desktop'),
    rows: () => [],
    notice() {
      if (windowsDesktop()) return null
      return settingsCopy('desktopNotice', 'These settings act on the Windows desktop window only. This page is not that window, so a change made here shows there.')
    },
  }
}
