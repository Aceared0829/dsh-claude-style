import { PALETTE_CLAUDE, PALETTE_HOST, TYPEFACE_CLAUDE, TYPEFACE_HOST } from '../../constants'
import { brandRows, paletteCardsRow } from './settings-brand'
import { copy } from './copy'
import type { SettingsTab, SettingsView } from './settings-controls'

/**
 * The settings page's Appearance tab: the custom brand rows that open it
 * (settings-brand.ts), whether the skin paints the colours — with the colour
 * cards as that row's sub-row — and whether it sets the type. The home layout,
 * the mascot and where it stands are the features' own rows, placed here by
 * their manifests (D76).
 */
export function createSettingsAppearanceTab(): SettingsTab {
  function rows(view: SettingsView) {
    const prefs = view.prefs
    const write = view.write
    const controls = view.controls
    return [
      ...brandRows(view),
      // Both are the skin's own or the host's, nothing between: a switch, on for the skin's.
      {
        rank: 10,
        node: controls.row(
          'palette',
          copy('paletteTitle'),
          copy('paletteDesc'),
          controls.toggle(prefs.palette !== PALETTE_HOST, on => { write({ palette: on ? PALETTE_CLAUDE : PALETTE_HOST }) }),
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
          controls.toggle(prefs.typeface !== TYPEFACE_HOST, on => { write({ typeface: on ? TYPEFACE_CLAUDE : TYPEFACE_HOST }) }),
        ),
      },
    ]
  }
  return { id: 'appearance', label: () => copy('tabAppearance'), rows }
}
