import * as React from 'react'
import { BRAND_IMAGE_MAX_BYTES, BRAND_IMAGE_TYPES } from '@dsh-claude-style/contracts/brand'
import type { BrandImageKind } from '@dsh-claude-style/contracts/brand'
import { BRAND_INK_ORIGINAL, BRAND_INK_TEXT, BRAND_NAME_MAX, PALETTE_HOST } from '../../constants'
import { loadBrandImages, readBrandImages, removeBrandImage, subscribeBrandImages, uploadBrandImage } from '../../shared/custom-brand'
import type { SegmentOption, SettingsRow, SettingsView } from './settings-controls'
import type { Prefs } from '../../constants'
import { copy } from './copy'

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

function BrandNameInput(props: { stored: string, write: SettingsView['write'] }) {
  const { draft, change, flush, revert } = useDraft(props.stored, value => props.write({ brandName: value.trim().slice(0, BRAND_NAME_MAX) }))
  return React.createElement('input', {
    type: 'text',
    className: 'dsh-claude-settings-input',
    value: draft,
    maxLength: BRAND_NAME_MAX,
    placeholder: copy('brandNamePlaceholder'),
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
      setError(copy('brandImageFailed', { detail: reason?.message ?? String(reason) }))
    })
  }
  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined) return
    if (BRAND_IMAGE_TYPES[file.type] === undefined) {
      setError(copy('brandImageType'))
      return
    }
    if (file.size > BRAND_IMAGE_MAX_BYTES) {
      setError(copy('brandImageSize'))
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
      }, image === null ? copy('brandImageUpload') : copy('brandImageReplace')),
      image === null ? null : React.createElement('button', {
        type: 'button',
        className: 'dsh-claude-settings-button',
        disabled: busy,
        onClick: () => run(removeBrandImage(props.kind)),
      }, copy('brandImageRemove')),
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

/** The custom brand rows, ranked after the mascot's placement row (rank 40). */
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
        'brandName',
        copy('brandNameTitle'),
        copy('brandNameDesc'),
        React.createElement(BrandNameInput, { stored: prefs.brandName, write }),
      ),
    },
    {
      rank: 51,
      node: controls.row(
        'brandMark',
        copy('brandMarkTitle'),
        copy('brandMarkDesc'),
        React.createElement(BrandImageControl, { kind: 'mark' }),
      ),
    },
    {
      rank: 52,
      node: controls.row(
        'brandWordmark',
        copy('brandWordmarkTitle'),
        copy('brandWordmarkDesc'),
        React.createElement(BrandImageControl, { kind: 'wordmark' }),
      ),
    },
    {
      rank: 53,
      node: controls.row(
        'brandInk',
        copy('brandInkTitle'),
        copy('brandInkDesc'),
        controls.segment(inkOptions, prefs.brandInk, value => { write({ brandInk: value }) }),
      ),
    },
  ]
}
