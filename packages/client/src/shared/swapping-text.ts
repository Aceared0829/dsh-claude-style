import { motionReduced } from '../core/prefs'
import { motionMs, motionValue } from './motion'
import { inPagePixels } from './page-zoom'
import { buildSweepBand } from './sweep-band'

/**
 * One line of words that swaps in place, after transitions.dev's "Text states
 * swap" (MIT), by way of its "Thinking states" composition: the wording leaving
 * rises out through a small blur, the wording arriving comes up from below while
 * the one leaving is still on its way out — the arriving copy stands parked and
 * is released one gap after the leaving one started — and the box neither
 * resizes nor jumps mid-swap.
 *
 * The box's width belongs to a hidden sizer, which is the recipe's own answer to
 * the problem the swap would otherwise cause: the copies are absolutely
 * positioned, so a box that held only what is moving would read as empty for the
 * length of a swap and throw everything laid out beside it to the left edge and
 * back. The sizer holds the widest of the words a swap puts in the box while it
 * runs, and comes down onto the words standing the moment it settles — so two
 * states of different lengths never leave the clock beside the line stranded
 * after words that are no longer that long. Each of those two widths is a move
 * rather than a jump: the box is pinned at the width it stands at, written with
 * the one it heads for, and the stylesheet's transition carries it there
 * (shared/swapping-text.css), so the clock beside the line travels with it
 * instead of being displaced twice per wording. The wording is written into the
 * sizer as well, so the live region hears one line and never two.
 *
 * The names, the blurs and the distance are the recipe's, carried as this
 * skin's own properties; shared/swapping-text.css reads them. The reader's
 * animation choice (D40) decides at call time whether any of it runs, instead
 * of the recipe's own media query — core/prefs.ts has already resolved the
 * setting and the system preference into one answer.
 */

/** The class on the hidden sizer the box takes its width from. */
const SIZER_CLASS = 'dsh-claude-swap-sizer'
/** The class on one copy of the words (shared/swapping-text.css). */
const COPY_CLASS = 'dsh-claude-swap-copy'

/**
 * The swap in flight, whether this element has ever been written, and the width
 * its box is on its way to. The written mark matters: a line that already
 * carries its words when it is first handed over must not swap them for the
 * identical words. The travel matters for the same reason the other two do: a
 * write heading for the width already being travelled to leaves that move
 * running.
 */
const swapped = new WeakMap<HTMLElement, {
  timer: number | null
  written: boolean
  travel: { target: number, timer: number } | null
}>()

function stateOf(element: HTMLElement) {
  let state = swapped.get(element)
  if (state === undefined) {
    state = { timer: null, written: false, travel: null }
    swapped.set(element, state)
  }
  return state
}

/** The distance a swap travels, as written in the token, or the shared travel. */
function distanceOf(element: HTMLElement) {
  const value = getComputedStyle(element).getPropertyValue('--dsh-claude-swap-distance').trim()
  const parsed = /^(-?[\d.]+)\s*(px|rem)?$/.exec(value)
  if (parsed === null) return motionValue('--dsh-claude-distance-travel')
  const amount = Number(parsed[1])
  if (!Number.isFinite(amount)) return motionValue('--dsh-claude-distance-travel')
  return parsed[2] === 'rem' ? `${amount}rem` : `${amount}px`
}

/**
 * The words the box is carrying right now: every copy standing in it, and the
 * one the line is heading for. A swap may overlap the one before it, and the
 * box has to stay as wide as the widest of them all.
 */
function wordsIn(element: HTMLElement) {
  const texts: string[] = []
  for (const copy of element.querySelectorAll(`.${COPY_CLASS}`)) texts.push(copy.textContent ?? '')
  texts.push(element.dataset.text ?? '')
  return texts
}

/**
 * The copy the words are arriving on, while a swap runs: the one that is not on
 * its way out. A newer wording is rewritten onto it before the swap settles, so
 * it is found by what the box holds rather than by a reference kept beside it.
 */
function enteringOf(element: HTMLElement): HTMLElement | null {
  for (const copy of element.querySelectorAll<HTMLElement>(`.${COPY_CLASS}`)) {
    if (!copy.classList.contains('is-exit')) return copy
  }
  return null
}

/**
 * Write the words onto one copy. A copy carrying the highlight takes a band of
 * its own (shared/sweep-band.ts) beside its words, built fresh with them, so a
 * copy rewritten mid-swap starts its band over with its new words; the band
 * draws its copy from `data-text`, which keeps the copy's own text the words
 * alone for every measure that reads it (wordsIn). The class carrying the band
 * is written on the copy showing the words and never on the label: the label's
 * box stands taller than the text by the swap's travel (shared/swapping-text.css),
 * and a band laid over that box would sweep that far above the glyphs.
 */
