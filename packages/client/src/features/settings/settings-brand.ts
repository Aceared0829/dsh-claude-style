import * as React from 'react'
import { BRAND_INK_ACCENT, BRAND_INK_ORIGINAL, BRAND_INK_TEXT, PALETTE_COLORING_BRAND, PALETTE_COLORING_CUSTOM } from '../../constants'
import { PALETTE_CARDS } from 'virtual:dsh-claude-style/generated'
import { BrandLockup } from './settings-brand-lockup'
import type { SegmentOption, SettingsRow, SettingsView } from './settings-controls'
import type { Prefs } from '../../constants'
import { copy } from './copy'

/**
 * The Appearance tab's custom brand row (D30), which opens the tab: the brand
 * area drawn as the lockup the reader edits in place
 * (settings-brand-lockup.ts), with how the images are inked as its sub-row.
 * The name and the two images are the reader's own data, written through the
 * page's write path and the host half's brand routes, so the lockup edits the
 * same values the sidebar paints. The colour cards stand apart from them as
 * Colours' sub-row (paletteCardsRow).
 */

/** One colour of a card: the preference it writes on the reader's card, and its name. */
const COLOURS = [
  { field: 'customAccent', label: 'paletteSwatchAccent', pick: (card: Card) => card.accent },
  { field: 'customCanvasLight', label: 'paletteSwatchLight', pick: (card: Card) => card.canvas.light },
  { field: 'customCanvasDark', label: 'paletteSwatchDark', pick: (card: Card) => card.canvas.dark },
  { field: 'customCode', label: 'paletteSwatchCode', pick: (card: Card) => card.code.light },
] as const

type Card = (typeof PALETTE_CARDS)[number]
type ColourField = (typeof COLOURS)[number]['field']

/** The name a card goes by, in the settings page's own language. */
function cardName(card: Card) {
  return card.id === 'claude' ? copy('brandClaude') : copy('brandDeepseek')
}

/**
 * The four swatches of one card. A brand card's swatches are its colours as the
 * token sheet resolves them; the reader's card takes a colour well each, and
 * every pick switches the page to that card at once.
 */
function Swatches(props: { colours: string[], onChange?: (field: ColourField, value: string) => void }) {
  const { colours, onChange } = props
  return React.createElement(
    'span',
    { className: 'dsh-claude-palette-swatches' },
    COLOURS.map((colour, index) => {
      const label = copy(colour.label)
      const value = colours[index]
      if (onChange === undefined) {
        return React.createElement('span', {
          key: colour.field,
          className: 'dsh-claude-palette-swatch',
          style: { background: value },
          title: label,
          'aria-label': label,
          role: 'img',
        })
      }
      return React.createElement(
        'span',
        { key: colour.field, className: 'dsh-claude-palette-swatch', style: { background: value }, title: label },
        React.createElement('input', {
          type: 'color',
          className: 'dsh-claude-palette-swatch-input',
          value,
          'aria-label': label,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(colour.field, event.target.value),
        }),
      )
    }),
  )
}

/** The three cards: the two brands, whose colours the page already paints, and the reader's own. */
function PaletteCards(props: { prefs: Prefs, write: SettingsView['write'] }) {
  const { prefs, write } = props
  const brand = PALETTE_CARDS.find((entry) => entry.id === prefs.brand) ?? PALETTE_CARDS[0]
  const custom = prefs.paletteColors === PALETTE_COLORING_CUSTOM
  const reader = COLOURS.map((colour) => {
    const stored = prefs[colour.field]
    return stored === '' ? colour.pick(brand) : stored
  })
  const pick = (field: ColourField, value: string) => write({ paletteColors: PALETTE_COLORING_CUSTOM, [field]: value })
  return React.createElement(
    'div',
    { className: 'dsh-claude-palette-cards', role: 'group', 'aria-label': copy('paletteCardsTitle') },
    PALETTE_CARDS.map((card) => React.createElement(
      'div',
      { key: card.id, className: 'dsh-claude-palette-card', 'data-brand': card.id },
      React.createElement(Swatches, { colours: COLOURS.map((colour) => colour.pick(card)) }),
      React.createElement('span', { className: 'dsh-claude-palette-card-name' }, cardName(card)),
    )),
    React.createElement(
      'button',
      {
        type: 'button',
        className: 'dsh-claude-palette-card',
        'data-active': custom ? '' : undefined,
        'aria-pressed': custom ? 'true' : 'false',
        'aria-label': copy('paletteCustom'),
        onClick: () => { if (!custom) write({ paletteColors: PALETTE_COLORING_CUSTOM }) },
      },
      React.createElement(Swatches, { colours: reader, onChange: pick }),
      React.createElement('span', { className: 'dsh-claude-palette-card-name' }, copy('paletteCustom')),
    ),
    custom
      ? React.createElement('button', {
        type: 'button',
        className: 'dsh-claude-settings-button dsh-claude-palette-reset',
        onClick: () => write({ paletteColors: PALETTE_COLORING_BRAND }),
      }, copy('paletteUseBrand'))
      : null,
  )
}

/**
 * The colour cards as Colours' sub-row (D72): the two brands' colours as the
 * page paints them, and the reader's own four, which switch the page to that
 * card the moment one is picked. The row carries no title of its own.
 */
export function paletteCardsRow(view: SettingsView): SettingsRow {
  return {
    rank: 15,
    node: view.controls.row('paletteCards', null, null, React.createElement(PaletteCards, { prefs: view.prefs, write: view.write }), { block: true }),
  }
}

/** The custom brand row, ranked ahead of every other row on the tab: the lockup the reader edits in place, with how images are inked as its sub-row. */
export function brandRows(view: SettingsView): SettingsRow[] {
  const { prefs, write } = view
  const inkOptions: SegmentOption<Prefs['brandInk']>[] = [
    { value: BRAND_INK_ORIGINAL, label: copy('brandInkOriginal') },
    { value: BRAND_INK_ACCENT, label: copy('brandInkAccent') },
    { value: BRAND_INK_TEXT, label: copy('brandInkText') },
  ]
  return [
    {
      rank: 5,
      node: view.controls.row(
        'brandLockup',
        copy('brandLockupTitle'),
        copy('brandLockupDesc'),
        React.createElement(BrandLockup, { prefs, write }),
        { block: true },
      ),
    },
    {
      rank: 6,
      node: view.controls.subRow(
        'brandInk',
        copy('brandInkTitle'),
        copy('brandInkDesc'),
        view.controls.segment(inkOptions, prefs.brandInk, value => { write({ brandInk: value }) }),
        true,
      ),
    },
  ]
}
