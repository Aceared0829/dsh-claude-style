import { AUTO_POPOVER_ALL } from '../../constants'
import { observeSize } from '../../core/bus'
import { copyLabel } from '../../core/i18n'
import { readPrefs } from '../../core/prefs'
import { setAttributeIfChanged } from '../../shared/dom'
import { POPOVER_CLOSE_DELAY, POPOVER_OPEN_DELAY, createHoverIntent, isProgrammaticPress, pressKeepsPopoverOpen, programmaticPress } from '../../shared/popover'
import { CONTEXT_PANEL_ALIGNED_ATTR, CONTEXT_PANEL_ATTR, contextPanel, contextTrigger, findContextMeter } from './stats-panel'

/**
 * The hover path onto the host's own panel: opening and
 * closing it through the host's trigger, keeping a node's bindings to one
 * generation, and the reading that lines the panel's right edge up with the
 * meter's.
 */

/** The custom property the stylesheet reads to line the panel up with the meter. */
const CONTEXT_PANEL_LEFT = '--dsh-claude-context-panel-left'
/** The viewport margin the host keeps for this panel (ui-chat's stat-dialog). */
const CONTEXT_PANEL_MARGIN = 12

/**
 * The panel's bindings.
 *
 * @returns { bindMeter, bindPanel, align, close, cancelHover, releaseSize, release }.
 */
