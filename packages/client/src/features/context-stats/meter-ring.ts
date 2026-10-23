import { SLOT_NODE_ATTR, STATS_POSITION_CONTEXT } from '../../constants'
import { DIALOG_TRIGGER_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { observeMatches, subscribeMutations } from '@dsh-claude-style/engine/bus'
import { findModelSlot } from '@dsh-claude-style/engine/host'
import { readPrefs } from '../../core/prefs'
import { removeStrayNodes } from '../../shared/popover'
import { setAttributeIfChanged } from '@dsh-claude-style/engine/dom'
import { CONTEXT_STOPS, rampPosition, writeRamp } from './stats-ramp'
import { contextTrigger, findContextMeter, markContextMeter, meterOccupancy } from './stats-panel'
import { paintContextPie, readPieColours } from './context-meter-pie'
import type { HostContext } from '@dsh-claude-style/engine/host'
import type { FeatureHandle } from '@dsh-claude-style/engine/scheduler'
import type { FeatureUi } from '../../core/feature'
import type { PieColours } from './context-meter-pie'
import type manifest from './meter-ring.manifest'

/**
 * The context meter's own ring in the composer row.
 *
 * The host's meter cannot leave the dock the host renders it in — moving it out
 * crashed React's unmount — so the skin draws the ring itself, and the host's
 * node stays where it is and leaves the row unpainted: it keeps only the job of
 * opening its own context panel, which stats-binding.ts presses its trigger
 * for. The ring is the skin's own node, appended after the seat box in the
 * host's model slot (features/model/seat-box.ts is the same arrangement), so
 * the row lays it out and shortens the model's name before it.
 *
 * The reading is the host's projection of the session's context pressure. A
 * host that serves none is read off its own ring's text, which is still in the
 * document behind the paint. The ring's look is the meter's: the occupancy as a
 * ring, or as a pie in the colour band the reading fell on, and the number
 * beside it (context-meter-pie.ts, stats-ramp.ts).
 */

/** The mark on the ring's root, which the ring's own rules and the specs read. */
export const METER_RING_ATTR = 'data-dsh-claude-meter-ring'
/**
 * The mark on the host's meter while the skin's ring stands in its place: the
 * stylesheet drops the host's node out of the row without moving it.
 */
export const METER_HIDDEN_ATTR = 'data-dsh-claude-meter-hidden'

/** The ring the row draws: the 14px viewBox and 2px stroke the host's own ring uses. */
const RING_SIZE = 14
const RING_RADIUS = 5.5
/** The arc's whole length, and the two-decimal form its dash array is written in. */
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const ROUNDING = 100

/** What the context statistics read off the ring (ui.meterRing). */
export interface MeterRingHandle extends FeatureHandle {
  /** The ring's root while it stands in the row, else null. */
  root(): HTMLElement | null
  /** Say what the ring reads: the occupancy as a percentage, or null while none can be taken. */
  setReading(percent: number | null): void
}

/**
 * @param ctx - the plugin context (unused; the ring reads the page through the engine).
 * @param ui - the shared registry. `ui.model` answers the seat box the ring stands after.
 * @returns the teardown.
 */
export function install(ctx: HostContext, ui: FeatureUi<typeof manifest>) {
  let ring: HTMLElement | null = null
  let ringButton: HTMLButtonElement | null = null
  let ringValue: HTMLElement | null = null
  let ringFill: SVGCircleElement | null = null
  /** The host's meter the hidden mark stands on right now, or null. */
  let hiddenMeter: HTMLElement | null = null
  /** The watch on that meter's open state, or null while no meter is hidden. */
  let stopExpandedWatch: (() => void) | null = null
  /** The occupancy the context statistics answered, or null while their projection says nothing. */
  let answered: number | null = null
  /** The percentage the ring was last drawn for, so an unmoved reading writes nothing. */
  let shown: number | null = null
  /** The pie's colours, read in a pass's own read phase (D40). */
  let colours: PieColours | null = null

  /**
   * The number the ring shows: the projection the context statistics followed,
   * else the reading the host's own ring still carries behind the paint.
   */
  function reading() {
    if (answered !== null) return answered
    const meter = findContextMeter()
    return meter === null ? null : meterOccupancy(meter)
  }

  /** Build the ring once: the button, its ring and the number beside it, in the host's own anatomy. */
  function ensureRing(slot: HTMLElement, seat: HTMLElement) {
    if (ring === null) {
      const root = document.createElement('span')
      root.setAttribute(METER_RING_ATTR, '')
      root.setAttribute(SLOT_NODE_ATTR, '')
      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute('aria-haspopup', 'dialog')
      button.setAttribute('aria-expanded', 'false')
      button.innerHTML = `<svg viewBox="0 0 ${RING_SIZE} ${RING_SIZE}" width="${RING_SIZE}" height="${RING_SIZE}" aria-hidden="true"><circle class="dsh-claude-meter-ring-track" cx="${RING_SIZE / 2}" cy="${RING_SIZE / 2}" r="${RING_RADIUS}"></circle><circle class="dsh-claude-meter-ring-fill" cx="${RING_SIZE / 2}" cy="${RING_SIZE / 2}" r="${RING_RADIUS}" transform="rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})"></circle></svg><span class="dsh-claude-meter-ring-value"></span>`
      root.appendChild(button)
      ring = root
      ringButton = button
      ringValue = button.querySelector('span')
      ringFill = button.querySelector('circle.dsh-claude-meter-ring-fill')
      shown = null
    }
    // After the seat box, which the model picker keeps first in the slot.
    if (ring.parentElement !== slot || ring.previousElementSibling !== seat) slot.insertBefore(ring, seat.nextSibling)
  }

  /** The ring's own words and arc for the percentage it shows. */
  function drawReading(percent: number | null) {
    if (ringFill === null || ringValue === null) return
    if (percent === shown) return
    shown = percent
    const text = percent === null ? '' : `${percent}%`
    if (ringValue.textContent !== text) ringValue.textContent = text
    // The arc the host draws for the same reading: the dash covers the share
    // taken and the gap the rest of the ring.
    const whole = Math.round(RING_CIRCUMFERENCE * ROUNDING) / ROUNDING
    const taken = percent === null ? 0 : Math.round(RING_CIRCUMFERENCE * percent) / ROUNDING
    ringFill.setAttribute('stroke-dasharray', `${taken} ${whole}`)
    ringFill.toggleAttribute('data-empty', percent === null || percent <= 0)
  }

  /** Read the colours the ring's own words take: their band, mixed by the browser (stats-ramp.ts). */
  function readColours() {
    colours = ring === null ? null : readPieColours(ring)
    return colours
  }

  /**
   * Paint the reading: the number and the plate in the band the occupancy fell
   * on, and the host's trigger's own words for a screen reader, so the control
   * the reader finds is named the same as the one it stands for.
   */
  function paintRing() {
    if (ring === null) return
    const percent = reading()
    const moved = writeRamp(ring, 'context', percent === null ? null : rampPosition(percent, CONTEXT_STOPS))
    const trigger = contextTrigger()
    if (ringButton !== null) {
      const label = trigger === null ? null : trigger.getAttribute('aria-label')
      if (label !== null) setAttributeIfChanged(ringButton, 'aria-label', label)
    }
    mirrorExpanded()
    drawReading(percent)
    // A band that moved carries a new colour: the plate's image is drawn from
    // the colours read for it, and only a moved band needs a new reading.
    paintContextPie(ring, percent, moved || colours === null ? readColours() : colours)
  }

  /** Say on the ring whether the host's panel is open, as the host's trigger says it. */
  function mirrorExpanded() {
    if (ringButton === null) return
    const trigger = contextTrigger()
    setAttributeIfChanged(ringButton, 'aria-expanded', trigger !== null && trigger.getAttribute('aria-expanded') === 'true' ? 'true' : 'false')
  }

  /**
   * Follow the hidden meter's open state as the host writes it. The host shows
   * its panel in the batch its trigger flips in, and the skin places it in that
   * same batch (stats-binding.ts), so a ring that waited for the next pass
   * would say "closed" over a panel the reader already sees.
   */
  function watchExpanded(meter: HTMLElement | null) {
    if (stopExpandedWatch !== null) stopExpandedWatch()
    stopExpandedWatch = meter === null ? null : subscribeMutations(meter, { subtree: true, attributeFilter: ['aria-expanded'] }, mirrorExpanded)
  }

  /** Take the ring down and hand the host's meter back. */
  function dropRing() {
    if (ring !== null && ring.parentElement !== null) ring.parentElement.removeChild(ring)
    ring = null
    ringButton = null
    ringValue = null
    ringFill = null
    shown = null
    colours = null
    answered = null
    if (hiddenMeter !== null) hiddenMeter.removeAttribute(METER_HIDDEN_ATTR)
    hiddenMeter = null
    watchExpanded(null)
  }

  /**
   * Where the ring belongs: the row's own position, a seat box to stand behind,
   * and a card the host has not drawn as the hero — the home page's composer
   * keeps the host's line, as do the numbers asked onto a line of their own.
   */
  function placeOf() {
    if (readPrefs().statsPosition !== STATS_POSITION_CONTEXT) return null
    const seat = typeof ui.model?.seatBox === 'function' ? ui.model.seatBox() : null
    if (seat === null) return null
    const slot = findModelSlot()
    const card = slot === null ? null : slot.closest<HTMLElement>('[data-composer-card]')
    if (slot === null || card === null || card.getAttribute('data-composer-variant') === 'hero') return null
    return { slot, seat }
  }

  function syncRing() {
    const place = placeOf()
    if (place === null) {
      if (ring !== null) dropRing()
      return
    }
    ensureRing(place.slot, place.seat)
    hideHostMeter()
    paintRing()
  }

  /**
   * The host's meter keeps the host's place and stops painting: its trigger is
   * the panel's, the reading is the ring's. It is marked the way the context
   * statistics mark it, since the hiding rule reads both marks.
   */
  function hideHostMeter() {
    const meter = findContextMeter()
    if (hiddenMeter !== meter) {
      if (hiddenMeter !== null) hiddenMeter.removeAttribute(METER_HIDDEN_ATTR)
      watchExpanded(meter)
    }
    hiddenMeter = meter
    if (meter === null) return
    markContextMeter(meter)
    meter.setAttribute(METER_HIDDEN_ATTR, '')
  }

  // The host renders its meter anew at moments of its own (a turn ending), and
  // the new node would paint in the dock for the frame before the next pass,
  // pushing the card up by its height: it is hidden in the batch that brought it.
  const triggers = observeMatches<HTMLElement>(DIALOG_TRIGGER_SELECTOR, () => {
    if (ring !== null) hideHostMeter()
  })

  function teardown() {
    triggers.release()
    dropRing()
  }

  // A generation whose teardown a client reload dropped leaves its ring in the
  // slot: this one sweeps it out before drawing its own.
  removeStrayNodes(document, `[${METER_RING_ATTR}]`, [])
  ui.meterRing = {
    sync: syncRing,
    // The ring's colours come off the page's own styles, which a pass reads in
    // its read phase alone (D40).
    measure: readColours,
    /** The ring the context panel is placed against, as the pass that drew it left it. */
    root() {
      return ring !== null && ring.isConnected ? ring : null
    },
    /**
     * The occupancy the session's own projection answered. The ring is drawn
     * from it in the same pass, and a projection frame arriving between passes
     * repaints the number at once rather than waiting for the next one.
     */
    setReading(percent: number | null) {
      if (percent === answered) return
      answered = percent
      paintRing()
    },
    teardown,
  }

  return teardown
}
