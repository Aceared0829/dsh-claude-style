import * as React from 'react'
import { MOTION_FULL, MOTION_REDUCED, MOTION_SYSTEM } from '../../constants'
import type { Prefs } from '../../constants'
import type { SegmentOption, SettingsTab, SettingsView } from './settings-controls'
import { copy } from './copy'

/**
 * The settings page's Motion tab: the animation choice every motion reads, and
 * the rows the features themselves place here (D72) — the waiting line's switch
 * with its detail choice and its two paints, the composer caret's glide, the
 * fade of the characters arriving in a streaming answer, and the entrance a
 * sent message makes. Those features draw their own controls
 * (`<功能>.settings.ts`), each card carrying a sample wearing the effect it
 * picks rather than a name, so a row whose control already shows what it does
 * carries no description; the card's accessible name is its only text.
 */
export function createSettingsMotionTab(): SettingsTab {
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
    ]
  }
  return { id: 'motion', label: () => copy('tabMotion'), rows }
}
