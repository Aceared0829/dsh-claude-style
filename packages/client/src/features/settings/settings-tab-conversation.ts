import type { SettingsRow, SettingsTab, SettingsView } from './settings-controls'
import { copy } from './copy'

/**
 * The settings page's Conversation tab: the conversation navigator, the ported
 * chat-area interactions, the session figures' position, the Chat / Trajectory
 * tab strip and the Windows title-bar band are feature switches placed here by
 * their manifests (D72). The waiting line's detail choice stands on the Motion
 * tab, where the line itself is switched on and painted, so this tab writes no
 * row of its own.
 */
export function createSettingsConversationTab(): SettingsTab {
  function rows(_view: SettingsView): SettingsRow[] {
    return []
  }
  return { id: 'conversation', label: () => copy('tabConversation'), rows }
}
