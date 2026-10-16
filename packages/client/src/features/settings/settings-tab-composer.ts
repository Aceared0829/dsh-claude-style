import * as React from 'react'
import { COMPOSER_SCOPE_OFF } from '../../constants'
import { copy } from './copy'
import type { SettingsTab, SettingsView } from './settings-controls'

/**
 * The settings page's Composer tab: the quick-provider trigger, the one row
 * this page draws itself. The restyle's scope, the model picker with its
 * descriptions, the peak rate meter and the permission control are the
 * features' own rows, placed here by their manifests (D72); the picker and the
 * permission control are drawn into the restyled composer, so their rows wait
 * for the restyle (their manifests' `requires`).
 */
export function createSettingsComposerTab(): SettingsTab {
  /** What the quick-provider trigger reads: how many, or nothing chosen. */
  function quickSummary(chosen: string[]) {
    if (chosen.length === 0) return copy('quickNone')
    return copy('quickCount', { count: chosen.length })
  }

  function rows(view: SettingsView) {
    const prefs = view.prefs
    const write = view.write
    const controls = view.controls
    const pickerOn = prefs.modelPicker && prefs.composerScope !== COMPOSER_SCOPE_OFF
    const quickTrigger = view.quickTrigger
    return [
      {
        rank: 40,
        node: controls.subRow(
          'quickProviders',
          copy('quickTitle'),
          copy('quickDesc'),
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
    ]
  }
  return { id: 'composer', label: () => copy('tabComposer'), rows }
}
