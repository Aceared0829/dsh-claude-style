import { BRAND_ATTR, BRAND_DEEPSEEK, COMPOSER_ATTR, DOCK_LOOK_ATTR, DOCK_LOOK_CARD, DOCK_LOOK_FLUSH, FOOTER_ATTR, MASCOT_ATTR, MASCOT_BRAND, MASCOT_CRAB, MASCOT_DEEPY, MOTION_ATTR, MOTION_FULL, MOTION_REDUCED, PACKAGE_NAME, PALETTE_ATTR, PREF_DEFAULTS, SEARCH_STYLE_ATTR, SETTINGS_ENTRY_FALLBACK, SIDEBAR_LAYOUT_ATTR, STATS_POSITION_ATTR, STATUS_MOTION_ATTR, TYPEFACE_ATTR } from '../constants'
import type { PrefKey, Prefs } from '../constants'
import type { HostContext } from './host'
import type { HostConfigForm, HostConfigFormsService, HostRemoteSettings, HostSettingsDescribeAnswer } from '@dsh-claude-style/contracts/services'
import { clampPrefs, PREFS } from '@dsh-claude-style/contracts/prefs'
import { notifyAll } from '@dsh-claude-style/engine/notify'
import { pageOwner } from '../shared/visual-owner'

/**
 * Skin preferences: the host settings namespace is the store, and every
 * value is mirrored onto the document as an attribute so the stylesheet
 * decides what it means (D11). Until the first read settles — and if
 * it fails — the table's defaults hold. The clamp that turns a stored value
 * into one of these is the table's own (packages/contracts/src/prefs.ts, D73).
 */
export let prefs = clampPrefs({})
const prefsListeners: ((prefs: Prefs) => void)[] = []

/** The official settings form (the host's form controller, D11); null until the service serves the namespace. */
let prefsForm: HostConfigForm | null = null
/** Disposer for the bound form's own change subscription. */
let prefsFormUnsubscribe: (() => void) | null = null
/** Disposer for the served-namespace directory watch, while one is open. */
let prefsWatchOff: (() => void) | null = null
/** Whether the served-namespace directory is already being watched. */
let prefsBinding = false
/** Disposers for the document reads a non-loopback page follows (D11); empty on a loopback page. */
let remoteReadOffs: (() => void)[] = []
/** Whether this page reads the host's settings document without a form to write through (D11). */
let prefsReadOnly = false

/** Namespaces to try, best first: loader entry id, package name, inserted id. */
function settingsNamespaceCandidates(ctx: HostContext) {
  // The dynamic façade can hide the fiber; the other two candidates remain.
  const id = ctx?.fiber?.entry?.id
  const entryId = typeof id === 'string' && id !== '' ? id.slice(id.lastIndexOf(':') + 1) : null
  return [entryId, PACKAGE_NAME, SETTINGS_ENTRY_FALLBACK]
}

/**
 * The namespace the host actually serves, picked from the candidates.
 *
 * The loader mints a random id for each boot entry, so asking for our own
 * entry id hands back a controller for nobody's namespace: reads stay at the
 * defaults and every write is refused. The served list is the truth.
 */
function servedNamespace<Served extends { ns?: unknown }>(namespaces: Served[] | undefined, candidates: (string | null)[]) {
  if (!namespaces) return null
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate === '') continue
    const served = namespaces.find((entry) => entry?.ns === candidate)
    if (served !== undefined) return { namespace: candidate, served }
  }
  return null
}

/** Whether the host serves namespaces to the browser. */
function hostConfigForms(ctx: HostContext | null): HostConfigFormsService | null {
  const forms = ctx?.get('configForms')
  return typeof forms?.get === 'function' ? forms : null
}

/** The form's current field values, or null while it is not ready. */
function readFormValue(): Record<string, unknown> | null {
  const snapshot = prefsForm?.getSnapshot()
  if (snapshot?.status !== 'ready') return null
  return snapshot.value && typeof snapshot.value === 'object' ? snapshot.value as Record<string, unknown> : null
}

/** Bind one namespace the host already serves; the controller waits for its own snapshot. */
function bindServedForm(forms: HostConfigFormsService, ctx: HostContext) {
  const match = servedNamespace(forms.describe?.()?.getSnapshot?.()?.view?.namespaces, settingsNamespaceCandidates(ctx))
  if (match === null) return false
  const form = forms.get(match.namespace)
  if (typeof form?.getSnapshot !== 'function') return false
  prefsForm = form
  // A form without a subscribe face leaves the reads on demand.
  if (typeof form.subscribe === 'function') prefsFormUnsubscribe = form.subscribe(loadPrefs)
  return true
}

