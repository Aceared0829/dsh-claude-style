import * as React from 'react'
import { STATUS_MOTION_SWEEP, STATUS_MOTION_WASH } from '../../constants'
import { settingsCopy } from '../../core/i18n'
import type { Prefs } from '../../constants'
import type { SettingsTab, SettingsView } from './settings-controls'

/**
 * The settings page's Motion tab: what the words on the running turn's line do.
 *
 * The two choices are shown as the effects themselves rather than named — each
 * card carries a sample of the line's words wearing the paint it picks, and no
 * visible label, the way the theme style's cards carry the brands' own marks.
 * The sample is the same look the line itself wears (shared/motion.css), so a
 * card is the effect and not a picture of it; the card's accessible name is its
 * only text.
 */
export function createSettingsMotionTab(): SettingsTab {
  /**
   * The waiting line's paints as a row of preview cards. The card's class is
   * the stored value, which is also the shared look's own class
   * (`dsh-claude-sweep`, `dsh-claude-wash`), so a new paint is one option here
   * plus one rule in shared/motion.css.
   */
  function statusMotionPicker(prefs: Prefs, write: SettingsView['write']) {
    // What the line says, in the two wordings the card takes turns between: the
    // state it is on while the model works, and the host's own word for a wait
    // it cannot read. The card shows the wording swap as the line runs it
    // (settings.css), so a reader sees both what the line says and how it is
    // painted.
    const words = [
      settingsCopy('statusMotionSample', 'Thinking…'),
      settingsCopy('statusMotionSampleWait', 'Deep diving'),
    ]
    const options = [
      { value: STATUS_MOTION_SWEEP, label: settingsCopy('statusMotionSweep', 'Highlight sweep') },
      { value: STATUS_MOTION_WASH, label: settingsCopy('statusMotionWash', 'Colour wash') },
    ]
    return React.createElement(
      'div',
      { className: 'dsh-claude-motion-picker', role: 'group' },
      options.map(option => React.createElement(
        'button',
        {
          key: option.value,
          type: 'button',
          className: 'dsh-claude-motion-card',
          'data-active': option.value === prefs.statusMotion ? '' : undefined,
          'aria-pressed': option.value === prefs.statusMotion ? 'true' : 'false',
          'aria-label': option.label,
          onClick: () => { if (option.value !== prefs.statusMotion) write({ statusMotion: option.value }) },
        },
        // Each wording wears the card's paint by carrying the shared look's own
        // class (shared/motion.css), so the band or the wash rides the words
        // that are standing.
        React.createElement(
          'span',
          { className: 'dsh-claude-motion-sample', 'aria-hidden': 'true' },
          words.map(word => React.createElement('span', {
            key: word,
            className: `dsh-claude-motion-word dsh-claude-${option.value}`,
            'data-text': word,
          }, word)),
        ),
      )),
    )
  }

  function rows(view: SettingsView) {
    return [
      {
        rank: 10,
        node: view.controls.row(
          'statusMotion',
          settingsCopy('statusMotionTitle', 'Waiting-line animation'),
          settingsCopy('statusMotionDesc', 'What the words on the running turn\'s line do: the highlight band the host\'s own rows sweep, or a colour wash that moves through the letters themselves. The wording, its swap and the clock beside it are the same either way.'),
          statusMotionPicker(view.prefs, view.write),
          { block: true },
        ),
      },
    ]
  }
  return { id: 'motion', label: () => settingsCopy('tabMotion', 'Motion'), rows }
}
