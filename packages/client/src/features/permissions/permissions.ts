import { COMPOSER_CARD_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { AUTO_POPOVER_ALL, PERMISSIONS_ATTR } from '../../constants'
import { PERMISSION_ACCESS_NAMESPACE, PERMISSION_CHINESE_LABELS, PERMISSION_CURRENT_LABELS, PERMISSION_HOST_LABEL_KEYS, PERMISSION_HOST_LABEL_LOCALE, PERMISSION_ORDER, PERMISSION_PRESETS, PERMISSION_SEGMENTS, PERMISSION_SHIPPED_PRESETS } from './permission-copy'
import { currentPreset, currentSession, findAccessTrigger, hostLocale, hostRemote, hostRemotePermissionPresets } from '@dsh-claude-style/engine/host'
import { activeLocale } from '../../core/i18n'
import { readPrefs } from '../../core/prefs'
import { buildElement, closestFrom, setAttributeIfChanged } from '@dsh-claude-style/engine/dom'
import { SEGMENTS_CLASS, SEGMENT_CLASS } from '../../shared/segment-control'
import { POPOVER_CLOSE_DELAY, POPOVER_OPEN_DELAY, buildPopoverItem, closeOtherPopovers, createHoverIntent, positionAnchoredPopover, pressKeepsPopoverOpen, registerPopover, removeStrayNodes, setMenuPopoverOpen, unregisterPopover } from '../../shared/popover'
import { createSlidingPill } from '../../shared/sliding-pill'
import type { HostContext, HostFiber } from '@dsh-claude-style/engine/host'
import type { HostPermissionCatalogAnswer, HostPermissionOption } from '@dsh-claude-style/contracts/services'
import type { FeatureUi } from '../../core/feature'
import type manifest from './permissions.manifest'
import { copy } from './copy'
import { createStrayScan } from './stray-nodes'

export function install(ctx: HostContext, ui: FeatureUi<typeof manifest>) {
  let segments: HTMLElement | null = null
  /** The segment group's sliding highlight (packages/client/src/shared/sliding-pill.ts). */
  const segmentPill = createSlidingPill('[data-active]')
  let permContainer: HTMLElement | null = null
  let permBtn: HTMLButtonElement | null = null
  let permLabel: HTMLElement | null = null
  let permPopover: HTMLElement | null = null
  let permHoverIntent: ReturnType<typeof createHoverIntent> | null = null
  /** The pick path the rows call back into; the rows are rebuilt, the path is not. */
  let permPick: ((preset: string) => void) | null = null
  /** Where the tier list hangs off its trigger: above it, left-aligned with it. */
  const PERM_POPOVER_PLACEMENT = { side: 'above-left', gap: 6, important: true } as const

  /**
   * The host's permission catalog: every preset this deployment offers, in
   * the host's order, or null before the first read settles. It is the
   * authority on what is switchable — a third-party plugin's preset rides
   * in it — while PERMISSION_PRESETS decides how a known one reads.
   */
  let catalogOptions: HostPermissionOption[] | null = null
  /**
   * The preset a new session starts in (the catalog's `defaultPreset`: the
   * configured default, or the one the host infers). The cold start screen
   * has no session to read a preset from, so its segments show this one.
   * null until a catalog read settled.
   */
  let defaultPreset: string | null = null
  /** Whether the last pass drew the segments on the cold start screen. */
  let coldStartShown = false
  /** The first catalog failure; thrown on the next sync to retire the feature. */
  let autoPresetError: Error | null = null
  let catalogFiber: HostFiber | null = null
  let catalogChangedDisposer: (() => void) | null = null
  /** What the popover and the segment group currently render, so a change rebuilds them. */
  let renderedRows = ''
  let renderedRowsFor: HTMLElement | null = null
  let renderedSegments = ''

  /** The catalog's entry for one preset, or null. */
  function catalogOption(preset: string): HostPermissionOption | null {
    if (catalogOptions === null) return null
    for (let i = 0; i < catalogOptions.length; i++) {
      const option = catalogOptions[i]
      if (option !== null && typeof option === 'object' && option.value === preset) return option
    }
    return null
  }

  /**
   * Whether the host offers a preset. Until the first read settles the
   * shipped built-ins stand in, which is what the control drew before the
   * catalog existed; a preset the catalog does not carry is not drawn at
   * all, so a deployment that configures fewer presets gets fewer rows
   * rather than dead ones.
   */
  function presetOffered(preset: string) {
    if (catalogOptions === null) return PERMISSION_SHIPPED_PRESETS.includes(preset)
    return catalogOption(preset) !== null
  }

  /** Whether the interface language reads the host's own tier dictionary (D43). */
  function readsHostTierNames() {
    return activeLocale(ctx).startsWith(PERMISSION_HOST_LABEL_LOCALE)
  }

  /**
   * The host's own name for a tier, or '' when the skin's table answers. Claude
   * names the tiers in English and a Chinese interface shows the host's original
   * Chinese names instead. A host that mounts no locale service, and one that
   * never registers the namespace — whose translate seat then answers with the
   * key itself — both leave the skin's table in charge, and so does an entry the
   * host never translated (its `auto.label` is the English name in every
   * language).
   */
  function hostPresetLabel(preset: string): string {
    const key = PERMISSION_HOST_LABEL_KEYS[preset]
    if (key === undefined || !readsHostTierNames()) return ''
    const locale = hostLocale(ctx)
    if (typeof locale?.bind !== 'function') return ''
    const text: string = locale.bind(PERMISSION_ACCESS_NAMESPACE)(key)
    if (typeof text !== 'string' || text === '' || text === key) return ''
    const known = PERMISSION_PRESETS[preset]
    return known !== undefined && known.label === text ? '' : text
  }

  /** The name a preset reads as: the host's own Chinese name first, then the skin's table, then the host's catalog. */
  function presetLabel(preset: string): string {
    const hostName = hostPresetLabel(preset)
    if (hostName !== '') return hostName
    const known = PERMISSION_PRESETS[preset]
    if (known !== undefined) {
      // A Chinese interface takes the skin's own Chinese name where it carries
      // one (PERMISSION_CHINESE_LABELS); the English name is for every other
      // language, and for a tier the host translates itself.
      const chinese = readsHostTierNames() ? PERMISSION_CHINESE_LABELS[preset] : undefined
      return chinese === undefined ? known.label : chinese
    }
    const option = catalogOption(preset)
    if (option !== null && typeof option.name === 'string' && option.name !== '') return option.name
    const current = PERMISSION_CURRENT_LABELS[preset]
    return current === undefined ? preset : current
  }

  /** The name the control reads before a session's preset is known: the tier the host starts a session in. */
  function restingLabel(): string {
    return presetLabel('workspace-write')
  }

  /** The one line under that name, from the same two sources. */
  function presetDesc(preset: string): string {
    const known = PERMISSION_PRESETS[preset]
    if (known !== undefined) return known.desc
    const option = catalogOption(preset)
    return option !== null && typeof option.description === 'string' ? option.description : ''
  }

  /** Every preset the control offers, in the order its rows list them. */
  function offeredPresets() {
    let i
    if (catalogOptions === null) return PERMISSION_SHIPPED_PRESETS.slice()
    const offered: string[] = []
    for (i = 0; i < catalogOptions.length; i++) {
      const option = catalogOptions[i]
      if (option === null || typeof option !== 'object') continue
      if (typeof option.value !== 'string' || option.value === '') continue
      if (!offered.includes(option.value)) offered.push(option.value)
    }
    // The skin's order for the presets it knows; anything else the host
    // offers follows in the host's own order.
    const ordered = []
    for (i = 0; i < PERMISSION_ORDER.length; i++) {
      if (offered.includes(PERMISSION_ORDER[i])) ordered.push(PERMISSION_ORDER[i])
    }
    for (i = 0; i < offered.length; i++) {
      if (!ordered.includes(offered[i])) ordered.push(offered[i])
    }
    return ordered
  }

  /** The segments to draw: each slot bound to the first of its presets the host offers. */
  function resolvedSegments() {
    const out = []
    for (let i = 0; i < PERMISSION_SEGMENTS.length; i++) {
      const slot = PERMISSION_SEGMENTS[i]
      for (let j = 0; j < slot.presets.length; j++) {
        if (!presetOffered(slot.presets[j])) continue
        out.push({ label: slot.label, preset: slot.presets[j] })
        break
      }
    }
    return out
  }

  /**
   * Read the host's permission catalog into `catalogOptions`, and which
   * preset a new session starts in into `defaultPreset`. The shipped
   * picker builds its rows from the same catalog, so it is the authority on
   * what is switchable — including presets a third-party plugin registered.
   * A rejected read retries like the account profile's reads (the client
   * connection may still be coming up at install); once the retries are
   * exhausted the failure is remembered and thrown on the next sync, which
   * retires this feature and hands the shipped access button back (D12).
   */
  const AUTO_PRESET_RETRY_MS = [1000, 5000]
  let autoPresetRetries = 0
  let autoPresetRead = 0
  let autoPresetRetry: ReturnType<typeof setTimeout> | null = null

  /** Invalidate the read in flight and drop any retry still waiting. */
  function dropAutoPresetRead() {
    autoPresetRead++
    if (autoPresetRetry !== null) {
      clearTimeout(autoPresetRetry)
      autoPresetRetry = null
    }
  }

  function probeAutoPreset() {
    const namespace = hostRemotePermissionPresets(ctx)
    if (typeof namespace?.catalog !== 'function') {
      if (typeof ctx.inject !== 'function') {
        autoPresetError = new Error('permission: the host exposes no remote.permissionPresets catalog')
        ui.schedule!()
      }
      return
    }
    dropAutoPresetRead()
    const read = autoPresetRead
    namespace.catalog().then((result: HostPermissionCatalogAnswer) => {
      if (read !== autoPresetRead) return
      if (result === null || typeof result !== 'object' || result.ok !== true ||
          result.value === null || typeof result.value !== 'object' ||
          !Array.isArray(result.value.options) || typeof result.value.defaultPreset !== 'string') {
        autoPresetError = new Error('permission: unexpected permissionPresets catalog shape')
        ui.schedule!()
        return
      }
      autoPresetRetries = 0
      autoPresetError = null
      // The whole option list is kept, not just whether one preset is in
      // it: the rows and the segments are built from what the host serves.
      catalogOptions = result.value.options.slice()
      defaultPreset = result.value.defaultPreset
      ui.schedule!()
    }, () => {
      if (read !== autoPresetRead) return
      if (autoPresetRetries >= AUTO_PRESET_RETRY_MS.length) {
        autoPresetError = new Error(`permission: the permissionPresets catalog read failed ${AUTO_PRESET_RETRY_MS.length + 1} times`)
        ui.schedule!()
        return
      }
      autoPresetRetry = setTimeout(() => {
        autoPresetRetry = null
        probeAutoPreset()
      }, AUTO_PRESET_RETRY_MS[autoPresetRetries++])
    })
  }

  /**
   * The namespace may register after this plugin (the host registers each
   * remote namespace as its package loads), so wait for it the way the
   * account row waits for remote.account; a host without inject gets one
   * read now. The catalog-changed event re-reads when the auto-review
   * integration is registered or dropped while the page stays open.
   */
  function startAutoPresetProbe() {
    if (typeof ctx.inject === 'function') {
      catalogFiber = ctx.inject(['remote.permissionPresets'], scope => {
        scope.effect(() => {
          probeAutoPreset()
          return () => {}
        }, 'dsh-claude-style: permission catalog')
      })
    } else {
      probeAutoPreset()
    }
    const remoteRoot = hostRemote(ctx)
    if (typeof remoteRoot?.$on === 'function') {
      catalogChangedDisposer = remoteRoot.$on('permission-presets/catalog-changed', () => {
        probeAutoPreset()
      })
    }
  }

  /**
   * Build the segment group from the resolved slots. `specs` is what
   * resolvedSegments() returned, so a slot the host cannot serve is simply
   * absent instead of drawn dead.
   */
  function buildSegments(onPick: (preset: string | null) => void, specs: { label: string, preset: string }[]) {
    const group = buildElement('div', SEGMENTS_CLASS)
    group.setAttribute('role', 'radiogroup')
    group.setAttribute('aria-label', copy('permissionGroupLabel'))
    group.setAttribute('data-composer-segments', '')
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i]
      const item = document.createElement('button')
      item.type = 'button'
      item.className = SEGMENT_CLASS
      item.setAttribute('role', 'radio')
      item.setAttribute('data-preset', spec.preset)
      item.textContent = spec.label
      group.appendChild(item)
    }
    group.addEventListener('click', event => {
      const item = closestFrom(event.target, `.${SEGMENT_CLASS}`)
      if (item === null || !group.contains(item)) return
      onPick(item.getAttribute('data-preset'))
    })
    return group
  }

  let permDocPointerListener: ((e: PointerEvent) => void) | null = null
  let permResizeListener: (() => void) | null = null

  /** Whether the hover preference covers this picker: the `all` scope alone. */
  function permHoverOn() {
    return readPrefs().autoPopover === AUTO_POPOVER_ALL
  }

  /**
   * Whether this press leaves the tier card alone
   * (shared/popover.ts::pressKeepsPopoverOpen): the dwell opened it, the
   * pointer is on the trigger, so the press is not a second decision.
   */
  function pressKeepsPermOpen() {
    return pressKeepsPopoverOpen(permHoverOn(), permBtn !== null && permBtn.getAttribute('data-open') === 'true')
  }

  /** Every dismiss route (item pick, outside pointer, resize/scroll, Escape) closes the menu through this one path. */
  function closePermMenu() {
    if (permBtn === null || permPopover === null) return
    permBtn.removeAttribute('data-open')
    permBtn.setAttribute('aria-expanded', 'false')
    setMenuPopoverOpen(permPopover, false)
  }

  /**
   * One popover row for one preset: its name and the line under it from the
   * sources the trigger reads as well, and the active check. No glyph: the
   * tiers read as one list, and a preset's own `icon` — which the host ignores
   * natively — is left out so the rows stay consistent with each other.
   */
  function buildPermRow(preset: string) {
    const built = buildPopoverItem({ role: 'menuitemradio', lines: 2, check: true })
    const item = built.row
    item.setAttribute('data-preset', preset)
    built.text.textContent = presetLabel(preset)
    // Two lines and a check were asked for, so both slots are there.
    built.desc!.textContent = presetDesc(preset)
    built.check!.textContent = '✓'
    built.check!.hidden = true

    item.addEventListener('click', e => {
      e.stopPropagation()
      closePermMenu()
      if (permPick !== null) permPick(preset)
    })

    return item
  }

  /**
   * Rebuild the popover's rows when the set of offered presets or any row's
   * name changes. Rows come from the host's catalog, so a preset a plugin
   * registers while the page stays open appears without a reload, and one it
   * withdraws disappears; the names carry the interface language, so a
   * language switch repaints the rows here. An unchanged signature leaves the
   * DOM alone (the pass runs on every mutation).
   *
   * The rendered signature is kept WITH the element it was rendered into: a
   * new popover starts empty (the hero view takes the old one out of the
   * tree), so a signature that merely matches the previous one must not
   * skip filling this one.
   */
  function syncPermRows() {
    if (permPopover === null) return
    const wanted = offeredPresets()
    const signature = wanted.map(preset => `${preset}=${presetLabel(preset)}`).join('|')
    if (signature === renderedRows && renderedRowsFor === permPopover) return
    renderedRows = signature
    renderedRowsFor = permPopover
    while (permPopover.firstChild !== null) permPopover.removeChild(permPopover.firstChild)
    for (let i = 0; i < wanted.length; i++) permPopover.appendChild(buildPermRow(wanted[i]))
  }

  registerPopover('permission', closePermMenu)

  /** Put an open tier card back over its trigger; every other place leaves it where it was. */
  function placeOpenPermCard() {
    if (permBtn === null || permPopover === null) return
    if (permBtn.getAttribute('data-open') !== 'true') return
    positionAnchoredPopover(permBtn, permPopover, PERM_POPOVER_PLACEMENT)
  }

  function buildPermTriggerAndPopover(onPick: (preset: string) => void) {
    permPick = onPick
    const container = buildElement('div', 'dsh-claude-perm-container')

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'dsh-claude-perm-btn'
    btn.setAttribute('aria-haspopup', 'menu')
    btn.setAttribute('aria-expanded', 'false')

    const label = buildElement('span', 'dsh-claude-perm-label', restingLabel())

    btn.appendChild(label)

    const popover = buildElement('div', 'dsh-claude-popover-card dsh-claude-perm-popover')
    setMenuPopoverOpen(popover, false)

    function openPerm() {
      // A trigger the page cannot act through (the cold start screen) never
      // opens its card: the press belongs to the workspace pick under it.
      if (btn.disabled) return
      if (permHoverIntent) permHoverIntent.cancel()
      closeOtherPopovers('permission')
      positionAnchoredPopover(btn, popover, PERM_POPOVER_PLACEMENT)
      btn.setAttribute('data-open', 'true')
      btn.setAttribute('aria-expanded', 'true')
      setMenuPopoverOpen(popover, true)
    }

    permHoverIntent = createHoverIntent(openPerm, closePermMenu, POPOVER_OPEN_DELAY, POPOVER_CLOSE_DELAY)

    // The listeners read the intent in force when they fire: a rebuild replaces it.
    btn.addEventListener('mouseenter', () => {
      if (permHoverOn()) permHoverIntent!.scheduleOpen()
    })
    btn.addEventListener('mouseleave', () => {
      if (permHoverOn()) permHoverIntent!.scheduleClose()
    })
    popover.addEventListener('mouseenter', () => {
      permHoverIntent!.cancel()
    })
    popover.addEventListener('mouseleave', () => {
      permHoverIntent!.scheduleClose()
    })

    btn.addEventListener('click', e => {
      e.stopPropagation()
      if (btn.getAttribute('data-open') === 'true') {
        // A press on the card the dwell just opened leaves it up: the reader's
        // hand is already on the trigger, and it is the leave that closes.
        if (pressKeepsPermOpen()) return
        closePermMenu()
      } else {
        openPerm()
      }
    })

    if (!permDocPointerListener) {
      permDocPointerListener = e => {
        if (permPopover && permBtn && permPopover.getAttribute('data-open') === 'true') {
          // A SECOND button of the mouse must not fold the card either: the
          // pointer never left the trigger, so this is not the reader's way out.
          if (permBtn.contains(e.target as Node)) {
            if (!pressKeepsPermOpen()) closePermMenu()
            return
          }
          if (!permPopover.contains(e.target as Node)) closePermMenu()
        }
      }
      document.addEventListener('pointerdown', permDocPointerListener)
    }

    if (!permResizeListener) {
      permResizeListener = () => {
        if (permPopover && permBtn && permPopover.getAttribute('data-open') === 'true') closePermMenu()
      }
      window.addEventListener('resize', permResizeListener)
      window.addEventListener('scroll', permResizeListener, true)
    }

    container.appendChild(btn)
    // One popover per generation: a rebuild whose container a host
    // re-render dropped strands the previous popover in the document, so
    // installing this one sweeps every popover already there.
    removeStrayNodes(document, '.dsh-claude-perm-popover', [])
    document.body.appendChild(popover)

    return {
      container,
      btn,
      label,
      popover
    }
  }

  /**
   * Mirror the running preset onto the trigger and its rows. `inert` marks the
   * cold start screen, which has no session to switch: the trigger reads the
   * preset a new session starts in and takes no input, so a press falls through
   * to the workspace pick the card itself performs.
   */
  function updatePermState(preset: string | null, inert: boolean) {
    if (!permLabel || !permPopover) return
    if (permBtn !== null && permBtn.disabled !== inert) permBtn.disabled = inert
    if (inert && permPopover.getAttribute('data-open') === 'true') closePermMenu()
    // The rows follow the host's catalog: one it does not serve is not
    // drawn at all, and one it starts serving appears.
    syncPermRows()
    // The running preset reads under the name the interface language gives
    // it; a value no preset carries (the host's `custom`) reads as the host's
    // own word for it rather than as the machine value.
    const matchedLabel = preset === null ? restingLabel() : presetLabel(preset)
    // Same-value guards: this runs on every pass, and an identical write still
    // lands — a replaced text node, a written attribute — a mutation that
    // schedules the next pass, so the page never went idle.
    if (permLabel.textContent !== matchedLabel) permLabel.textContent = matchedLabel

    const items = permPopover.querySelectorAll('[data-preset]')
    for (let j = 0; j < items.length; j++) {
      const it = items[j]
      const isCurrent = it.getAttribute('data-preset') === preset
      const check = it.querySelector<HTMLElement>('.dsh-claude-popover-check')
      if (check) check.toggleAttribute('hidden', !isCurrent)
      it.toggleAttribute('data-active', isCurrent)
      // One preset out of the list is current: the row says so itself, so the
      // check mark is not the only thing carrying the choice.
      setAttributeIfChanged(it, 'aria-checked', String(isCurrent))
    }
  }

  /**
   * The first failed switch request, thrown on the next sync so the feature
   * retires the way a failed catalog read does (D12): a control that cannot
   * switch must hand the shipped access button back, and the refusal must
   * not pass silently.
   */
  let submitError: Error | null = null

  /**
   * Request the preset switch through the host's `/permission` command —
   * the same write the shipped picker's confirmation dialog ends in, minus
   * the dialog. The command validates the preset against the host's own
   * catalog, writes the sandbox mode and the approval policy, and appends
   * the preset event, so the next sync re-renders the control from the
   * projection alone.
   */
  function submitPreset(preset: string) {
    const session = currentSession(ctx)
    if (session === null) return
    const settled = session.command(`/permission ${preset}`)
    if (settled === undefined || settled === null) return
    settled.then((result) => {
      if (result === null || typeof result !== 'object' || result.ok !== true) {
        submitError = new Error(`permission: the /permission ${preset} command was refused`)
      } else if (result.value === null || typeof result.value !== 'object' || result.value.matched !== true) {
        submitError = new Error('permission: the host offers no /permission command')
      } else {
        submitError = null
      }
      ui.schedule!()
    }, () => {
      submitError = new Error(`permission: the /permission ${preset} command failed`)
      ui.schedule!()
    })
  }

  /**
   * Request the switch for every row, gated presets included: the host's
   * `/permission` command performs the switch itself, so no shipped menu
   * and no risk-confirmation dialog sit between the pick and the write.
   * A same-value pick writes nothing.
   */
  function pick(preset: string | null) {
    const session = currentSession(ctx)
    if (session === null || preset === null) return
    if (preset === currentPreset(session)) return
    submitPreset(preset)
  }

  const strayScan = createStrayScan()

  // Re-insert when a re-render swapped the host row, then mirror the running preset.
  function syncSegments() {
    const isHero = ui.composer!.isHero()
    const composerOn = ui.composer!.isActive()

    const { containers: existingPermContainers, segments: existingSegments, popover: strayPopover } = strayScan.existing(permContainer, segments)

    if (!composerOn) {
      for (const stray of existingPermContainers) stray.remove()
      if (permPopover && permPopover.parentElement) {
        permPopover.parentElement.removeChild(permPopover)
      }
      permContainer = null
      permBtn = null
      permLabel = null
      permPopover = null

      for (const stray of existingSegments) stray.remove()
      segments = null
      segmentPill.sync(null)
      coldStartShown = false
      strayScan.settle()
      return
    }

    const session = currentSession(ctx)
    const trigger = findAccessTrigger()
    // The cold start screen (no session yet) renders no access button: the
    // host leaves the card's mode strip empty and turns the whole card into
    // the workspace pick target. The skin's own control takes that strip and
    // shows the preset the new session will start in; it takes no input there,
    // so a press falls through to the card and opens the workspace picker like
    // every other control on it.
    const coldStart = trigger === null && isHero && session === null
    const host = coldStart
      ? document.querySelector(`${COMPOSER_CARD_SELECTOR}[data-dsh-claude-part~="card-workspace-trigger"] [data-dsh-claude-part~="modes"]`)
      : trigger === null ? null : trigger.parentElement
    // The default can change in Settings without a catalog event, so each
    // return to the cold start screen reads it again.
    if (coldStart && !coldStartShown && catalogOptions !== null) probeAutoPreset()
    coldStartShown = coldStart
    if (host === null) return
    strayScan.settle()

    const preset = coldStart ? defaultPreset : session === null ? null : currentPreset(session)
    // The segment group is the classic hero's own shape. The studio hero draws
    // its composer in the conversation's single-line form, where this control is
    // the conversation's trigger and card; the composer pass reads the home
    // layout's answer (packages/client/src/features/composer/composer.ts).
    const segmentsHere = isHero && !ui.composer!.isStudioHome()

    if (segmentsHere) {
      for (let i = 0; i < existingPermContainers.length; i++) {
        existingPermContainers[i].remove()
      }
      if (permPopover && permPopover.parentElement) {
        permPopover.parentElement.removeChild(permPopover)
      }
      permContainer = null
      permBtn = null
      permLabel = null
      permPopover = null

      // The slots follow the host's catalog: the deployment's own auto tier
      // takes the Auto slot when it is offered, and a slot with no offered
      // preset is not drawn. Rebuild when the binding changed; the shipped
      // group is reused otherwise, so a pass leaves the DOM alone.
      const segmentSpecs = resolvedSegments()
      const segmentSignature = segmentSpecs.map(spec => `${spec.label}=${spec.preset}`).join('|')
      if (existingSegments.length > 1) {
        for (let s = 1; s < existingSegments.length; s++) existingSegments[s].remove()
      }
      let group: HTMLElement
      if (segmentSignature === renderedSegments && existingSegments.length === 1 && host.contains(existingSegments[0])) {
        group = existingSegments[0]
      } else {
        renderedSegments = segmentSignature
        for (let s2 = 0; s2 < existingSegments.length; s2++) existingSegments[s2].remove()
        group = buildSegments(pick, segmentSpecs)
        host.insertBefore(group, host.firstChild)
      }
      segments = group
      for (let j = 0; j < group.children.length; j++) {
        // buildSegments fills the group with buttons alone.
        const item = group.children[j] as HTMLButtonElement
        if (item.disabled !== coldStart) item.disabled = coldStart
        const isCurrent = item.getAttribute('data-preset') === preset
        item.toggleAttribute('data-active', isCurrent)
        setAttributeIfChanged(item, 'aria-checked', String(isCurrent))
      }
      segmentPill.sync(group)
    } else {
      for (let es = 0; es < existingSegments.length; es++) {
        existingSegments[es].remove()
      }
      segments = null
      segmentPill.sync(null)

      if (existingPermContainers.length > 0) {
        const adopted = existingPermContainers[0]
        permContainer = adopted
        for (let p = 1; p < existingPermContainers.length; p++) {
          existingPermContainers[p].remove()
        }
        if (adopted.parentElement !== host) {
          host.insertBefore(adopted, host.firstChild)
        }
        permBtn = adopted.querySelector<HTMLButtonElement>('.dsh-claude-perm-btn')
        permLabel = adopted.querySelector<HTMLElement>('.dsh-claude-perm-label')
        // The container can be adopted from a generation whose disposals a
        // client reload dropped; its popover is still in the document, and
        // without it updatePermState would early-return forever.
        if (permPopover === null) permPopover = strayPopover
      } else {
        const res = buildPermTriggerAndPopover(pick)
        permContainer = res.container
        permBtn = res.btn
        permLabel = res.label
        permPopover = res.popover
        host.insertBefore(permContainer, host.firstChild)
      }
      updatePermState(preset, coldStart)
    }
  }

  ui.permissions = {
    /**
     * The pass's read phase: the segment control's own box, taken before this
     * frame's writes. A pass that builds the segments measures them in the
     * write phase instead (sliding-pill).
     */
    measure() {
      if (segments !== null && segments.isConnected) segmentPill.measure(segments)
    },
    sync() {
      if (autoPresetError !== null) throw autoPresetError
      if (submitError !== null) throw submitError
      syncSegments()
      // The tier card is fixed under its trigger and nothing else places it
      // again: a column that moved under an open card (the sidebar opening, the
      // window narrowing) would otherwise leave it hanging where the trigger
      // used to be.
      placeOpenPermCard()
    },
    /**
     * Esc and composer focus close the menu. There is deliberately no
     * 'outside' route — the menu runs its own document pointerdown
     * listener (see buildPermTriggerAndPopover).
     */
    close() {
      closePermMenu()
    },
    /** A viewport or composer-card change moves the anchor: place the open card in the same frame. */
    reposition() {
      placeOpenPermCard()
    },
  }

  // The composer restyle hides the host's access button only while this
  // says its replacement is installed.
  document.body.setAttribute(PERMISSIONS_ATTR, '')
  startAutoPresetProbe()

  return () => {
    unregisterPopover('permission')
    if (permHoverIntent) permHoverIntent.cancel()
    dropAutoPresetRead()
    if (catalogFiber !== null && typeof catalogFiber.dispose === 'function') {
      catalogFiber.dispose()
      catalogFiber = null
    }
    if (catalogChangedDisposer !== null) {
      catalogChangedDisposer()
      catalogChangedDisposer = null
    }
    if (permDocPointerListener) {
      document.removeEventListener('pointerdown', permDocPointerListener)
      permDocPointerListener = null
    }
    if (permResizeListener) {
      window.removeEventListener('resize', permResizeListener)
      window.removeEventListener('scroll', permResizeListener, true)
      permResizeListener = null
    }
    segmentPill.release()
    removeStrayNodes(document, `.${SEGMENTS_CLASS}[data-composer-segments], .dsh-claude-perm-container, .dsh-claude-perm-popover`, [])
    segments = null
    permPopover = null
    permBtn = null
    permLabel = null
    permContainer = null
    document.body.removeAttribute(PERMISSIONS_ATTR)
  }
}
