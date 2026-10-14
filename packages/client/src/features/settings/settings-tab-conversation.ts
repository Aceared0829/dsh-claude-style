import { STATUS_DETAIL_PRECISE, STATUS_DETAIL_SIMPLE } from '../../constants'
import { settingsCopy } from '../../core/i18n'
import type { SettingsRow, SettingsTab, SettingsView } from './settings-controls'

/**
 * The settings page's Conversation tab: the turn status line's detail choice,
 * which the tab writes itself; the conversation navigator, the ported
 * chat-area interactions, the session figures' position, the Chat /
 * Trajectory tab strip and the Windows title-bar band are feature switches
 * placed here by their manifests (D42).
 */
export function createSettingsConversationTab(): SettingsTab {
  function rows(view: SettingsView): SettingsRow[] {
    const prefs = view.prefs
    const write = view.write
    const controls = view.controls
    const detailOptions = [
      { value: STATUS_DETAIL_SIMPLE, label: settingsCopy('statusDetailSimple', 'Simple') },
      { value: STATUS_DETAIL_PRECISE, label: settingsCopy('statusDetailPrecise', 'Precise') },
    ]
    return [
      {
        rank: 32,
        node: controls.row(
          'statusDetail',
          settingsCopy('statusDetailTitle', 'Waiting-line detail'),
          settingsCopy('statusDetailDesc', 'Simple names the running turn\'s state alone; Precise adds the file a call works on, a command\'s declared description or a clause from the reasoning.'),
          controls.segment(detailOptions, prefs.statusDetail, value => { write({ statusDetail: value }) }),
        ),
      },
    ]
  }
  return { id: 'conversation', label: () => settingsCopy('tabConversation', 'Conversation'), rows }
}