/**
 * Watch the served-namespace directory until this plugin's namespace lands:
 * on a cold page the directory can answer after this plugin has applied.
 */
function watchNamespace(forms: HostConfigFormsService, ctx: HostContext) {
  if (prefsBinding) return
  const mirror = forms.describe?.()
  if (!mirror) return
  prefsBinding = true
  const attempt = () => {
    if (prefsForm === null && !bindServedForm(forms, ctx)) return
    if (prefsWatchOff !== null) {
      prefsWatchOff()
      prefsWatchOff = null
    }
    loadPrefs()
  }
  if (typeof mirror.subscribe === 'function') prefsWatchOff = mirror.subscribe(attempt)
  if (typeof mirror.ensure === 'function') mirror.ensure()
  attempt()
}

/**
 * Follow the settings document on a page whose form service never reads it
 * (D11): the host keeps a non-loopback page's settings in memory, but its own
 * remote still answers the read the form service is built on. Read again when
 * the document changes and after a reconnect, which can miss that event.
 */
function followHostDocument(ctx: HostContext) {
  if (typeof ctx.inject !== 'function') return
  prefsReadOnly = true
  const candidates = settingsNamespaceCandidates(ctx)
  // The remote's namespaces are reachable only from a scope that injected them.
  const fiber = ctx.inject(['remote.settings'], scope => {
    const settings: HostRemoteSettings = scope.get('remote.settings')
    const read = () => {
      settings.describe().then((answer: HostSettingsDescribeAnswer) => {
        if (!prefsReadOnly) return
        if (answer.ok !== true) throw new Error(`dsh-claude-style: the settings document refused the read: ${answer.error?.message}`)
        const match = servedNamespace(answer.value?.namespaces, candidates)
        if (match === null) return
        adoptPrefs(clampPrefs(match.served.value))
      })
    }
    scope.effect(() => {
      const offs = [scope.get('remote').$on('settings/document-updated', read)]
      if (typeof scope.on === 'function') offs.push(scope.on('connection/reset', read))
      read()
      return () => { for (const off of offs) off() }
    }, 'dsh-claude-style: settings document')
  })
  remoteReadOffs.push(() => fiber.dispose())
}

/**
 * Bind the official form. Called once per install, before the first read, and
 * again when the settings page installs — the service may mount after this
 * plugin. A namespace the host does not serve yet leaves `prefsForm` null and
 * the defaults in place, so this never blocks or fails the skin. A page the
 * host keeps its settings away from reads the document instead (D11).
 */
export function adoptSettingsForm(ctx: HostContext) {
  if (prefsForm === null && !prefsReadOnly) {
    const forms = hostConfigForms(ctx)
    if (forms === null) return false
    if (forms.describe?.()?.getSnapshot?.()?.status === 'unavailable') {
      followHostDocument(ctx)
      return false
    }
    if (!bindServedForm(forms, ctx)) watchNamespace(forms, ctx)
  }
  if (prefsForm === null) return false
  loadPrefs()
  return true
}

/**
 * Whether the preferences on show are the host's but this page cannot save
 * them: the host keeps a non-loopback page's settings to itself (D11).
 */
export function prefsAreReadOnly() {
  return prefsReadOnly
}

/** Release the form, directory and document subscriptions this module opened. */
export function disposePrefsBinding() {
  if (prefsFormUnsubscribe !== null) {
    prefsFormUnsubscribe()
    prefsFormUnsubscribe = null
  }
  if (prefsWatchOff !== null) {
    prefsWatchOff()
    prefsWatchOff = null
  }
  for (const off of remoteReadOffs) off()
  remoteReadOffs = []
  prefsReadOnly = false
  prefsBinding = false
  prefsForm = null
}

/**
 * Runtime overrides that outrank the stored preferences: a feature retired
 * after failing hands its surface back to the host, because both of these
 * HIDE host controls and a takeover whose replacement is gone would leave
 * nothing in their place.
 */
let footerTakeoverRetired = false
export let composerRestyleRetired = false

/** Give the sidebar footer back to the host for the rest of this generation. */
export function retireFooterTakeover() {
  footerTakeoverRetired = true
  document.body.removeAttribute(FOOTER_ATTR)
}

/** Give the composer back to the host for the rest of this generation. */
export function retireComposerRestyle() {
  composerRestyleRetired = true
  document.body.removeAttribute(COMPOSER_ATTR)
}

