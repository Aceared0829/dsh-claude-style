import * as React from 'react'
import { AUTO_POPOVER_ACCOUNT, AUTO_POPOVER_ALL, AUTO_POPOVER_OFF, PAGE_ZOOM_08, PAGE_ZOOM_1, PAGE_ZOOM_125, PAGE_ZOOM_15, PAGE_ZOOM_SYSTEM, USERNAME_MAX } from '../../constants'
import type { Prefs } from '../../constants'
import type { SegmentOption, SettingsTab, SettingsView } from './settings-controls'
import { copy } from './copy'

/**
 * The settings page's General tab: the username, the page's own scale and the
 * hover-open popovers; the rendering engine is the sodium feature's own row,
 * placed here by its manifest (D76).
 *
 * Each tab is a `{ id, label, rows(view) }` record: `rows` runs on every
 * render of the page (packages/client/src/features/settings/settings.ts) with the page's
 * view — the preferences, the write path, the controls and the username
 * field's state.
 */
export function createSettingsGeneralTab(): SettingsTab {
  function rows(view: SettingsView) {
    const prefs = view.prefs
    const write = view.write
    const controls = view.controls
    const autoPopoverOptions: SegmentOption<Prefs['autoPopover']>[] = [
      { value: AUTO_POPOVER_OFF, label: copy('autoPopoverOff') },
      { value: AUTO_POPOVER_ACCOUNT, label: copy('autoPopoverAccount') },
      { value: AUTO_POPOVER_ALL, label: copy('autoPopoverAll') },
    ]
    const pageZoomOptions: SegmentOption<Prefs['pageZoom']>[] = [
      { value: PAGE_ZOOM_SYSTEM, label: copy('pageZoomSystem') },
      { value: PAGE_ZOOM_08, label: copy('pageZoom08') },
      { value: PAGE_ZOOM_1, label: copy('pageZoom1') },
      { value: PAGE_ZOOM_125, label: copy('pageZoom125') },
      { value: PAGE_ZOOM_15, label: copy('pageZoom15') },
    ]
    const username = view.username
    return [
      {
        rank: 20,
        node: controls.row(
          'username',
          copy('usernameTitle'),
          copy('usernameDesc'),
          React.createElement('input', {
            type: 'text',
            className: 'dsh-claude-settings-input',
            value: username.value,
            maxLength: USERNAME_MAX,
            placeholder: copy('usernamePlaceholder'),
            spellCheck: false,
            autoComplete: 'off',
            onChange: username.onChange,
            onBlur: username.onBlur,
            onKeyDown: username.onKeyDown,
          }),
        ),
      },
      {
        rank: 30,
        node: controls.row(
          'pageZoom',
          copy('pageZoomTitle'),
          copy('pageZoomDesc'),
          controls.segment(pageZoomOptions, prefs.pageZoom, value => { write({ pageZoom: value }) }),
          { experimental: true },
        ),
      },
      {
        rank: 40,
        node: controls.row(
          'autoPopover',
          copy('autoPopoverTitle'),
          copy('autoPopoverDesc'),
          controls.segment(autoPopoverOptions, prefs.autoPopover, value => { write({ autoPopover: value }) }),
        ),
      },
    ]
  }
  return { id: 'general', label: () => copy('tabGeneral'), rows }
}
