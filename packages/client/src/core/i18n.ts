import { MODEL_COPY_FALLBACK_LOCALE } from '../features/model/copy-fallbacks'
import { hostCtx } from './host'
import type { HostContext, HostText } from './host'
import { modelCopy } from './model-copy'
import { readPrefs } from './prefs'

/** Values for a copy string's `{name}` slots. */
export type CopyParams = Record<string, string | number>

/** One copy line: the text in each language it ships in. */
export type CopyPair = Readonly<Record<string, string>>

/** A feature's own copy, by key (its `<功能>.copy.json`). */
export type CopyEntries = Readonly<Record<string, CopyPair>>

/**
 * The language a copy line falls back to when the shell's own language has no
 * line for it. A feature's copy ships with the bundle, so every line is written
 * in this language as well (`<功能>.copy.json` beside the feature).
 */
export const COPY_FALLBACK_LOCALE = 'en'

/** The shell's active locale id, or the document fallback when it cannot be read. */
export function activeLocale(ctx?: HostContext | null): string {
  const active = (ctx || hostCtx)?.get('locale')?.getSnapshot().active
  if (typeof active === 'string' && active) return active
  return modelCopy === null ? MODEL_COPY_FALLBACK_LOCALE : modelCopy.fallback
}

/**
 * The host's `chat` namespace translate seat, or null where the host carries no
 * locale service. A surface with no context of its own — the settings page —
 * reads the host's words through the module's context (core/host).
 */
export function hostChatSeat(ctx?: HostContext | null): HostText | null {
  const locale = (ctx || hostCtx)?.get('locale')
  return typeof locale?.bind === 'function' ? locale.bind('chat') : null
}

/**
 * One string out of the host's own `chat` namespace, or `fallback` where the
 * host carries no locale service or no such string: a seat that hands the key
 * back has no translation for it.
 */
export function hostChatCopy(key: string, fallback: string, ctx?: HostContext | null) {
  const text = hostChatSeat(ctx)?.(key)
  return typeof text === 'string' && text !== '' && text !== key ? text : fallback
}

/** Fill a copy string's `{name}` slots from `params`; a slot with no value stays as written. */
function fillTemplate(text: string, params?: CopyParams) {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match)
}

/** One localized string out of a `{ locale: text }` pair, fallback locale last. */
export function localized(pair: Record<string, unknown> | null | undefined, ctx?: HostContext | null) {
  if (!pair || typeof pair !== 'object') return ''
  const loc = activeLocale(ctx)
  const text = pair[loc]
  if (typeof text === 'string' && text) return text
  const prefix = typeof loc === 'string' && loc.includes('-') ? loc.split('-')[0] : (typeof loc === 'string' && loc.includes('_') ? loc.split('_')[0] : '')
  const prefixed = pair[prefix]
  if (prefix && typeof prefixed === 'string' && prefixed) return prefixed
  const fallback = modelCopy === null ? MODEL_COPY_FALLBACK_LOCALE : modelCopy.fallback
  const backstop = pair[fallback]
  if (typeof backstop === 'string' && backstop) return backstop
  const fallbackPrefix = typeof fallback === 'string' && fallback.includes('-') ? fallback.split('-')[0] : ''
  const fallbackPrefixed = pair[fallbackPrefix]
  if (fallbackPrefix && typeof fallbackPrefixed === 'string' && fallbackPrefixed) return fallbackPrefixed
  return ''
}

/**
 * One line of a feature's own copy: the shell's language first, then the
 * language the copy ships in. The key is the feature's own — its copy file is
 * the only place the line exists — and the build holds every call to one, so a
 * line that is not there is a build failure rather than a runtime question.
 */
export function featureCopy(entries: CopyEntries, key: string, params?: CopyParams) {
  const pair = entries[key]
  return fillTemplate(pair === undefined ? key : localized(pair), params)
}

/**
 * One line of a feature's copy in a language named by a preference rather than
 * by the shell: the account-hold screen reproduces a real Claude page, so it is
 * read in the language that page was written in whatever the UI is set to.
 */
export function copyIn(entries: CopyEntries, key: string, locale: string, params?: CopyParams) {
  const pair = entries[key]
  const text = pair === undefined ? '' : (pair[locale] || pair[COPY_FALLBACK_LOCALE] || '')
  return fillTemplate(text === '' ? key : text, params)
}

/**
 * One picker label: the document's localized string, else the neutral
 * English constant the bundle carries. `{name}` placeholders are filled
 * from `params`, so a label with a slot stays translatable.
 */
export function copyLabel(key: string, fallback: string, params?: CopyParams) {
  const text = modelCopy === null || !modelCopy.ui ? '' : localized(modelCopy.ui[key])
  return fillTemplate(text || fallback, params)
}

/**
 * One settings-page string. The settings copy rides the same document as
 * the picker copy, so the page follows the shell language too — and the
 * English constants stay as the fallback for a failed fetch.
 */
export function settingsCopy(key: string, fallback: string, params?: CopyParams) {
  const text = modelCopy === null || !modelCopy.settings ? '' : localized(modelCopy.settings[key])
  return fillTemplate(text || fallback, params)
}

/**
 * One account-hold easter-egg string, in the language the `banLocale`
 * preference names — NOT the shell's language. The page reproduces a real
 * Claude screen, so it is read in the language Claude wrote it in whatever
 * the rest of the UI is set to; `localized` is bypassed on purpose rather
 * than fed a fake locale, so a missing translation still falls through the
 * document's own fallback locale.
 */
export function banCopy(key: string, fallback: string, params?: CopyParams) {
  const pair = modelCopy === null || !modelCopy.ban ? null : modelCopy.ban[key]
  const want = readPrefs().banLocale
  const wanted = pair && typeof pair === 'object' ? pair[want] : undefined
  let text = typeof wanted === 'string' ? wanted : ''
  if (!text) text = localized(pair)
  return fillTemplate(text || fallback, params)
}
