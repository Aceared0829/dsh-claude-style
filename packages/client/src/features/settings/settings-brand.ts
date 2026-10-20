import * as React from 'react'
import { BRAND_INK_ORIGINAL, BRAND_INK_TEXT, PALETTE_HOST } from '../../constants'
import { BrandLockup } from './settings-brand-lockup'
import type { SegmentOption, SettingsRow, SettingsView } from './settings-controls'
import type { Prefs } from '../../constants'
import { copy } from './copy'

/**
 * The Appearance tab's custom brand row (D30), after the mascot: the brand
 * area drawn as the lockup the reader edits in place
 * (settings-brand-lockup.ts), with how the images are inked as its sub-row.
 * The name and the two images are the reader's own data, written through the
 * page's write path and the host half's brand routes, so the lockup edits the
 * same values the sidebar paints. The accent colour stands apart from them as
 * Colours' sub-row (accentRow).
 */

/** Pause after the last drag before a picked colour is written to the settings store. */
const DRAFT_SAVE_DEBOUNCE_MS = 600
/** What the colour well shows while no custom accent is set and the accent token is not a `#rrggbb` colour. */
const ACCENT_FALLBACK = '#d97757'

/**
 * A preference edited as a draft: the control follows every drag at once, the
 * store gets the value after a pause or when the control lets go, and a stored
 * value that changes elsewhere replaces the draft while the control is not
 * being edited.
 */
function useDraft(stored: string, commit: (value: string) => void) {
  const [draft, setDraft] = React.useState(stored)
  const editing = React.useRef(false)
  const timer = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!editing.current) setDraft(stored)
  }, [stored])
  React.useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current) }, [])
  const flush = (value: string) => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    editing.current = false
    setDraft(value)
    if (value !== stored) commit(value)
  }
  const change = (value: string) => {
    editing.current = true
    setDraft(value)
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => flush(value), DRAFT_SAVE_DEBOUNCE_MS)
  }
  return { draft, change, flush }
}

/**
 * The accent colour: a colour well and, while a custom colour is set, the
 * button that hands the accent back to the brand. Unset, the well shows the
 * accent the page paints right now.
 */
function BrandAccentControl(props: { stored: string, write: SettingsView['write'], disabled?: boolean }) {
  const { draft, change, flush } = useDraft(props.stored, value => props.write({ brandAccent: value }))
  const live = getComputedStyle(document.body).getPropertyValue('--dsw-alias-brand-primary').trim().toLowerCase()
  const shown = draft !== '' ? draft : /^#[0-9a-f]{6}$/.test(live) ? live : ACCENT_FALLBACK
  return React.createElement(
    'div',
    { className: 'dsh-claude-brand-accent' },
    React.createElement('input', {
      type: 'color',
      className: 'dsh-claude-settings-color',
      value: shown,
      disabled: props.disabled === true,
      'aria-label': copy('brandAccentTitle'),
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => change(event.target.value),
      onBlur: () => flush(draft),
    }),
    draft === ''
      ? React.createElement('span', { className: 'dsh-claude-brand-accent-note' }, copy('brandAccentUnset'))
      : React.createElement('button', {
        type: 'button',
        className: 'dsh-claude-settings-button',
        disabled: props.disabled === true,
        onClick: () => flush(''),
      }, copy('brandAccentReset')),
  )
}

/**
 * The accent colour as Colours' sub-row (D72): the accent paints only over
 * the skin's own palette (D30), so the row greys out while Colours follows
 * the host, still showing the stored colour.
 */
export function accentRow(view: SettingsView): SettingsRow {
  const { prefs, write, controls } = view
  const enabled = prefs.palette !== PALETTE_HOST
  return {
    rank: 15,
    node: controls.subRow(
      'brandAccent',
      copy('brandAccentTitle'),
      copy('brandAccentDesc'),
      React.createElement(BrandAccentControl, { stored: prefs.brandAccent, write, disabled: !enabled }),
      enabled,
    ),
  }
}

/** The custom brand row, ranked after the mascot's placement row (rank 40): the lockup the reader edits in place, with how images are inked as its sub-row. */
export function brandRows(view: SettingsView): SettingsRow[] {
  const { prefs, write, controls } = view
  const inkOptions: SegmentOption<Prefs['brandInk']>[] = [
    { value: BRAND_INK_ORIGINAL, label: copy('brandInkOriginal') },
    { value: BRAND_INK_TEXT, label: copy('brandInkText') },
  ]
  return [
    {
      rank: 50,
      node: controls.row(
        'brandLockup',
        copy('brandLockupTitle'),
        copy('brandLockupDesc'),
        React.createElement(BrandLockup, { prefs, write }),
        { block: true },
      ),
    },
    {
      rank: 51,
      node: controls.subRow(
        'brandInk',
        copy('brandInkTitle'),
        copy('brandInkDesc'),
        controls.segment(inkOptions, prefs.brandInk, value => { write({ brandInk: value }) }),
        true,
      ),
    },
  ]
}
