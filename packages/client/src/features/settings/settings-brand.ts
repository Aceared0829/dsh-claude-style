import * as React from 'react'
import { BRAND_IMAGE_MAX_BYTES, BRAND_IMAGE_TYPES } from '@dsh-claude-style/contracts/brand'
import type { BrandImageKind } from '@dsh-claude-style/contracts/brand'
import { BRAND_INK_ORIGINAL, BRAND_INK_TEXT, BRAND_NAME_MAX, PALETTE_HOST } from '../../constants'
import { settingsCopy } from '../../core/i18n'
import { loadBrandImages, readBrandImages, removeBrandImage, subscribeBrandImages, uploadBrandImage } from '../../shared/custom-brand'
import type { SettingsRow, SettingsView } from './settings-controls'

/**
 * The Appearance tab's custom brand rows (D30), after the mascot: the brand
 * name, the two images and how the images are inked. The name is a
 * preference written through the page's own write path; the images live in
 * the host half's brand directory and go through the shared image state
 * (packages/client/src/shared/custom-brand.ts). The accent colour stands
 * apart from them as Colours' sub-row (accentRow).
 */

/** Pause after the last edit before a typed name or a dragged colour is written to the settings store. */
const DRAFT_SAVE_DEBOUNCE_MS = 600
/** What the colour well shows while no custom accent is set and the accent token is not a `#rrggbb` colour. */
const ACCENT_FALLBACK = '#d97757'

/**
 * A preference edited as a draft: the control follows every keystroke or drag
 * at once, the store gets the value after a pause or when the control lets go,
 * and a stored value that changes elsewhere replaces the draft while the
 * control is not being edited.
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
  const revert = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    editing.current = false
    setDraft(stored)
  }
  return { draft, change, flush, revert }
}

/** The brand name field. */
function BrandNameInput(props: { stored: string, write: SettingsView['write'] }) {
  const { draft, change, flush, revert } = useDraft(props.stored, value => props.write({ brandName: value.trim().slice(0, BRAND_NAME_MAX) }))
  return React.createElement('input', {
    type: 'text',
    className: 'dsh-claude-settings-input',
    value: draft,
    maxLength: BRAND_NAME_MAX,
    placeholder: settingsCopy('brandNamePlaceholder', 'The chosen brand'),
    spellCheck: false,
    autoComplete: 'off',
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => change(event.target.value),
    onBlur: () => flush(draft),
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        flush(draft)
        event.currentTarget.blur()
      } else if (event.key === 'Escape') {
        revert()
        event.currentTarget.blur()
      }
    },
  })
}

/** The images in hand, following the shared state, read once the control mounts. */
function useBrandImages() {
  const [images, setImages] = React.useState(readBrandImages())
  React.useEffect(() => {
    const off = subscribeBrandImages(setImages)
    loadBrandImages()
    setImages(readBrandImages())
    return off
  }, [])
  return images
}

/**
 * One image's control: its preview, a button that picks a file and one that
 * removes the image, and the reason the last change was refused. The file is
 * held to the accepted formats and size here, so a refusal is said before the
 * bytes travel; the host half checks both again.
 */