function fillCopy(copy: HTMLElement, text: string, withShimmer: boolean) {
  copy.replaceChildren(text)
  copy.setAttribute('data-text', text)
  if (withShimmer) copy.appendChild(buildSweepBand(text).band)
}

/**
 * The sizer: the box's only child in the flow, the one thing that gives it a
 * width while the copies lie out of it. It is made on the first write, which is
 * why a label already carrying words loses them there.
 */
function sizerOf(element: HTMLElement): HTMLElement {
  const first = element.firstElementChild
  if (first !== null && first.classList.contains(SIZER_CLASS)) return first as HTMLElement
  const sizer = document.createElement('span')
  sizer.className = SIZER_CLASS
  sizer.setAttribute('aria-hidden', 'true')
  element.textContent = ''
  element.appendChild(sizer)
  return sizer
}

/**
 * The width an element's own layout takes, in the pixels a written width is
 * read in (shared/page-zoom.ts). `offsetWidth` rounds to whole pixels and the
 * computed `width` to a sixty-fourth, and a pin written with either steps the
 * box — and the clock laid out beside it — as the pin goes on and comes off
 * again, so the width is read as the layout really takes it.
 */
function layoutWidth(element: HTMLElement) {
  return inPagePixels(element.getBoundingClientRect().width)
}

/**
 * Write one text into the sizer and answer the width it takes. The width has to
 * be committed here, in the task the words arrived in: a sizer left unmeasured
 * until the next frame lets the box grow a beat into the swap, and everything
 * laid out beside it moves with that beat.
 */
function hold(sizer: HTMLElement, text: string) {
  if (sizer.textContent !== text) {
    sizer.textContent = text
    void sizer.offsetWidth
  }
  return layoutWidth(sizer)
}

/**
 * Hold the box at the widest of the words a swap puts in it. The clock beside
 * the line is laid out against this box, so its width may not change while the
 * two halves move; the words left standing take it over once they settle
 * (setSwappingText), which is what keeps the clock right after them at rest.
 * Both widths are travelled to (travelWidth): the width the box stands at is
 * read here, before the sizer takes the words it is heading for.
 */
function holdWidest(element: HTMLElement, texts: readonly string[]) {
  const from = layoutWidth(element)
  const sizer = sizerOf(element)
  let held = ''
  let heldWidth = -1
  for (const text of texts) {
    const width = hold(sizer, text)
    if (width > heldWidth) {
      held = text
      heldWidth = width
    }
  }
  hold(sizer, held)
  travelWidth(element, from, heldWidth)
}

/**
 * Let the box be the sizer's own width again, and drop the timer that would have
 * done it: the pin and the timer are one thing and neither outlives the other.
 */
function stopTravel(element: HTMLElement) {
  const state = stateOf(element)
  if (state.travel === null) return
  window.clearTimeout(state.travel.timer)
  state.travel = null
  element.style.width = ''
}

/**
 * Take the box from the width it stands at to the width it heads for in one
 * move. The clock beside the line is laid out against this box, so a width
 * written in one step moves the clock in one step; the box is pinned at the
 * width it stands at, written with the one it heads for, and the stylesheet's
 * transition carries it (shared/swapping-text.css). Two `auto` widths cannot be
 * interpolated, which is why the pin exists; it is let go on the travel's own
 * clock, onto the width the sizer already holds, so a box at rest is the sizer's
 * own width again. A write heading for the width already being travelled to
 * leaves that move running, since a swap settles inside the travel it began.
 */
function travelWidth(element: HTMLElement, from: number, to: number) {
  const state = stateOf(element)
  if (state.travel !== null && state.travel.target === to) return
  stopTravel(element)
  if (from === to || motionReduced()) return
  element.style.width = `${from}px`
  // The pinned width has to be committed here, in the task the words arrived in:
  // a box the browser reads only on the next frame travels from the width it has
  // already reached, which is no move at all.
  void element.offsetWidth
  element.style.width = `${to}px`
  state.travel = {
    target: to,
    timer: window.setTimeout(() => stopTravel(element), motionMs('--dsh-claude-duration-slide')),
  }
}

/**
 * Write the words onto a label, swapping them in when they differ from the ones
 * standing. The first write (and every write while the animation choice is
 * reduced) lands without motion, so a label never animates on the way in.
 *
 * @param element - the label; it takes a hidden sizer and, while a swap runs,
 *     the copies the two halves move.
 * @param text - the words to stand.
 * @param withShimmer - carry the masked highlight the recipe pairs with a
 *     state line.
 */
