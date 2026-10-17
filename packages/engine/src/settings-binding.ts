import { hostConfigForms, hostRemote, hostRemoteSettings } from './host'
import type { HostContext } from './host'
import type { HostConfigForm, HostConfigFormsService, HostSettingsDescribeAnswer } from '@dsh-claude-style/contracts/services'
import { skin } from './skin'

/**
 * The binding to the host's settings namespace (D11, D73): the host's form
 * controller is the store, and this module finds the namespace the host serves,
 * follows its values, writes a change through it and, on a page whose settings
 * the host keeps to itself, reads the document instead. What the values mean
 * (which keys exist, how a stored value is held to the table, what is mirrored
 * onto the page) is the skin's, and comes in through the two adopt functions.
 */

export interface SettingsBindingOptions {
  /** Namespaces to try after the loader's entry id, best first: the package name, the id the host inserted under. */
  namespaces: string[]
  /** The form's current values, once it carries them; runs on every host change. */
  adoptForm(value: Record<string, unknown>): void
  /** The settings document of a page with no form to write through. */
  adoptDocument(value: unknown): void
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
  /** Disposers for the document reads a non-loopback page follows; empty on a loopback page. */
  let remoteReadOffs: (() => void)[] = []
  /** Whether this page reads the host's settings document without a form to write through. */
  let readOnly = false

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
      if (form === null && !bindServedForm(forms, ctx)) {
        // The directory settled on "unavailable" after the watch began: this
        // page's settings are the host's to keep, and the document is read instead.
        if (mirror.getSnapshot?.()?.status === 'unavailable') {
          stopWatching()
          followHostDocument(ctx)
        }
        return
      }
      stopWatching()
      read()
    }
    if (typeof mirror.subscribe === 'function') watchOff = mirror.subscribe(attempt)
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
    readOnly = true
    const candidates = candidatesOf(ctx)
    // The remote's namespaces are reachable only from a scope that injected them.
    const fiber = ctx.inject(['remote.settings'], scope => {
      const settings = hostRemoteSettings(scope)
      if (settings === null) throw new Error(`${skin().packageName}: the host carries no remote settings service on a page that reads its document`)
      const readDocument = () => {
        settings.describe().then((answer: HostSettingsDescribeAnswer) => {
          if (!readOnly) return
          if (answer.ok !== true) throw new Error(`${skin().packageName}: the settings document refused the read: ${answer.error?.message}`)
          const match = servedNamespace(answer.value?.namespaces, candidates)
          if (match === null) return
          options.adoptDocument(match.served.value)
        })
      }
      scope.effect(() => {
        const offs = [hostRemote(scope).$on('settings/document-updated', readDocument)]
        if (typeof scope.on === 'function') offs.push(scope.on('connection/reset', readDocument))
        readDocument()
        return () => { for (const off of offs) off() }
      }, `${skin().packageName}: settings document`)
    })
    remoteReadOffs.push(() => fiber.dispose())
  }

  return {
    read,

    /**
     * Bind the official form. Called once per install, before the first read,
     * and again when the settings page installs — the service may mount after
     * this plugin. A namespace the host does not serve yet leaves the form null
     * and the defaults in place, so this never blocks or fails the skin. A page
     * the host keeps its settings away from reads the document instead (D11).
     */
    adopt(ctx: HostContext) {
      if (form === null && !readOnly) {
        const forms = hostConfigForms(ctx)
        if (forms === null) return false
        if (forms.describe?.()?.getSnapshot?.()?.status === 'unavailable') {
          followHostDocument(ctx)
          return false
        }
        if (!bindServedForm(forms, ctx)) watchNamespace(forms, ctx)
      }
      if (form === null) return false
      read()
      return true
    },

    /**
     * Whether the preferences on show are the host's but this page cannot save
     * them: the host keeps a non-loopback page's settings to itself (D11).
     */
    isReadOnly() {
      return readOnly
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

    /** Release the form, directory and document subscriptions this binding opened. */
    dispose() {
      if (formUnsubscribe !== null) {
        formUnsubscribe()
        formUnsubscribe = null
      }
      if (watchOff !== null) {
        watchOff()
        watchOff = null
      }
      for (const off of remoteReadOffs) off()
      remoteReadOffs = []
      readOnly = false
      binding = false
      form = null
    },
  }
}
