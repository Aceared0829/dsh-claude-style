import * as React from 'react'
import { PALETTE_CLAUDE, PALETTE_HOST, TYPEFACE_CLAUDE, TYPEFACE_HOST } from '../../constants'
import { brandRows, paletteCardsRow } from './settings-brand'
import { copy } from './copy'
import type { Prefs } from '../../constants'
import type { SegmentOption, SettingsTab, SettingsView } from './settings-controls'

/**
 * The settings page's Appearance tab: the custom brand rows that open it
 * (settings-brand.ts), who paints the colours — with the colour cards as that
 * row's sub-row — and who sets the type. The home layout, the mascot and where
 * it stands are the features' own rows, placed here by their manifests (D72).
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
      ...brandRows(view),
      {
        rank: 10,
        node: controls.row(
          'palette',
          copy('paletteTitle'),
          copy('paletteDesc'),
          controls.segment(paletteOptions, prefs.palette, value => { write({ palette: value }) }),
        ),
      },
      // The cards belong to the skin's own colours: following the host leaves nothing to pick.
      ...(prefs.palette === PALETTE_HOST ? [] : [paletteCardsRow(view)]),
      {
        rank: 20,
        node: controls.row(
          'typeface',
          copy('typefaceTitle'),
          copy('typefaceDesc'),
          controls.segment(typefaceOptions, prefs.typeface, value => { write({ typeface: value }) }),
        ),
      },
    ]
  }
  return { id: 'appearance', label: () => copy('tabAppearance'), rows }
}
