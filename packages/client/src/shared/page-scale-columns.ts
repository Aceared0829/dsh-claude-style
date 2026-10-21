/**
 * The host frame's three columns, in the pixels the page's own styles read
 * (D43, D81).
 *
 * The host measures its frame with `getBoundingClientRect()` — the window's
 * pixels — and writes the three columns from that measurement into an inline
 * `grid-template-columns`, which the page's scale reads again: every column is
 * drawn at the scale, a sidebar dragged to 280 stands 350 wide, and the columns
 * add up to a factor past the window; a column narrowed to the window's own
 * width stands a factor wider than it and the sidebar it starts is cut off at
 * the page's left edge. Dividing each written length by the scale once draws the
 * frame at the width it was measured at.
 *
 * A written list holding anything but a length is left alone: `1fr`, `minmax`
 * and `fit-content` are resolved against the track the page gives them, and only
 * a length the host measured doubles.
 *
 * A track it cannot read a length out of leaves the whole write to the host: a
 * frame whose last column narrows to nothing (`0px`) stands at a scale-free zero
 * on both sides of the division, and reading the rest as written would leave the
 * columns adding up to a factor past the window again. When the page is scaled
 * the host's own write is therefore handed straight back and the frame keeps the
 * space the page gives it, its first column standing at the width the host asked
 * for.
 */
import { observeMatches, subscribeMutations } from '@dsh-claude-style/engine/bus'
import { cacheFirstMatch } from '@dsh-claude-style/engine/host'
import { ROOT_SLOT_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { subscribePrefs } from '../core/prefs'

/** One length in the host's written column list, and the bracket group a length
 * may stand inside (`minmax(0px, 0px)`). */
const LENGTH = /^(\d+(?:\.\d+)?)px$/
const GROUP = /^(minmax|clamp|min|max)\((.*)\)$/

/** One written track, in the page's pixels; null when it holds a `fr` or a
 * keyword the page resolves against the track it is given, never a measurement. */
function trackInPage(track: string, scale: number) {
  const length = LENGTH.exec(track)
  if (length !== null) return `${Math.round(Number(length[1]) / scale * 100) / 100}px`
  const group = GROUP.exec(track)
  if (group === null) return null
  const inner: string[] = []
  for (const part of group[2].split(',')) {
    const trimmed = part.trim()
    inner.push(LENGTH.test(trimmed) ? trackInPage(trimmed, scale)! : trimmed)
  }
  return `${group[1]}(${inner.join(', ')})`
}

/** The written tracks, with a bracket group kept whole (`minmax(0px, 1fr)`). */
function tracks(written: string) {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const character of written.trim()) {
    if (character === '(') depth += 1
    if (character === ')') depth -= 1
    if (depth === 0 && /\s/.test(character)) {
      if (current !== '') parts.push(current)
      current = ''
      continue
    }
    current += character
  }
  if (current !== '') parts.push(current)
  return parts
}

/**
 * Whether a track has no width at all: a zero length, or a bracket group whose
 * every bound is a zero length. Such a track stands at zero on both sides of the
 * division, so the page gives it nothing on either side of it either, and the
 * rest of the list reads as written.
 */
function isNothing(track: string): boolean {
  const length = LENGTH.exec(track)
  if (length !== null) return Number(length[1]) === 0
  const group = GROUP.exec(track)
  if (group === null) return false
  const bounds = group[2].split(',').map(part => part.trim())
  return bounds.every(bound => LENGTH.test(bound) && isNothing(bound))
}

/**
 * The host's own column list, in the page's pixels.
 *
 * @param written - the value the host wrote into `grid-template-columns`.
 * @param scale - the scale the page is drawn at.
 * @returns the list to write instead, or null when the page is at its own scale,
 *     when a track holds a `fr` or a keyword the page resolves itself, or when a
 *     track reads as nothing — a zero track stands at zero in both spaces, and
 *     dividing the rest would leave the columns a factor past the window.
 */
