import * as React from 'react'
import { BRAND_CLAUDE, BRAND_DEEPSEEK, PALETTE_CLAUDE, PALETTE_COLORING_BRAND, PALETTE_COLORING_CUSTOM, PALETTE_HOST, TYPEFACE_CLAUDE, TYPEFACE_HOST } from '../../constants'
import { COMBINE_SVGS } from 'virtual:dsh-claude-style/generated'
import { createHostToast } from '../../shared/host-toast'
import { PreviewCards } from '../../shared/preview-cards'
import { brandRows, paletteCardsRow } from './settings-brand'
import { copy } from './copy'
import type { Prefs } from '../../constants'
import type { PreviewOption } from '../../shared/preview-cards'
import type { SettingsTab, SettingsView } from './settings-controls'

/**
 * The settings page's Appearance tab: the theme style that opens it, the
 * custom brand rows under it (settings-brand.ts), whether the skin paints the
 * colours — with the colour cards as that row's sub-row — and whether it sets
 * the type. The theme style and the colour cards share the tab because a brand
 * press can leave the colours pinned to a card, and the toast that says so
 * points at the cards below it. The home layout, the mascot and where it
 * stands are the features' own rows, placed here by their manifests (D76).
 */
export function createSettingsAppearanceTab(): SettingsTab {
  const toast = createHostToast()

  /** The name of the colour card that is keeping the page's colours fixed. */
  function paletteName(colouring: Prefs['paletteColors']) {
    if (colouring === PALETTE_COLORING_CUSTOM) return copy('paletteCustom')
    return colouring === BRAND_DEEPSEEK ? copy('brandDeepseek') : copy('brandClaude')
  }

  /**
   * The theme style renders as a grid of large cards, each carrying the
   * brand's own mark: brands are presets, not sibling tiers of one setting.
   * The stylesheet picks the mark off the logo's data-brand, so a new brand
   * is one option here plus one rule in settings-cards.css.
   */
  function themePicker(prefs: Prefs, write: SettingsView['write']) {
    const options: PreviewOption<Prefs['brand']>[] = [
      // DeepSeek's lockup is one piece of art that already draws the mark with
      // its word; Claude's card carries the mark and the word as two pieces.
      {
        value: BRAND_DEEPSEEK,
        label: copy('brandDeepseek'),
        attributes: { 'data-brand': BRAND_DEEPSEEK },
        content: React.createElement('span', {
          className: 'dsh-claude-brand-card-lockup',
          'aria-hidden': 'true',
          dangerouslySetInnerHTML: { __html: COMBINE_SVGS.deepseek },
        }),
      },
      {
        value: BRAND_CLAUDE,
        label: copy('brandClaude'),
        attributes: { 'data-brand': BRAND_CLAUDE },
        content: [
          React.createElement('span', { key: 'mark', className: 'dsh-claude-brand-card-logo', 'data-brand': BRAND_CLAUDE, 'aria-hidden': 'true' }),
          React.createElement('span', { key: 'word', className: 'dsh-claude-brand-card-word dsh-claude-masked-word', 'aria-hidden': 'true' }),
        ],
      },
    ]
    return React.createElement(PreviewCards<Prefs['brand']>, {
      cardClass: 'dsh-claude-brand-card',
      options,
      value: prefs.brand,
      write: (value: Prefs['brand']) => write({ brand: value }),
      // The card names its own brand: the two cards draw their art differently
      // (Claude's mark beside its word, DeepSeek's lockup as one piece), so the
      // card, not the art inside it, is what a reader and the lane press.
      press: (option) => {
        write({ brand: option.value })
        if (prefs.paletteColors === PALETTE_COLORING_BRAND) return
        toast.show({
          text: copy('paletteFixed', { name: paletteName(prefs.paletteColors) }),
          actions: [{
            label: copy('paletteFollowBrand'),
            onClick: () => {
              write({ paletteColors: PALETTE_COLORING_BRAND })
              toast.hide()
            },
          }],
        })
      },
    })
  }

  function rows(view: SettingsView) {
    const prefs = view.prefs
    const write = view.write
    const controls = view.controls
    return [
      {
        rank: 1,
        node: controls.row(
          'brand',
          copy('brandTitle'),
          copy('brandDesc'),
          themePicker(prefs, write),
          { block: true },
        ),
      },
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