export function createContextStatsBinding() {
  /** Identity of the bindings THIS generation installed (a hot reload reuses the host's nodes). */
  const statsBindingToken = {}
  /** The open panel's size watcher, or null before a panel has been seen. */
  let stopPanelSize: (() => void) | null = null
  /**
   * Every listener this generation put on a node the host owns, with the call
   * that takes it off. The meter, the line and the panel outlive the
   * generation, so the teardown has to remove what it bound: the token above
   * only keeps one generation from binding the same element twice.
   */
  const boundListeners: { remove: () => void }[] = []

  /**
   * Open the context panel by pressing the host's trigger: the panel, its
   * placement, its dismissal and its keyboard handling all stay the
   * host's. Only the trigger is driven, and only when it is closed.
   */
  function openContextPanel() {
    const trigger = contextTrigger()
    if (trigger === null || trigger.getAttribute('aria-expanded') === 'true') return
    trigger.click()
  }

  /**
   * Close it again, the same way. The panel's own mouseenter cancels this
   * first (hover intent); the `:hover` test is the second net for the
   * frame in which the pointer is already inside a panel the leave event
   * still saw as left.
   */
  function closeContextPanel() {
    const trigger = contextTrigger()
    if (trigger === null || trigger.getAttribute('aria-expanded') !== 'true') return
    const panel = contextPanel()
    if (panel !== null && panel.matches(':hover')) return
    programmaticPress(trigger)
  }

  const hoverIntent = createHoverIntent(openContextPanel, () => {
    // Layout can return the pointer to the meter before the close grace expires.
    // Explicit line and keyboard dismissal still use closeContextPanel directly.
    if (findContextMeter()?.matches(':hover')) return
    closeContextPanel()
  }, POPOVER_OPEN_DELAY, POPOVER_CLOSE_DELAY)

  /** The hover preference gates both directions, as it does for the skin's other popovers. */
  function hoverEnabled() {
    return readPrefs().autoPopover === AUTO_POPOVER_ALL
  }

  function bindContextMeter(meter: Element) {
    if (meter.__dshContextMeterToken === statsBindingToken) return
    meter.__dshContextMeterToken = statsBindingToken
    const onEnter = () => {
      if (hoverEnabled()) hoverIntent.scheduleOpen()
    }
    const onLeave = () => {
      if (hoverEnabled()) hoverIntent.scheduleClose()
    }
    // The host's own trigger toggles the panel on a press, and its onClick is
    // delegated from the document, so a press on the ring the dwell just
    // opened is stopped on its way there: the pointer is on the trigger it
    // opened from, and the leave is the way out
    // (shared/popover.ts::pressKeepsPopoverOpen). The line of figures keeps
    // its own press behaviour: it is not a hover trigger
    const onClick = (event: Event) => {
      if (isProgrammaticPress()) return
      const trigger = contextTrigger()
      const target = event.target
      if (trigger === null || !(target instanceof Node) || !trigger.contains(target)) return
      if (!pressKeepsPopoverOpen(hoverEnabled(), trigger.getAttribute('aria-expanded') === 'true')) return
      event.stopPropagation()
    }
    meter.addEventListener('mouseenter', onEnter)
    meter.addEventListener('mouseleave', onLeave)
    meter.addEventListener('click', onClick, true)
    boundListeners.push({
      remove() {
        meter.removeEventListener('mouseenter', onEnter)
        meter.removeEventListener('mouseleave', onLeave)
        meter.removeEventListener('click', onClick, true)
      },
    })
  }

  /**
   * Bind the line of numbers as the panel's second trigger: the figures are what
   * the panel's rows expand on, so the line opens it and closes it again. Only
   * the press does that — the pointer path stays the meter's alone, so resting a
   * pointer on the figures never unfolds the panel A rebuilt line is bound
   * once per generation, like the meter.
   */
  function bindContextLine(line: Element) {
    if (line.__dshContextLineToken === statsBindingToken) return
    line.__dshContextLineToken = statsBindingToken
    line.setAttribute('role', 'button')
    line.setAttribute('tabindex', '0')
    line.setAttribute('aria-haspopup', 'dialog')
    line.setAttribute('aria-expanded', 'false')
    const onClick = (event: Event) => {
      // The host reads presses outside its panel as a dismissal; the press that
      // opens it must not reach that reader in the same event.
      event.stopPropagation()
      toggleContextPanel()
    }
    const onKeyDown = (event: Event) => {
      if (!(event instanceof KeyboardEvent)) return
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeContextPanel()
        return
      }
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      event.stopPropagation()
      toggleContextPanel()
    }
    line.addEventListener('click', onClick)
    line.addEventListener('keydown', onKeyDown)
    boundListeners.push({
      remove() {
        line.removeEventListener('click', onClick)
        line.removeEventListener('keydown', onKeyDown)
      },
    })
  }

  /** Open the panel from either trigger, or close it when it is already open. */
  function toggleContextPanel() {
    const trigger = contextTrigger()
    if (trigger !== null && trigger.getAttribute('aria-expanded') === 'true') closeContextPanel()
    else openContextPanel()
  }

  /**
   * Say on the line what the host's trigger says, so the button follows the panel
   * it drives.
   *
   * The line is a button made of figures and arrows, so it carries the name the
   * reader needs to know what it opens; the name is written with the state, so a
   * locale or copy change reaches it too.
   */
  function syncContextLineState(line: Element) {
    const trigger = contextTrigger()
    const expanded = trigger !== null && trigger.getAttribute('aria-expanded') === 'true' ? 'true' : 'false'
    if (line.getAttribute('aria-expanded') !== expanded) line.setAttribute('aria-expanded', expanded)
    setAttributeIfChanged(line, 'aria-label', copyLabel('statsLineLabel', 'Conversation statistics'))
  }

  /**
   * Line the panel's right edge up with the meter's.
   *
   * The panel is the host's and its coordinates are inline: ui-chat places
   * it from the anchor's LEFT edge and only then clamps it into the
   * viewport, which for a trigger at the composer's right end parks the
   * panel against the window's right margin, past the ring. The skin reads
   * the two boxes and hands the stylesheet one left value
   * (features/composer/inline-bar.css), the hand-over the hero menu makes
   * for the menu the host places below its own trigger. The property and
   * the mark are written together, so the rule never runs on a reading
   * that has gone.
   */
  function alignContextPanel(panel: HTMLElement) {
    const meter = findContextMeter()
    if (meter === null) return
    const anchor = meter.getBoundingClientRect()
    // The panel's own entrance scales it (the cards' 0.98), and a TRANSFORMED
    // rect is two percent narrower than the box that settles: read the
    // layout width, which is the one the panel ends up with.
    const width = panel.offsetWidth
    if (width === 0) return
    const widest = window.innerWidth - width - CONTEXT_PANEL_MARGIN
    const left = Math.round(Math.min(Math.max(anchor.right - width, CONTEXT_PANEL_MARGIN), widest))
    panel.style.setProperty(CONTEXT_PANEL_LEFT, `${left}px`)
    panel.setAttribute(CONTEXT_PANEL_ALIGNED_ATTR, '')
  }

  function bindContextPanel(panel: HTMLElement) {
    if (!panel.hasAttribute(CONTEXT_PANEL_ATTR)) panel.setAttribute(CONTEXT_PANEL_ATTR, '')
    if (panel.__dshContextPanelToken === statsBindingToken) return
    panel.__dshContextPanelToken = statsBindingToken
    const onEnter = () => {
      hoverIntent.cancel()
    }
    const onLeave = () => {
      if (hoverEnabled()) hoverIntent.scheduleClose()
    }
    panel.addEventListener('mouseenter', onEnter)
    panel.addEventListener('mouseleave', onLeave)
    boundListeners.push({
      remove() {
        panel.removeEventListener('mouseenter', onEnter)
        panel.removeEventListener('mouseleave', onLeave)
      },
    })
    // The panel's own box is what the reading is taken from, so the reading
    // is re-taken whenever that box changes: the host's rows growing, or
    // the block below them arriving.
    if (stopPanelSize !== null) stopPanelSize()
    stopPanelSize = observeSize(panel, () => {
      const open = contextPanel()
      if (open !== null) alignContextPanel(open)
    })
    alignContextPanel(panel)
  }

  /**
   * Composer focus closes the panel the host's trigger opened, without the
   * `:hover` net the hover path keeps (the pointer is not what asked).
   */
  function closeContextStatsPanel() {
    hoverIntent.cancel()
    const trigger = contextTrigger()
    if (trigger === null || trigger.getAttribute('aria-expanded') !== 'true') return
    trigger.click()
  }

  /** Stop watching the open panel's size. */
  function releasePanelSize() {
    if (stopPanelSize !== null) {
      stopPanelSize()
      stopPanelSize = null
    }
  }

  return {
    /** Bind the meter once per generation. */
    bindMeter: bindContextMeter,
    /** Bind the panel once per generation, and take the alignment reading. */
    bindPanel: bindContextPanel,
    /** Bind the line of numbers as the panel's second trigger, once per generation. */
    bindLine: bindContextLine,
    /** Write the host panel's open state onto the line. */
    syncLine: syncContextLineState,
    /** Re-take the alignment reading (the viewport moved). */
    align: alignContextPanel,
    /** Close the panel the host's trigger opened. */
    close: closeContextStatsPanel,
    /** Drop the pending hover timers. */
    cancelHover() {
      hoverIntent.cancel()
    },
    /** Stop watching the panel's size. */
    releaseSize: releasePanelSize,
    /**
     * The generation's whole binding goes: the hover timers, the size watcher
     * and every listener put on the host's own meter, line and panel. Those
     * nodes outlive the generation, so what is not taken off here would answer
     * a later generation's pointer with this one's closure.
     */
    release() {
      hoverIntent.cancel()
      releasePanelSize()
      for (let i = 0; i < boundListeners.length; i++) boundListeners[i].remove()
      boundListeners.length = 0
    },
  }
}