export function inPageColumns(written: string, scale: number) {
  if (!(scale > 0) || scale === 1 || written.trim() === '') return null
  const inPage: string[] = []
  for (const part of tracks(written)) {
    const converted = trackInPage(part, scale)
    if (converted === null) return null
    if (0 === Number.parseFloat(converted) || isNothing(part)) return null
    inPage.push(converted)
  }
  return inPage.join(' ')
}

/** What this rule needs from the skin it serves (D73). */
export interface FrameColumnsVocabulary {
  /** The scale the page is drawn at right now: 1 while the page is not scaled. */
  scale(): number
}

/** One write this rule made: the frame, the number the host wrote, and the number it drew. */
interface Carry {
  /** The value the host itself wrote, which this rule has already read. */
  from: string
  /** The value read from it, which this rule left in place. */
  to: string
}

/**
 * The shell's frame. It is marked only while it carries a host class the parts
 * table reads; a shell whose class names the table has not been taught leaves
 * it unmarked, and the frame is then the root slot's own child (D3).
 */
const FRAME_SELECTOR = '[data-dsh-claude-part~="layout-frame"]'

/**
 * Lay the host frame's columns out in the page's own pixels.
 *
 * @returns settle: read the frame again, for a host write or a scale that
 *     changed under it; stop: give every frame back.
 */
export function installFrameColumns(vocabulary: FrameColumnsVocabulary) {
  /** What this rule has carried, per frame: the frame's own record of what it read. */
  const carried = new Map<HTMLElement, Carry>()

  const carry = (frame: HTMLElement) => {
    const value = frame.style.getPropertyValue('grid-template-columns')
    if (value === '') return
    const seen = carried.get(frame)
    // A second pass reads this rule's own number back as the host's write; it is
    // the one kept from the last read, and dividing it again would shrink the
    // columns on every pass.
    if (seen !== undefined && (value === seen.from || value === seen.to)) return
    const inPage = inPageColumns(value, vocabulary.scale())
    if (inPage === null) {
      carried.delete(frame)
      return
    }
    frame.style.setProperty('grid-template-columns', inPage)
    carried.set(frame, { from: value, to: inPage })
  }

  /** The frames being heard, each with the subscription that hears its own write. */
  const heard = new Map<HTMLElement, () => void>()
  // The frame is remounted with the shell: the bus's registry follows it (D40),
  // and the host's own write lands on the frame, which this hears.
  const seats = observeMatches<HTMLElement>(FRAME_SELECTOR, () => sync())
  // The root slot is read through the engine's kept match (D40), never walked.
  const rootSlot = cacheFirstMatch<HTMLElement>(ROOT_SLOT_SELECTOR)

  /** Every frame standing in the shell: the marked one, or the root slot's own child. */
  const framesInShell = () => {
    const marked = seats.all()
    if (marked.length > 0) return marked
    const slot = rootSlot()
    const child = slot === null ? null : slot.firstElementChild
    return child instanceof HTMLElement ? [child] : []
  }

  /** Hear every frame the page draws, and drop the ones that left. */
  const sync = () => {
    const present = new Set<HTMLElement>()
    for (const frame of framesInShell()) {
      present.add(frame)
      if (!heard.has(frame)) {
        heard.set(frame, subscribeMutations(frame, { attributes: true, attributeFilter: ['style'] }, () => carry(frame)))
      }
      carry(frame)
    }
    for (const [frame, off] of [...heard]) {
      if (present.has(frame)) continue
      heard.delete(frame)
      off()
      carried.delete(frame)
    }
  }

  const offPrefs = subscribePrefs(sync)
  sync()

  return {
    settle: sync,
    stop() {
      seats.release()
      offPrefs()
      for (const [frame, off] of heard) {
        off()
        const seen = carried.get(frame)
        if (seen !== undefined) frame.style.setProperty('grid-template-columns', seen.from)
      }
      carried.clear()
      heard.clear()
    },
  }
}