function BrandImageControl(props: { kind: BrandImageKind }) {
  const image = useBrandImages()[props.kind]
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const picker = React.useRef<HTMLInputElement>(null)
  const run = (pending: Promise<void>) => {
    setBusy(true)
    setError(null)
    // A refusal from the host half is said on the row; the stored image stays (D12).
    pending.then(() => setBusy(false), (reason: { message?: string }) => {
      setBusy(false)
      setError(settingsCopy('brandImageFailed', 'Saving failed: {detail}', { detail: reason?.message ?? String(reason) }))
    })
  }
  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined) return
    if (BRAND_IMAGE_TYPES[file.type] === undefined) {
      setError(settingsCopy('brandImageType', 'Only PNG, SVG or WebP images are accepted.'))
      return
    }
    if (file.size > BRAND_IMAGE_MAX_BYTES) {
      setError(settingsCopy('brandImageSize', 'The image is larger than 2 MB.'))
      return
    }
    run(uploadBrandImage(props.kind, file))
  }
  return React.createElement(
    'div',
    { className: 'dsh-claude-brand-image', 'data-kind': props.kind },
    React.createElement(
      'div',
      { className: 'dsh-claude-brand-image-controls' },
      React.createElement('span', { className: 'dsh-claude-brand-image-preview', 'data-empty': image === null ? '' : undefined },
        image === null ? null : React.createElement('img', { src: image.url, alt: '' })),
      React.createElement('input', {
        ref: picker,
        type: 'file',
        accept: Object.keys(BRAND_IMAGE_TYPES).join(','),
        hidden: true,
        onChange: pick,
      }),
      React.createElement('button', {
        type: 'button',
        className: 'dsh-claude-settings-button',
        disabled: busy,
        onClick: () => picker.current!.click(),
      }, image === null ? settingsCopy('brandImageUpload', 'Upload') : settingsCopy('brandImageReplace', 'Replace')),
      image === null ? null : React.createElement('button', {
        type: 'button',
        className: 'dsh-claude-settings-button',
        disabled: busy,
        onClick: () => run(removeBrandImage(props.kind)),
      }, settingsCopy('brandImageRemove', 'Remove')),
    ),
    error === null ? null : React.createElement('div', { className: 'dsh-claude-brand-image-error', role: 'alert' }, error),
  )
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
      'aria-label': settingsCopy('brandAccentTitle', 'Accent colour'),
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => change(event.target.value),
      onBlur: () => flush(draft),
    }),
    draft === ''
      ? React.createElement('span', { className: 'dsh-claude-brand-accent-note' }, settingsCopy('brandAccentUnset', 'Brand\'s own'))
      : React.createElement('button', {
        type: 'button',
        className: 'dsh-claude-settings-button',
        disabled: props.disabled === true,
        onClick: () => flush(''),
      }, settingsCopy('brandAccentReset', 'Use the brand\'s accent')),
  )
}

/**
 * The accent colour as Colours' sub-row (D42): the accent paints only over
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
      settingsCopy('brandAccentTitle', 'Accent colour'),
      settingsCopy('brandAccentDesc', 'The colour of buttons, selected marks, links and focus rings; unset keeps the brand\'s own. No effect while Colours follows the host.'),
      React.createElement(BrandAccentControl, { stored: prefs.brandAccent, write, disabled: !enabled }),
      enabled,
    ),
  }
}

/** The custom brand rows, ranked after the mascot's placement row (rank 40). */
export function brandRows(view: SettingsView): SettingsRow[] {
  const { prefs, write, controls } = view
  const inkOptions = [
    { value: BRAND_INK_ORIGINAL, label: settingsCopy('brandInkOriginal', 'Original') },
    { value: BRAND_INK_TEXT, label: settingsCopy('brandInkText', 'Text colour') },
  ]
  return [
    {
      rank: 50,
      node: controls.row(
        'brandName',
        settingsCopy('brandNameTitle', 'Brand name'),
        settingsCopy('brandNameDesc', 'Replaces the brand text at the top of the sidebar. Leave empty to keep the chosen brand\'s own wordmark.'),
        React.createElement(BrandNameInput, { stored: prefs.brandName, write }),
      ),
    },
    {
      rank: 51,
      node: controls.row(
        'brandMark',
        settingsCopy('brandMarkTitle', 'Brand mark'),
        settingsCopy('brandMarkDesc', 'Replaces the brand mark in the sidebar, the collapsed rail, the home page and the account row\'s fallback picture. PNG, SVG or WebP, up to 2 MB.'),
        React.createElement(BrandImageControl, { kind: 'mark' }),
      ),
    },
    {
      rank: 52,
      node: controls.row(
        'brandWordmark',
        settingsCopy('brandWordmarkTitle', 'Wordmark'),
        settingsCopy('brandWordmarkDesc', 'Replaces the brand name beside the mark, sized from the image\'s proportions, and wins over the brand name. PNG, SVG or WebP, up to 2 MB.'),
        React.createElement(BrandImageControl, { kind: 'wordmark' }),
      ),
    },
    {
      rank: 53,
      node: controls.row(
        'brandInk',
        settingsCopy('brandInkTitle', 'Image colours'),
        settingsCopy('brandInkDesc', 'Original keeps the images\' own colours; Text colour fills each image with the text colour where it stands, legible in light and dark.'),
        controls.segment(inkOptions, prefs.brandInk, value => { write({ brandInk: value }) }),
      ),
    },
  ]
}
