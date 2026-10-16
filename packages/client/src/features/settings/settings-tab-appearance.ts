import * as React from 'react'
import { PALETTE_CLAUDE, PALETTE_HOST, TYPEFACE_CLAUDE, TYPEFACE_HOST } from '../../constants'
import { accentRow, brandRows } from './settings-brand'
import { copy } from './copy'
import type { Prefs } from '../../constants'
import type { SegmentOption, SettingsTab, SettingsView } from './settings-controls'

/**
 * The settings page's Appearance tab: who paints the colours — with the accent
 * colour as that row's sub-row — who sets the type, and the custom brand rows
 * (settings-brand.ts). The home layout, the mascot and where it stands are the
 * features' own rows, placed here by their manifests (D72).
 */
export function createSettingsAppearanceTab(): SettingsTab {
  function rows(view: SettingsView) {
    const prefs = view.prefs
    const write = view.write
    const controls = view.controls
    const paletteOptions: SegmentOption<Prefs['palette']>[] = [
      { value: PALETTE_CLAUDE, label: copy('paletteClaude') },
      { value: PALETTE_HOST, label: copy('paletteHost') },
    ]
    const typefaceOptions: SegmentOption<Prefs['typeface']>[] = [
      { value: TYPEFACE_CLAUDE, label: copy('typefaceClaude') },
      { value: TYPEFACE_HOST, label: copy('typefaceHost') },
    ]
    return [
      {
        rank: 10,
        node: controls.row(
          'palette',
          copy('paletteTitle'),
          copy('paletteDesc'),
          controls.segment(paletteOptions, prefs.palette, value => { write({ palette: value }) }),
        ),
      },
      accentRow(view),
      {
        rank: 20,
        node: controls.row(
          'typeface',
          copy('typefaceTitle'),
          copy('typefaceDesc'),
          controls.segment(typefaceOptions, prefs.typeface, value => { write({ typeface: value }) }),
        ),
      },
      ...brandRows(view),
    ]
  }
  return { id: 'appearance', label: () => copy('tabAppearance'), rows }
}
