import * as React from 'react'
import { COMPOSER_SCOPE_ALL, COMPOSER_SCOPE_CONVERSATION, COMPOSER_SCOPE_HERO, COMPOSER_SCOPE_OFF } from '../../constants'
import type { SegmentOption, SettingsTab, SettingsView } from './settings-controls'
import type { Prefs } from '../../constants'
import { copy } from './copy'

/**
 * The settings page's Composer tab: the composer restyle's scope, the model
 * picker with its descriptions, its quick providers and the peak rate meter, and
 * the permission control. The effort slider rides the model picker: the host
 * keeps its own effort choice inside its own model menu, so the two go together.
 *
 * The picker and the permission control are drawn into the restyled composer,
 * so their rows wait for the restyle (their manifests' `requires`), and the
 * picker's three sub-rows wait for it as well as for the picker.
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
    const scopeOptions: SegmentOption<Prefs['composerScope']>[] = [
      { value: COMPOSER_SCOPE_OFF, label: copy('scopeOff') },
      { value: COMPOSER_SCOPE_HERO, label: copy('scopeHero') },
      { value: COMPOSER_SCOPE_CONVERSATION, label: copy('scopeConversation') },
      { value: COMPOSER_SCOPE_ALL, label: copy('scopeAll') },
    ]
    const pickerOn = prefs.modelPicker && prefs.composerScope !== COMPOSER_SCOPE_OFF
    const quickTrigger = view.quickTrigger
    return [
      {
        rank: 10,
        node: controls.row(
          'composerScope',
          copy('composerTitle'),
          copy('composerDesc'),
          controls.segment(scopeOptions, prefs.composerScope, value => { write({ composerScope: value }) }),
        ),
      },
      {
        // The description line is the picker's own first level, so its row
        // belongs to the picker row and waits for it.
        rank: 35,
        node: controls.subRow(
          'modelDescriptions',
          copy('modelDescriptionsTitle'),
          copy('modelDescriptionsDesc'),
          controls.toggle(prefs.modelDescriptions !== false, value => { write({ modelDescriptions: value }) }, !pickerOn),
          pickerOn,
        ),
      },
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
      {
        // The meter draws into the picker's own rows, so it belongs to that
        // row: off, the reader gets the host's menu back and there is nowhere
        // for a badge to stand.
        rank: 45,
        node: controls.subRow(
          'peakrate',
          copy('peakrateTitle'),
          copy('peakrateDesc'),
          controls.toggle(prefs.peakrate !== false, value => { write({ peakrate: value }) }, !pickerOn),
          pickerOn,
        ),
      },
    ]
  }
  return { id: 'composer', label: () => copy('tabComposer'), rows }
}
