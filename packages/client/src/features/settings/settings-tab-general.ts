import * as React from 'react'
import { AUTO_POPOVER_ACCOUNT, AUTO_POPOVER_ALL, AUTO_POPOVER_OFF, BRAND_CLAUDE, BRAND_DEEPSEEK, USERNAME_MAX } from '../../constants'
import { settingsCopy } from '../../core/i18n'
import type { Prefs } from '../../constants'
import type { SegmentOption, SettingsTab, SettingsView } from './settings-controls'

/**
 * The settings page's General tab: the theme style, the username and the
 * hover-open popovers.
 *
 * Each tab is a `{ id, label, rows(view) }` record: `rows` runs on every
 * render of the page (packages/client/src/features/settings/settings.ts) with the page's
 * view — the preferences, the write path, the controls and the username
 * field's state.
 */
export function createSettingsGeneralTab(): SettingsTab {
  /**
   * The theme style renders as a grid of large cards, each carrying the
   * brand's own mark: brands are presets, not sibling tiers of one setting.
   * The stylesheet picks the mark off the logo's data-brand, so a new brand
   * is one option here plus one rule in settings-cards.css.
   */
  function themePicker(prefs: Prefs, write: SettingsView['write']) {
    const brandOptions: SegmentOption<Prefs['brand']>[] = [
      { value: BRAND_DEEPSEEK, label: settingsCopy('brandDeepseek', 'DeepSeek') },
      { value: BRAND_CLAUDE, label: settingsCopy('brandClaude', 'Claude') },
    ]
    return React.createElement(
      'div',
      { className: 'dsh-claude-brand-picker', role: 'group' },
      brandOptions.map(option => React.createElement(
        'button',
        {
          key: option.value,
          type: 'button',
          className: 'dsh-claude-brand-card',
          'data-active': option.value === prefs.brand ? '' : undefined,
          'aria-pressed': option.value === prefs.brand ? 'true' : 'false',
          onClick: () => { if (option.value !== prefs.brand) write({ brand: option.value }) },
        },
        React.createElement('span', { className: 'dsh-claude-brand-card-logo', 'data-brand': option.value }),
        React.createElement('span', { className: 'dsh-claude-brand-card-name' }, option.label),
      )),
    )
  }

  function rows(view: SettingsView) {
    const prefs = view.prefs
    const write = view.write
    const controls = view.controls
    const autoPopoverOptions: SegmentOption<Prefs['autoPopover']>[] = [
      { value: AUTO_POPOVER_OFF, label: settingsCopy('autoPopoverOff', 'Off') },
      { value: AUTO_POPOVER_ACCOUNT, label: settingsCopy('autoPopoverAccount', 'Account only') },
      { value: AUTO_POPOVER_ALL, label: settingsCopy('autoPopoverAll', 'All') },
    ]
    const username = view.username
    return [
      {
        rank: 10,
        node: controls.row(
          'brand',
          settingsCopy('brandTitle', 'Theme style'),
          settingsCopy('brandDesc', 'The brand mark and its colour family: warm for Claude, blue for DeepSeek. While Colours follows the host, only the mark changes.'),
          themePicker(prefs, write),
          { block: true },
        ),
      },
      {
        rank: 20,
        node: controls.row(
          'username',
          settingsCopy('usernameTitle', 'Username'),
          settingsCopy('usernameDesc', 'The name shown in the greeting and the account row; empty falls back to the signed-in account, then the launcher, then the system user.'),
          React.createElement('input', {
            type: 'text',
            className: 'dsh-claude-settings-input',
            value: username.value,
            maxLength: USERNAME_MAX,
            placeholder: settingsCopy('usernamePlaceholder', 'Auto-detect account or host user'),
            spellCheck: false,
            autoComplete: 'off',
            onChange: username.onChange,
            onBlur: username.onBlur,
            onKeyDown: username.onKeyDown,
          }),
        ),
      },
      {
        rank: 40,
        node: controls.row(
          'autoPopover',
          settingsCopy('autoPopoverTitle', 'Open popovers on hover'),
          settingsCopy('autoPopoverDesc', 'Which popovers open on hover: the account popover alone, or also the permission, model, session-stats and home-page pickers.'),
          controls.segment(autoPopoverOptions, prefs.autoPopover, value => { write({ autoPopover: value }) }),
        ),
      },
    ]
  }
  return { id: 'general', label: () => settingsCopy('tabGeneral', 'General'), rows }
}
