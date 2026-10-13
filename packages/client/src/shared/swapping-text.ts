import { motionReduced } from '../core/prefs'

/**
 * One line of words that swaps in place, after transitions.dev's "Text states
 * swap" (MIT), by way of its "Thinking states" composition: the wording leaving
 * rises out through a small blur, the wording arriving comes up from below, and
 * the box neither resizes nor jumps mid-swap.
 *
 * The box's width belongs to a hidden sizer, which is the recipe's own answer to
 * the problem the swap would otherwise cause: the copies are absolutely
 * positioned, so a box that held only what is moving would read as empty for the
 * length of a swap and throw everything laid out beside it to the left edge and
 * back. The sizer holds the widest of the words a swap puts in the box while it
 * runs, and comes down onto the words standing the moment it settles — so two
 * states of different lengths never leave the clock beside the line stranded
 * after words that are no longer that long. The wording is written into the
 * sizer as well, so the live region hears one line and never two.
 *
 * The names, the blurs and the distance are the recipe's, carried as this
 * skin's own properties; shared/swapping-text.css reads them. The reader's
 * animation choice (D26) decides at call time whether any of it runs, instead
 * of the recipe's own media query — core/prefs.ts has already resolved the
 * setting and the system preference into one answer.
 */

/** The class on the hidden sizer the box takes its width from. */
const SIZER_CLASS = 'dsh-claude-swap-sizer'
/** The class on one copy of the words (shared/swapping-text.css). */
const COPY_CLASS = 'dsh-claude-swap-copy'

/**
 * The word a swap is handing over to, the exit in flight, and whether this
 * element has ever been written. The written mark matters: a line that already
 * carries its words when it is first handed over must not swap them for the
 * identical words.
 */
const swapped = new WeakMap<HTMLElement, { pending: string | null, timer: number | null, written: boolean }>()

function stateOf(element: HTMLElement) {
  let state = swapped.get(element)
  if (state === undefined) {
    state = { pending: null, timer: null, written: false }
    swapped.set(element, state)
  }
  return state
}

/** A duration written in a CSS token, in milliseconds. */
function milliseconds(element: HTMLElement, token: string, fallback: number) {
  const value = getComputedStyle(element).getPropertyValue(token)
  const parsed = /^\s*([\d.]+)\s*(ms|s)?\s*$/.exec(value)
  if (parsed === null) return fallback
  const amount = Number(parsed[1])
  return Number.isFinite(amount) ? (parsed[2] === 's' ? amount * 1000 : amount) : fallback
}

/** The distance a swap travels, as written in the token, or the recipe's own. */
function distanceOf(element: HTMLElement) {
  const value = getComputedStyle(element).getPropertyValue('--dsh-claude-swap-distance').trim()
  const parsed = /^(-?[\d.]+)\s*(px|rem)?$/.exec(value)
  if (parsed === null) return '8px'
  const amount = Number(parsed[1])
  if (!Number.isFinite(amount)) return '8px'
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
  return sizer.offsetWidth
}

/**
 * Hold the box at the widest of the words a swap puts in it. The clock beside
 * the line is laid out against this box, so its width may not change while the
 * two halves move; the words left standing take it over once they settle
 * (setSwappingText), which is what keeps the clock right after them at rest.
 */
function holdWidest(element: HTMLElement, texts: readonly string[]) {
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
}

/**
 * Hand the shimmer class to the box showing the words. The box carrying it owns
 * the whole masked highlight — `attr(data-text)` and `inset: 0` are read off it
 * — so the class sits on whichever copy is showing the words, and the label
 * itself carries it while nothing is moving.
 */
function shimmerOn(element: HTMLElement, holder: HTMLElement) {
  if (holder !== element) element.classList.remove('dsh-claude-swap-shimmer')
  holder.classList.add('dsh-claude-swap-shimmer')
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
  // The box takes the widest of the words going into it, the arriving one
  // included: nothing laid out beside the line moves while the two halves do.
  holdWidest(element, [...wordsIn(element), text])

  if (first || motionReduced()) {
    state.pending = null
    if (state.timer !== null) {
      window.clearTimeout(state.timer)
      state.timer = null
    }
    const standing = document.createElement('span')
    standing.className = COPY_CLASS
    standing.textContent = text
    standing.setAttribute('data-text', text)
    // The sizer is the only thing in the flow, so the words standing are
    // replaced outright; nothing moves and nothing measures them.
    while (element.childNodes.length > 1) element.removeChild(element.lastChild!)
    element.appendChild(standing)
    element.dataset.text = text
    // The box comes down onto the words standing — the copies the last swap
    // left behind are gone — so the clock sits right after them again.
    hold(sizerOf(element), text)
    if (withShimmer) element.classList.add('dsh-claude-swap-shimmer')
    else element.classList.remove('dsh-claude-swap-shimmer')
    return
  }

  state.pending = text
  if (state.timer !== null) return
  // The copy left behind is the one holding the words now: it starts leaving at
  // once while the words arriving get a copy of their own underneath it.
  const leaving = document.createElement('span')
  leaving.className = COPY_CLASS + (withShimmer ? ' dsh-claude-swap-shimmer' : '')
  leaving.textContent = was ?? ''
  leaving.setAttribute('data-text', was ?? '')
  leaving.setAttribute('aria-hidden', 'true')
  while (element.childNodes.length > 1) element.removeChild(element.lastChild!)
  element.appendChild(leaving)
  void leaving.offsetWidth
  leaving.classList.add('is-exit')
  const swap = milliseconds(element, '--dsh-claude-swap-duration', 150)
  const gap = milliseconds(element, '--dsh-claude-swap-gap', 50)
  state.timer = window.setTimeout(() => {
    state.timer = null
    const next = state.pending
    state.pending = null
    if (next === null || !element.isConnected) return
    // The recipe's three phases: the outgoing copy has been leaving since the
    // swap began, the incoming one is parked at its rest pose below it, and
    // only a committed reflow releases it — so both halves move at once.
    const entering = document.createElement('span')
    entering.className = COPY_CLASS + ' is-enter-start' + (withShimmer ? ' dsh-claude-swap-shimmer' : '')
    entering.textContent = next
    entering.setAttribute('data-text', next)
    entering.setAttribute('aria-hidden', 'true')
    element.appendChild(entering)
    element.dataset.text = next
    void entering.offsetWidth
    if (gap > 0) window.setTimeout(() => entering.classList.remove('is-enter-start'), gap)
    else entering.classList.remove('is-enter-start')
    // The copy that left is taken down once its fade is over: the sizer holds
    // the box through the whole swap, so nothing depends on it any more. The
    // words left standing take the box over there, which is what brings the
    // clock back to sit right after them.
    window.setTimeout(() => {
      leaving.remove()
      holdWidest(element, wordsIn(element))
      shimmerOn(element, entering)
    }, swap + gap)
  }, swap)
}

/**
 * Let go of a label's swap: a row leaving the page takes no timer with it. The
 * words standing stay where they are.
 */
export function releaseSwappingText(element: HTMLElement) {
  const state = swapped.get(element)
  if (state === undefined) return
  if (state.timer !== null) window.clearTimeout(state.timer)
  swapped.delete(element)
}
