import { settingsCopy } from '../../core/i18n'
import type { SettingsRow, SettingsTab, SettingsView } from './settings-controls'

/**
 * The settings page's Conversation tab: the conversation navigator, the ported
 * chat-area interactions, the session figures' position, the Chat / Trajectory
 * tab strip and the Windows title-bar band are feature switches placed here by
 * their manifests (D72). The waiting line's detail choice moved to the Motion
 * tab, where the line itself is switched on and painted, so this tab writes no
 * row of its own.
 */
export function createSettingsConversationTab(): SettingsTab {
  function rows(_view: SettingsView): SettingsRow[] {
    return []
  }
  return { id: 'conversation', label: () => settingsCopy('tabConversation', 'Conversation'), rows }
}