/** The current preferences (live object; treat as read-only). */
export function readPrefs() {
  return prefs
}

/** Observe preference changes; returns the unsubscriber. */
export function subscribePrefs(listener: (prefs: Prefs) => void) {
  prefsListeners.push(listener)
  return () => {
    const index = prefsListeners.indexOf(listener)
    if (index !== -1) prefsListeners.splice(index, 1)
  }
}

/**
 * The document mirror: one entry per preference the stylesheet switches on,
 * with the attribute it rides and the resolver that turns the preference into
 * what the rules test (the resolved mascot, the dock's look, the footer's
 * presence). One list is the whole contract with the stylesheets: `adoptPrefs`
 * writes these and `clearPrefsAttributes` takes the same names back (entry.ts).
 * Its entries are literals so the build can hold every attribute a stylesheet
 * reads to a name written here (D9).
 */
interface PrefMirror {
  key: PrefKey
  attr: string
  /** The value to write; a `false` takes the attribute off. */
  value(prefs: Prefs): string | boolean
}

const MIRRORS = [
  { key: 'brand', attr: BRAND_ATTR, value: (prefs: Prefs) => prefs.brand },
  { key: 'palette', attr: PALETTE_ATTR, value: (prefs: Prefs) => prefs.palette },
  { key: 'typeface', attr: TYPEFACE_ATTR, value: (prefs: Prefs) => prefs.typeface },
  { key: 'mascot', attr: MASCOT_ATTR, value: resolveMascot },
  { key: 'dockCards', attr: DOCK_LOOK_ATTR, value: (prefs: Prefs) => prefs.dockCards ? DOCK_LOOK_CARD : DOCK_LOOK_FLUSH },
  { key: 'searchStyle', attr: SEARCH_STYLE_ATTR, value: (prefs: Prefs) => prefs.searchStyle },
  { key: 'sidebarLayout', attr: SIDEBAR_LAYOUT_ATTR, value: (prefs: Prefs) => prefs.sidebarLayout },
  { key: 'statsPosition', attr: STATS_POSITION_ATTR, value: (prefs: Prefs) => prefs.statsPosition },
  { key: 'statusMotion', attr: STATUS_MOTION_ATTR, value: (prefs: Prefs) => prefs.statusMotion },
  { key: 'collapseFooter', attr: FOOTER_ATTR, value: (prefs: Prefs) => prefs.collapseFooter && !footerTakeoverRetired },
] as const satisfies readonly PrefMirror[]

/** Every attribute the mirror writes, plus the animation answer `writeMotionAttribute` resolves. */
const MIRROR_ATTRS: readonly string[] = [...MIRRORS.map(mirror => mirror.attr), MOTION_ATTR]

/**
 * Adopt a preference set: mirror it onto the document, then notify. A page a
 * skin or ds-bot owns carries none of this theme's attributes (D74): the set is
 * kept, and taking the page back mirrors it (entry.ts). The form answers
 * whenever it answers, and the settings section installs whenever its chunk
 * arrives (D72), so a yielded page hears adoptions too.
 */
export function adoptPrefs(next: Prefs) {
  prefs = next
  if (pageOwner() === null) {
    for (const mirror of MIRRORS) {
      const value = mirror.value(next)
      if (value === false) document.body.removeAttribute(mirror.attr)
      else document.body.setAttribute(mirror.attr, String(value))
    }
    writeMotionAttribute(next.motion)
  }
  notifyAll(prefsListeners, next)
}

/** Take back every attribute adoptPrefs mirrors onto the document: the page goes back to the host (entry.ts). */
export function clearPrefsAttributes() {
  for (const name of MIRROR_ATTRS) document.body.removeAttribute(name)
}

/** Whether the operating system asks for reduced motion right now. */
function systemPrefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Resolve the animation choice onto the document. Only the two answers the
 * rest of the plugin acts on reach the attribute: a stylesheet cannot rewrite
 * its own media queries, so "always play" has to be a value the rules test.
 */
function writeMotionAttribute(mode: string) {
  const reduced = mode === MOTION_REDUCED || (mode !== MOTION_FULL && systemPrefersReducedMotion())
  document.body.setAttribute(MOTION_ATTR, reduced ? MOTION_REDUCED : MOTION_FULL)
}

/**
 * Re-resolve the current choice when the system's own setting flips. The
 * listeners hear about it only when the resolved answer really moved, because
 * features act on that answer rather than reading it lazily (D40).
 */
