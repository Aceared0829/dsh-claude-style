import { COMPOSER_CARD_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { PERMISSIONS_ATTR } from '../../constants'
import { currentPreset, currentSession, findAccessTrigger } from '@dsh-claude-style/engine/host'
import { buildElement, closestFrom, setAttributeIfChanged } from '@dsh-claude-style/engine/dom'
import { SEGMENTS_CLASS, SEGMENT_CLASS } from '../../shared/segment-control'
import { removeStrayNodes } from '../../shared/popover'
import { createSlidingPill } from '../../shared/sliding-pill'
import type { HostContext } from '@dsh-claude-style/engine/host'
import type { FeatureUi } from '../../core/feature'
import type manifest from './permissions.manifest'
import { copy } from './copy'
import { createStrayScan } from './stray-nodes'
import { createPermissionCatalog } from './permission-catalog'
import { createPermissionCard } from './permission-tier-card'

/**
 * The permission control in the composer's access slot: the segment group the
 * classic hero draws and, everywhere else, the trigger with the tier card
 * (permission-tier-card.ts) — both fed by the host's permission catalog
 * (permission-catalog.ts). The pass keeps the control mounted where the host
 * puts its own access button and mirrors the running preset onto it; a pick
 * goes through the host's `/permission` command, so no shipped menu and no
 * risk-confirmation dialog sit between the pick and the write.
 */
export function install(ctx: HostContext, ui: FeatureUi<typeof manifest>) {
  let segments: HTMLElement | null = null
  /** The segment group's sliding highlight (packages/client/src/shared/sliding-pill.ts). */
  const segmentPill = createSlidingPill('[data-active]')
  /** Whether the last pass drew the segments on the cold start screen. */
  let coldStartShown = false
  /** The segment signature the pass last rendered, so a change rebuilds the group. */
  let renderedSegments = ''

  const catalog = createPermissionCatalog(ctx, () => ui.schedule!())
  const card = createPermissionCard(catalog)

  /**
   * Build the segment group from the resolved slots. `specs` is what the
   * catalog's resolvedSegments() returned, so a slot the host cannot serve is
   * simply absent instead of drawn dead.
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
   * Request the switch for every row, gated presets included. A same-value
   * pick writes nothing.
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
    // The composer feature leaves the page while its scope preference is off.
    const isHero = ui.composer?.isHero() ?? false
    const composerOn = ui.composer?.isActive() ?? false

    const { containers: existingPermContainers, segments: existingSegments, popover: strayPopover } = strayScan.existing(card.container(), segments)

    if (!composerOn) {
      for (const stray of existingPermContainers) stray.remove()
      card.clear()
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
    if (coldStart && !coldStartShown && catalog.hasCatalog()) catalog.probe()
    coldStartShown = coldStart
    if (host === null) return
    strayScan.settle()

    const preset = coldStart ? catalog.coldStartPreset() : session === null ? null : currentPreset(session)
    // The segment group is the classic hero's own shape. The studio hero draws
    // its composer in the conversation's single-line form, where this control is
    // the conversation's trigger and card; the composer pass reads the home
    // layout's answer (packages/client/src/features/composer/composer.ts).
    const segmentsHere = isHero && !(ui.composer?.isStudioHome() ?? false)

    if (segmentsHere) {
      for (let i = 0; i < existingPermContainers.length; i++) {
        existingPermContainers[i].remove()
      }
      card.clear()

      // The slots follow the host's catalog: the deployment's own auto tier
      // takes the Auto slot when it is offered, and a slot with no offered
      // preset is not drawn. Rebuild when the binding changed; the shipped
      // group is reused otherwise, so a pass leaves the DOM alone.
      const segmentSpecs = catalog.resolvedSegments()
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
        for (let p = 1; p < existingPermContainers.length; p++) {
          existingPermContainers[p].remove()
        }
        if (adopted.parentElement !== host) {
          host.insertBefore(adopted, host.firstChild)
        }
        card.adopt(
          adopted,
          adopted.querySelector<HTMLButtonElement>('.dsh-claude-perm-btn'),
          adopted.querySelector<HTMLElement>('.dsh-claude-perm-label'),
          strayPopover,
        )
      } else {
        const res = card.build(pick)
        host.insertBefore(res.container, host.firstChild)
      }
      card.update(preset, coldStart)
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
      if (catalog.error() !== null) throw catalog.error()
      if (submitError !== null) throw submitError
      syncSegments()
      // The tier card is fixed under its trigger and nothing else places it
      // again: a column that moved under an open card (the sidebar opening, the
      // window narrowing) would otherwise leave it hanging where the trigger
      // used to be.
      card.placeOpen()
    },
    /**
     * Esc and composer focus close the menu. There is deliberately no
     * 'outside' route — the menu runs its own document pointerdown
     * listener (permission-tier-card.ts).
     */
    close() {
      card.close()
    },
    /** A viewport or composer-card change moves the anchor: place the open card in the same frame. */
    reposition() {
      card.placeOpen()
    },
  }

  // The composer restyle hides the host's access button only while this
  // says its replacement is installed.
  document.body.setAttribute(PERMISSIONS_ATTR, '')
  catalog.start()

  return () => {
    card.dispose()
    catalog.dispose()
    segmentPill.release()
    // One sweep for every node the feature draws: the segment groups and the
    // tier card's trigger container and popover (permission-tier-card.ts).
    removeStrayNodes(document, `.${SEGMENTS_CLASS}[data-composer-segments], .dsh-claude-perm-container, .dsh-claude-perm-popover`, [])
    segments = null
    document.body.removeAttribute(PERMISSIONS_ATTR)
  }
}
