import * as React from 'react'
import { COMPOSER_SCOPE_ALL, COMPOSER_SCOPE_CONVERSATION, COMPOSER_SCOPE_HERO, COMPOSER_SCOPE_OFF } from '../../constants'
import { settingsCopy } from '../../core/i18n'
import type { SettingsTab, SettingsView } from './settings-controls'

/**
 * The settings page's Composer tab: the composer restyle's scope, the model
 * picker with its quick providers and the peak rate meter, and the permission
 * control. The effort slider rides the model picker: the host keeps its own
 * effort choice inside its own model menu, so the two go together.
 *
 * The picker and the permission control are drawn into the restyled composer,
 * so their rows wait for the restyle (their manifests' `requires`), and the
 * picker's two sub-rows wait for it as well as for the picker.
 */
export function createSettingsComposerTab(): SettingsTab {
  /** What the quick-provider trigger reads: how many, or nothing chosen. */
  function quickSummary(chosen: string[]) {
    if (chosen.length === 0) return settingsCopy('quickNone', 'None')
    return settingsCopy('quickCount', '{count} providers', { count: chosen.length })
  }

  function rows(view: SettingsView) {
    const prefs = view.prefs
    const write = view.write
    const controls = view.controls
    const scopeOptions = [
      { value: COMPOSER_SCOPE_OFF, label: settingsCopy('scopeOff', 'Off') },
      { value: COMPOSER_SCOPE_HERO, label: settingsCopy('scopeHero', 'Home only') },
      { value: COMPOSER_SCOPE_CONVERSATION, label: settingsCopy('scopeConversation', 'Conversation only') },
      { value: COMPOSER_SCOPE_ALL, label: settingsCopy('scopeAll', 'All') },
    ]
    const pickerOn = prefs.modelPicker && prefs.composerScope !== COMPOSER_SCOPE_OFF
    const quickTrigger = view.quickTrigger
    return [
      {
        rank: 10,
        node: controls.row(
          'composerScope',
          settingsCopy('composerTitle', 'Composer restyle'),
          settingsCopy('composerDesc', 'Which input area the skin restyles: the new-conversation page, the conversation, or both. Off restores the host\'s composer.'),
          controls.segment(scopeOptions, prefs.composerScope, value => { write({ composerScope: value }) }),
        ),
      },
      {
        rank: 40,
        node: controls.subRow(
          'quickProviders',
          settingsCopy('quickTitle', 'Quick providers'),
          settingsCopy('quickDesc', 'Picked providers follow the official service in the picker\'s first level; one removed from the catalog stays marked "Removed" until unchecked.'),
          React.createElement('button', {
            type: 'button',
            ref: quickTrigger,
            className: 'dsh-claude-settings-picker',
            disabled: !pickerOn,
            'aria-haspopup': 'menu',
            'aria-expanded': 'false',
            onClick() {
              const api = view.quickProviderApi()
              if (api === null || quickTrigger.current === null) return
              api.toggle(quickTrigger.current, next => { write({ quickProviders: next }) })
            },
          }, quickSummary(prefs.quickProviders)),
          pickerOn,
        ),
      },
      {
        // The meter draws into the picker's own rows, so it belongs to that
        // row: off, the reader gets the host's menu back and there is nowhere
        // for a badge to stand.
        rank: 45,
        node: controls.subRow(
          'peakrate',
          settingsCopy('peakrateTitle', 'Peak rate meter'),
          settingsCopy('peakrateDesc', 'Marks every row of the model menu with the peak, off-peak or promotional rate in force right now, and how long it lasts. Off leaves the rows bare.'),
          controls.toggle(prefs.peakrate !== false, value => { write({ peakrate: value }) }, !pickerOn),
          pickerOn,
        ),
      },
    ]
  }
  return { id: 'composer', label: () => settingsCopy('tabComposer', 'Composer'), rows }
}
