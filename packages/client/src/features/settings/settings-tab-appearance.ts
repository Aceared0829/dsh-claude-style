import * as React from 'react'
import { HOME_LAYOUT_CLASSIC, HOME_LAYOUT_STUDIO, MASCOT_BRAND, MASCOT_CRAB, MASCOT_DEEPY, MASCOT_OFF, MASCOT_SCOPE_ALL, MASCOT_SCOPE_HOME, PALETTE_CLAUDE, PALETTE_HOST, TYPEFACE_CLAUDE, TYPEFACE_HOST } from '../../constants'
import { settingsCopy } from '../../core/i18n'
import { resolveMascot } from '../../core/prefs'
import { accentRow, brandRows } from './settings-brand'
import type { SegmentOption, SettingsTab, SettingsView } from './settings-controls'
import type { Prefs } from '../../constants'

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
      { value: PALETTE_CLAUDE, label: settingsCopy('paletteClaude', 'Claude') },
      { value: PALETTE_HOST, label: settingsCopy('paletteHost', 'Follow the host') },
    ]
    const typefaceOptions: SegmentOption<Prefs['typeface']>[] = [
      { value: TYPEFACE_CLAUDE, label: settingsCopy('typefaceClaude', 'Claude') },
      { value: TYPEFACE_HOST, label: settingsCopy('typefaceHost', 'Follow the host') },
    ]
    const homeLayoutOptions: SegmentOption<Prefs['homeLayout']>[] = [
      { value: HOME_LAYOUT_CLASSIC, label: settingsCopy('homeClassic', 'Classic') },
      { value: HOME_LAYOUT_STUDIO, label: settingsCopy('homeStudio', 'Studio') },
    ]
    const mascotOptions: SegmentOption<Prefs['mascot']>[] = [
      { value: MASCOT_BRAND, label: settingsCopy('mascotBrand', 'Follow the brand') },
      { value: MASCOT_CRAB, label: settingsCopy('mascotCrab', 'Crab') },
      { value: MASCOT_DEEPY, label: settingsCopy('mascotDeepy', 'Deepy') },
      { value: MASCOT_OFF, label: settingsCopy('mascotOff', 'Off') },
    ]
    const mascotScopeOptions: SegmentOption<Prefs['mascotScope']>[] = [
      { value: MASCOT_SCOPE_HOME, label: settingsCopy('mascotScopeHome', 'Home') },
      { value: MASCOT_SCOPE_ALL, label: settingsCopy('mascotScopeAll', 'Home and conversation') },
    ]
    const mascotShown = resolveMascot(prefs) !== MASCOT_OFF
    return [
      {
        rank: 10,
        node: controls.row(
          'palette',
          settingsCopy('paletteTitle', 'Colours'),
          settingsCopy('paletteDesc', 'Claude uses the skin\'s own colours; Follow the host leaves colours to DSH or other theme plugins and keeps only layout and controls.'),
          controls.segment(paletteOptions, prefs.palette, value => { write({ palette: value }) }),
        ),
      },
      accentRow(view),
      {
        rank: 20,
        node: controls.row(
          'typeface',
          settingsCopy('typefaceTitle', 'Typefaces'),
          settingsCopy('typefaceDesc', 'Claude uses the Anthropic faces (or the Inter and Noto Serif stand-ins) with JetBrains Mono for code; Follow the host keeps the fonts DSH sets.'),
          controls.segment(typefaceOptions, prefs.typeface, value => { write({ typeface: value }) }),
        ),
      },
      {
        rank: 25,
        node: controls.row(
          'homeLayout',
          settingsCopy('homeTitle', 'Home layout'),
          settingsCopy('homeDesc', 'The new-conversation page layout. Classic centers the hero and input card; Studio pins the composer to the bottom and shows usage.'),
          controls.segment(homeLayoutOptions, prefs.homeLayout, value => { write({ homeLayout: value }) }),
        ),
      },
      {
        rank: 30,
        node: controls.row(
          'mascot',
          settingsCopy('mascotTitle', 'Mascot'),
          settingsCopy('mascotDesc', 'The pixel companion on the input area\'s top edge, animated by the agent\'s state. Follow the brand picks the crab under Claude, Deepy under DeepSeek.'),
          controls.segment(mascotOptions, prefs.mascot, value => { write({ mascot: value }) }),
        ),
      },
      {
        rank: 40,
        node: controls.subRow(
          'mascotScope',
          settingsCopy('mascotScopeTitle', 'Where it appears'),
          settingsCopy('mascotScopeDesc', 'The new-conversation page alone, or the new-conversation page and the conversation.'),
          controls.segment(mascotScopeOptions, prefs.mascotScope, value => { write({ mascotScope: value }) }, !mascotShown),
          mascotShown,
        ),
      },
      ...brandRows(view),
    ]
  }
  return { id: 'appearance', label: () => settingsCopy('tabAppearance', 'Appearance'), rows }
}
