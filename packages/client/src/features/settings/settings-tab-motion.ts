import * as React from 'react'
import { MOTION_FULL, MOTION_REDUCED, MOTION_SYSTEM, ONGOING_INDICATOR_BREATHE, ONGOING_INDICATOR_RING } from '../../constants'
import type { Prefs } from '../../constants'
import type { SegmentOption, SettingsTab, SettingsView } from './settings-controls'
import { copy } from './copy'

/**
 * The settings page's Motion tab: the animation choice every motion reads, the
 * mark a running conversation carries in the sidebar, and the rows the features
 * themselves place here (D72) — the waiting line's switch with its detail
 * choice and its two paints, the composer caret's glide, the fade of the
 * characters arriving in a streaming answer, and the entrance a sent message
 * makes. Those features draw their own controls (`<功能>.settings.ts`), each
 * card carrying a sample wearing the effect it picks rather than a name, so a
 * row whose control already shows what it does carries no description; the
 * card's accessible name is its only text.
 */
export function createSettingsMotionTab(): SettingsTab {
  /**
   * The sidebar's running mark as two preview cards: each card is the pair a
   * sidebar row leads with — the mark its choice gives it, then a title — so the
   * two cards differ in the mark alone. The mark's paint is the sidebar's own
   * (theme/sidebar.css), so a card wears the mark rather than a picture of it.
   */
  function ongoingPicker(prefs: Prefs, write: SettingsView['write']) {
    const options: SegmentOption<Prefs['ongoingIndicator']>[] = [
      { value: ONGOING_INDICATOR_BREATHE, label: copy('ongoingBreathe') },
      { value: ONGOING_INDICATOR_RING, label: copy('ongoingRing') },
    ]
    return React.createElement(
      'div',
      { className: 'dsh-claude-ongoing-picker', role: 'group' },
      options.map(option => React.createElement(
        'button',
        {
          key: option.value,
          type: 'button',
          className: 'dsh-claude-ongoing-card',
          'data-active': option.value === prefs.ongoingIndicator ? '' : undefined,
          'aria-pressed': option.value === prefs.ongoingIndicator ? 'true' : 'false',
          'aria-label': option.label,
          onClick: () => { if (option.value !== prefs.ongoingIndicator) write({ ongoingIndicator: option.value }) },
        },
        React.createElement(
          'span',
          { className: 'dsh-claude-ongoing-sample', 'aria-hidden': 'true' },
          // The look is fixed to the card's own choice, so both cards show
          // their mark whatever the page is set to.
          React.createElement('span', { className: 'dsh-claude-ongoing-mark', 'data-look': option.value }),
          React.createElement('span', { className: 'dsh-claude-ongoing-sample-title' }, copy('ongoingSample')),
        ),
      )),
    )
  }

  function rows(view: SettingsView) {
    const prefs = view.prefs
    const write = view.write
    const motionOptions: SegmentOption<Prefs['motion']>[] = [
      { value: MOTION_SYSTEM, label: copy('motionSystem') },
      { value: MOTION_REDUCED, label: copy('motionReduced') },
      { value: MOTION_FULL, label: copy('motionFull') },
    ]
    return [
      {
        rank: 5,
        node: view.controls.row(
          'motion',
          copy('motionTitle'),
          copy('motionDesc'),
          view.controls.segment(motionOptions, prefs.motion, value => { write({ motion: value }) }),
        ),
      },
      {
        rank: 30,
        node: view.controls.row(
          'ongoingIndicator',
          copy('ongoingTitle'),
          null,
          ongoingPicker(prefs, write),
          { block: true },
        ),
      },
    ]
  }
  return { id: 'motion', label: () => copy('tabMotion'), rows }
}