export function refreshMotionAttribute() {
  const before = document.body.getAttribute(MOTION_ATTR)
  writeMotionAttribute(prefs.motion)
  if (document.body.getAttribute(MOTION_ATTR) !== before) notifyAll(prefsListeners, prefs)
}

/**
 * Re-run everything that asked to hear about the environment without the
 * stored preferences having changed: the other chat plugin appearing or
 * leaving (packages/client/src/shared/peer-plugin.ts, D74).
 */
export function notifyEnvironmentChange() {
  notifyAll(prefsListeners, prefs)
}

/**
 * Whether the skin must hold its animations still, right now. The mascots ask
 * this instead of the media query, which cannot express "always play".
 */
export function motionReduced() {
  const resolved = document.body.getAttribute(MOTION_ATTR)
  if (resolved === MOTION_REDUCED) return true
  if (resolved === MOTION_FULL) return false
  return systemPrefersReducedMotion()
}

/**
 * Read the preferences from the form, once it carries values. The form's
 * subscription calls this on every host change; the binding calls it for
 * values that were ready before the subscription settled.
 */
export function loadPrefs() {
  const value = readFormValue()
  if (value === null) return
  adoptPrefs(clampPrefs(value))
  moveLocalPrefs(value)
}

/** The mascot actually on the page: `brand` resolves through the brand. */
export function resolveMascot(current: Prefs) {
  if (current.mascot !== MASCOT_BRAND) return current.mascot
  return current.brand === BRAND_DEEPSEEK ? MASCOT_DEEPY : MASCOT_CRAB
}

/**
 * Values an earlier build kept in this browser's local storage, by preference:
 * the first time the form carries values, each field the form does not hold
 * yet is written through the form and the local copy dropped.
 */
const LOCAL_PREF_KEYS: Partial<Record<PrefKey, string>> = {
  username: 'dsh-claude-style.username',
  banLocale: 'dsh-claude-style.banLocale',
}
let localPrefsMoved = false

/** Whether a stored local value is one this build still accepts for that preference. */
function localValueUsable(key: PrefKey, stored: string) {
  const spec = PREFS[key]
  if (stored === '' || stored === spec.default) return false
  if (spec.type === 'choice') return spec.values.some((value: string) => value === stored)
  if (spec.type === 'text') return stored.trim().length <= spec.max
  return false
}

function moveLocalPrefs(formValue: Record<string, unknown>) {
  if (localPrefsMoved) return
  localPrefsMoved = true
  for (const [key, storageKey] of Object.entries(LOCAL_PREF_KEYS) as [PrefKey, string][]) {
    const stored = localStorage.getItem(storageKey)
    if (stored === null) continue
    const held = formValue[key] !== undefined && formValue[key] !== PREF_DEFAULTS[key]
    if (held || !localValueUsable(key, stored)) {
      localStorage.removeItem(storageKey)
      continue
    }
    // The value was held to the table just above, and each key here is one of
    // the two string-shaped preferences: the write carries its own type.
    savePrefs({ [key]: stored } as Partial<Prefs>).then(saved => {
      if (saved !== null && saved[key] === stored) localStorage.removeItem(storageKey)
    })
  }
}

/**
 * Write a partial preference change through the official form: one `set()` per
 * field, chained, because the controller owns the write queue and takes its
 * revision fence from the last settlement.
 *
 * @returns a promise for the resolved preferences, or null when the form does
 *          not carry values yet or refused the change.
 */
export function savePrefs(patch: Partial<Prefs>): Promise<Prefs | null> {
  const form = prefsForm
  if (readFormValue() === null || form === null) return Promise.resolve(null)
  const step = (name: keyof Prefs) => (accepted: boolean): boolean | Promise<boolean> => {
    if (accepted === false) return false
    let pending
    try {
      pending = form.set(name, patch[name])
    } catch (error) {
      // set() refuses a field path this Config does not carry by throwing
      // before anything crosses the wire: a refusal, answered with a re-read
      // (D12).
      return false
    }
    if (typeof pending === 'boolean' || pending === undefined) return typeof pending === 'boolean' ? pending : true
    return pending.then((ok: unknown) => ok === true)
  }
  let run = Promise.resolve(true)
  for (const key of Object.keys(patch) as (keyof Prefs)[]) run = run.then(step(key))
  return run.then(accepted => {
    // Refused (a stale revision, or a field this Config does not carry):
    // re-read rather than guess.
    loadPrefs()
    return accepted === false ? null : prefs
  })
}
