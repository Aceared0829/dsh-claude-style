import * as React from 'react'
import { HOME_LAYOUT_CLASSIC, HOME_LAYOUT_STUDIO, MASCOT_BRAND, MASCOT_CRAB, MASCOT_DEEPY, MASCOT_OFF, MASCOT_SCOPE_ALL, MASCOT_SCOPE_HOME, PALETTE_CLAUDE, PALETTE_HOST, TYPEFACE_CLAUDE, TYPEFACE_HOST } from '../../constants'
import { resolveMascot } from '../../core/prefs'
import { accentRow, brandRows } from './settings-brand'
import type { SegmentOption, SettingsTab, SettingsView } from './settings-controls'
import type { Prefs } from '../../constants'
import { copy } from './copy'

/**
 * The settings page's Appearance tab: who paints the colours — with the
 * accent colour as that row's sub-row — who sets the type, how the
 * new-conversation page is laid out, the mascot with where it stands, and
 * the custom brand rows (settings-brand.ts).
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
    const homeLayoutOptions: SegmentOption<Prefs['homeLayout']>[] = [
      { value: HOME_LAYOUT_CLASSIC, label: copy('homeClassic') },
      { value: HOME_LAYOUT_STUDIO, label: copy('homeStudio') },
    ]
    const mascotOptions: SegmentOption<Prefs['mascot']>[] = [
      { value: MASCOT_BRAND, label: copy('mascotBrand') },
      { value: MASCOT_CRAB, label: copy('mascotCrab') },
      { value: MASCOT_DEEPY, label: copy('mascotDeepy') },
      { value: MASCOT_OFF, label: copy('mascotOff') },
    ]
    const mascotScopeOptions: SegmentOption<Prefs['mascotScope']>[] = [
      { value: MASCOT_SCOPE_HOME, label: copy('mascotScopeHome') },
      { value: MASCOT_SCOPE_ALL, label: copy('mascotScopeAll') },
    ]
    const mascotShown = resolveMascot(prefs) !== MASCOT_OFF
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
      {
        rank: 25,
        node: controls.row(
          'homeLayout',
          copy('homeTitle'),
          copy('homeDesc'),
          controls.segment(homeLayoutOptions, prefs.homeLayout, value => { write({ homeLayout: value }) }),
        ),
      },
      {
        rank: 30,
        node: controls.row(
          'mascot',
          copy('mascotTitle'),
          copy('mascotDesc'),
          controls.segment(mascotOptions, prefs.mascot, value => { write({ mascot: value }) }),
        ),
      },
      {
        rank: 40,
        node: controls.subRow(
          'mascotScope',
          copy('mascotScopeTitle'),
          copy('mascotScopeDesc'),
          controls.segment(mascotScopeOptions, prefs.mascotScope, value => { write({ mascotScope: value }) }, !mascotShown),
          mascotShown,
        ),
      },
      ...brandRows(view),
    ]
  }
  return { id: 'appearance', label: () => copy('tabAppearance'), rows }
}
