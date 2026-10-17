import { hostConfigForms } from './host'
import type { HostContext } from './host'
import type { HostConfigForm, HostConfigFormsService } from '@dsh-claude-style/contracts/services'

/**
 * The binding to the host's settings namespace (D75, D73): the host's form
 * controller is the store, and this module finds the namespace the host serves,
 * follows its values and writes a change through it. What the values mean
 * (which keys exist, how a stored value is held to the table, what is mirrored
 * onto the page) is the skin's, and comes in through the adopt function.
 */

export interface SettingsBindingOptions {
  /** Namespaces to try after the loader's entry id, best first: the package name, the id the host inserted under. */
  namespaces: string[]
  /** The form's current values, once it carries them; runs on every host change. */
  adoptForm(value: Record<string, unknown>): void
}

/** The served-namespace entry a namespace candidate matched. */
function servedNamespace<Served extends { ns?: unknown }>(namespaces: Served[] | undefined, candidates: (string | null)[]) {
  if (!namespaces) return null
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate === '') continue
    const served = namespaces.find((entry) => entry?.ns === candidate)
    if (served !== undefined) return { namespace: candidate, served }
  }
  return null
}

export function createSettingsBinding(options: SettingsBindingOptions) {
  /** The official settings form (the host's form controller); null until the service serves the namespace. */
  let form: HostConfigForm | null = null
  /** Disposer for the bound form's own change subscription. */
  let formUnsubscribe: (() => void) | null = null
  /** Disposer for the served-namespace directory watch, while one is open. */
  let watchOff: (() => void) | null = null
  /** Whether the served-namespace directory is already being watched. */
  let binding = false

  /**
   * Namespaces to try, best first: loader entry id, then the package's own
   * names. The loader mints a random id for each boot entry, so asking for our
   * own entry id can hand back a controller for nobody's namespace; the served
   * list is the truth.
   */
  function candidatesOf(ctx: HostContext) {
    // The dynamic façade can hide the fiber; the other candidates remain.
    const id = ctx?.fiber?.entry?.id
    const entryId = typeof id === 'string' && id !== '' ? id.slice(id.lastIndexOf(':') + 1) : null
    return [entryId, ...options.namespaces]
  }

  /** The form's current field values, or null while it is not ready. */
  function readValue(): Record<string, unknown> | null {
    const snapshot = form?.getSnapshot()
    if (snapshot?.status !== 'ready') return null
    return snapshot.value && typeof snapshot.value === 'object' ? snapshot.value as Record<string, unknown> : null
  }

  /**
   * Read the values from the form, once it carries them. The form's
   * subscription calls this on every host change; the binding calls it for
   * values that were ready before the subscription settled.
   */
  function read() {
    const value = readValue()
    if (value === null) return
    options.adoptForm(value)
  }

  /** Bind one namespace the host already serves; the controller waits for its own snapshot. */
  function bindServedForm(forms: HostConfigFormsService, ctx: HostContext) {
    const match = servedNamespace(forms.describe?.()?.getSnapshot?.()?.view?.namespaces, candidatesOf(ctx))
    if (match === null) return false
    const bound = forms.get(match.namespace)
    if (typeof bound?.getSnapshot !== 'function') return false
    form = bound
    // A form without a subscribe face leaves the reads on demand.
    if (typeof bound.subscribe === 'function') formUnsubscribe = bound.subscribe(read)
    return true
  }

  /** Stop following the served-namespace directory. */
  function stopWatching() {
    if (watchOff === null) return
    watchOff()
    watchOff = null
  }

  /**
   * Watch the served-namespace directory until this plugin's namespace lands:
   * on a cold page the directory can answer after this plugin has applied.
   */
  function watchNamespace(forms: HostConfigFormsService, ctx: HostContext) {
    if (binding) return
    const mirror = forms.describe?.()
    if (!mirror) return
    binding = true
    const attempt = () => {
      if (form === null && !bindServedForm(forms, ctx)) return
      stopWatching()
      read()
    }
    if (typeof mirror.subscribe === 'function') watchOff = mirror.subscribe(attempt)
    if (typeof mirror.ensure === 'function') mirror.ensure()
    attempt()
  }

  return {
    read,

    /**
     * Bind the official form. Called once per install, before the first read,
     * and again when the settings page installs — the service may mount after
     * this plugin. A namespace the host does not serve yet leaves the form null
     * and the defaults in place, so this never blocks or fails the skin.
     */
    adopt(ctx: HostContext) {
      if (form === null) {
        const forms = hostConfigForms(ctx)
        if (forms === null) return false
        if (!bindServedForm(forms, ctx)) watchNamespace(forms, ctx)
      }
      if (form === null) return false
      read()
      return true
    },

    /**
     * Write a partial change through the official form: one `set()` per field,
     * chained, because the controller owns the write queue and takes its
     * revision fence from the last settlement.
     *
     * @returns a promise for whether the host accepted every field, or null
     *          when the form does not carry values yet.
     */
    save(patch: Record<string, unknown>): Promise<boolean | null> {
      const bound = form
      if (readValue() === null || bound === null) return Promise.resolve(null)
      const step = (name: string) => (accepted: boolean): boolean | Promise<boolean> => {
        if (accepted === false) return false
        let pending
        try {
          pending = bound.set(name, patch[name])
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
      for (const key of Object.keys(patch)) run = run.then(step(key))
      return run.then(accepted => {
        // Refused (a stale revision, or a field this Config does not carry):
        // re-read rather than guess.
        read()
        return accepted
      })
    },

    /** Release the form and directory subscriptions this binding opened. */
    dispose() {
      if (formUnsubscribe !== null) {
        formUnsubscribe()
        formUnsubscribe = null
      }
      if (watchOff !== null) {
        watchOff()
        watchOff = null
      }
      binding = false
      form = null
    },
  }
}