export function setSwappingText(element: HTMLElement, text: string, withShimmer = false) {
  const state = stateOf(element)
  const was = element.dataset.text
  if (state.written && was === text) return
  const first = !state.written
  // The copies read their geometry off the box they sit in: the class that
  // carries it belongs to the label, and the distance is written here so the
  // stylesheet owns the value (shared/swapping-text.css).
  if (!element.classList.contains('dsh-claude-swap-label')) element.classList.add('dsh-claude-swap-label')
  element.style.setProperty('--dsh-claude-swap-distance', distanceOf(element))
  state.written = true

  if (first || motionReduced()) {
    if (state.timer !== null) {
      window.clearTimeout(state.timer)
      state.timer = null
    }
    // A width already travelling lands here too: the words written without a
    // swap take the box at once.
    stopTravel(element)
    // The sizer comes first, so the copy written below stands after it: it is
    // the box's only child in the flow, and everything past it is a copy.
    const sizer = sizerOf(element)
    const standing = document.createElement('span')
    standing.className = COPY_CLASS + (withShimmer ? ' dsh-claude-swap-shimmer' : '')
    fillCopy(standing, text, withShimmer)
    // The sizer is the only thing in the flow, so the words standing are
    // replaced outright; nothing moves and nothing measures them.
    while (element.childNodes.length > 1) element.removeChild(element.lastChild!)
    element.appendChild(standing)
    element.dataset.text = text
    // The box comes down onto the words standing — the copies the last swap
    // left behind are gone — so the clock sits right after them again.
    hold(sizer, text)
    return
  }

  // The box takes the widest of the words going into it, the arriving one
  // included: nothing laid out beside the line moves while the two halves do.
  holdWidest(element, [...wordsIn(element), text])
  const swap = motionMs('--dsh-claude-duration-swap')
  const gap = motionMs('--dsh-claude-duration-swap-gap')

  // A swap already in flight: the words arriving take these ones and the two
  // halves keep moving. A wording that changes again inside a swap is one call's
  // own words cutting in ahead of the wording lock (wait-state.ts), and the line
  // settles on the newest of them rather than playing the ones in between back.
  const arriving = state.timer === null ? null : enteringOf(element)
  if (arriving !== null) {
    fillCopy(arriving, text, withShimmer)
    element.dataset.text = text
    return
  }
  // A swap whose copies are no longer in the box is dropped: the settle timer it
  // left would bring the box down in the middle of the swap started below.
  if (state.timer !== null) {
    window.clearTimeout(state.timer)
    state.timer = null
  }

  // The two halves travel together: the copy holding the words leaves upward at
  // once, and the copy arriving stands parked below it until the gap has passed.
  // Both are in the box for the rest of the swap, so the line never stands empty
  // the way it does when the words leaving have finished before the arriving
  // ones start.
  const leaving = document.createElement('span')
  leaving.className = COPY_CLASS + (withShimmer ? ' dsh-claude-swap-shimmer' : '')
  fillCopy(leaving, was ?? '', withShimmer)
  leaving.setAttribute('aria-hidden', 'true')
  while (element.childNodes.length > 1) element.removeChild(element.lastChild!)
  element.appendChild(leaving)
  void leaving.offsetWidth
  leaving.classList.add('is-exit')
  const entering = document.createElement('span')
  entering.className = COPY_CLASS + ' is-enter-start' + (withShimmer ? ' dsh-claude-swap-shimmer' : '')
  fillCopy(entering, text, withShimmer)
  entering.setAttribute('aria-hidden', 'true')
  element.appendChild(entering)
  element.dataset.text = text
  // The parked pose has to be committed before the class comes off: a copy the
  // browser reads only on the next frame travels from where it already stands,
  // which is no move at all.
  void entering.offsetWidth
  if (gap > 0) window.setTimeout(() => entering.classList.remove('is-enter-start'), gap)
  else entering.classList.remove('is-enter-start')
  // The copy that left is taken down once the arriving one has settled: the
  // sizer holds the box through the whole swap, so nothing depends on it any
  // more. The words left standing take the box over there, which is what brings
  // the clock back to sit right after them. The box's own width travels at its
  // own duration (--dsh-claude-duration-slide), which is longer than the two
  // halves: letting the pin go before that move has landed drops the rest of it
  // in one step, and the clock jumps instead of sliding.
  state.timer = window.setTimeout(() => {
    state.timer = null
    if (!element.isConnected) return
    leaving.remove()
    holdWidest(element, wordsIn(element))
  }, Math.max(swap + gap, motionMs('--dsh-claude-duration-slide')))
}

/**
 * Let go of a label's swap: a row leaving the page takes no timer with it, and
 * neither its exit nor a width still travelling may outlive it. The words
 * standing stay where they are.
 */
export function releaseSwappingText(element: HTMLElement) {
  const state = swapped.get(element)
  if (state === undefined) return
  if (state.timer !== null) window.clearTimeout(state.timer)
  if (state.travel !== null) {
    window.clearTimeout(state.travel.timer)
    element.style.width = ''
  }
  swapped.delete(element)
}
