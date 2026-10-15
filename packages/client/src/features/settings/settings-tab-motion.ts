import * as React from 'react'
import { CARET_MOTION_OFF, CARET_MOTION_TYPING, MOTION_FULL, MOTION_REDUCED, MOTION_SYSTEM, STATUS_MOTION_SWEEP, STATUS_MOTION_WASH } from '../../constants'
import { prefYielded } from '../../core/feature'
import { copyLabel, hostChatCopy, settingsCopy } from '../../core/i18n'
import { waitingWord } from '../../shared/turn-activity'
import { managedDesc } from './settings-controls'
import type { Prefs } from '../../constants'
import type { SettingsTab, SettingsView } from './settings-controls'

/**
 * The settings page's Motion tab: the animation choice every motion reads,
 * what the words on the running turn's line do, and the composer caret's
 * glide.
 *
 * The paint and caret choices are shown as the effects themselves rather than
 * named — each card carries a sample wearing the effect it picks, and no
 * visible label, the way the theme style's cards carry the brands' own marks,
 * so a row whose control already shows what it does carries no description.
 * The waiting line's sample is the same look the line itself wears
 * (shared/motion.css), so a card is the effect and not a picture of it; the
 * card's accessible name is its only text.
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
    // word the brand in force waits on (shared/turn-activity.ts) and the state it
    // says while a call runs. The card shows the wording swap as the line runs it
    // (settings.css), so a reader sees both what the line says and how it is
    // painted.
    const words = [
      waitingWord(prefs.brand, hostChatCopy('chat.deepDiving', 'Deep diving')),
      copyLabel('chatWaitTools', 'Running tools…'),
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

  /**
   * The caret's two choices as preview cards: the on card's caret glides along
   * the sample line the way the drawn one glides between positions, the off
   * card's stands and blinks the browser's own way (settings.css).
   */
  function caretPicker(prefs: Prefs, write: SettingsView['write'], disabled: boolean) {
    const options = [
      { value: CARET_MOTION_TYPING, label: settingsCopy('caretOn', 'On') },
      { value: CARET_MOTION_OFF, label: settingsCopy('caretOff', 'Off') },
    ]
    return React.createElement(
      'div',
      { className: 'dsh-claude-caret-picker', role: 'group' },
      options.map(option => React.createElement(
        'button',
        {
          key: option.value,
          type: 'button',
          className: 'dsh-claude-caret-card',
          disabled,
          'data-active': option.value === prefs.caretMotion ? '' : undefined,
          'aria-pressed': option.value === prefs.caretMotion ? 'true' : 'false',
          'aria-label': option.label,
          onClick: () => { if (option.value !== prefs.caretMotion) write({ caretMotion: option.value }) },
        },
        React.createElement(
          'span',
          { className: 'dsh-claude-caret-sample', 'aria-hidden': 'true' },
          React.createElement('span', { className: 'dsh-claude-caret-sample-text' }, settingsCopy('caretSample', 'Type here')),
          React.createElement('span', { className: `dsh-claude-caret-sample-bar dsh-claude-caret-${option.value}` }),
        ),
      )),
    )
  }

  function rows(view: SettingsView) {
    const prefs = view.prefs
    const write = view.write
    const motionOptions = [
      { value: MOTION_SYSTEM, label: settingsCopy('motionSystem', 'Follow the system') },
      { value: MOTION_REDUCED, label: settingsCopy('motionReduced', 'Reduced') },
      { value: MOTION_FULL, label: settingsCopy('motionFull', 'Always') },
    ]
    const caretYielded = prefYielded('caretMotion')
    return [
      {
        rank: 5,
        node: view.controls.row(
          'motion',
          settingsCopy('motionTitle', 'Animation'),
          settingsCopy('motionDesc', 'Follow the system, hold animations on a still frame, or always play them.'),
          view.controls.segment(motionOptions, prefs.motion, value => { write({ motion: value }) }),
        ),
      },
      {
        rank: 10,
        node: view.controls.row(
          'statusMotion',
          settingsCopy('statusMotionTitle', 'Waiting-line animation'),
          null,
          statusMotionPicker(prefs, write),
          { block: true },
        ),
      },
      {
        rank: 20,
        node: view.controls.row(
          'caretMotion',
          settingsCopy('caretTitle', 'Composer caret motion'),
          // The preview cards are the description; only a yielded control still needs a line (D32).
          caretYielded ? managedDesc('', true) : null,
          caretPicker(prefs, write, caretYielded),
          { block: true, disabled: caretYielded },
        ),
      },
    ]
  }
  return { id: 'motion', label: () => settingsCopy('tabMotion', 'Motion'), rows }
}
