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
 * a length the host measured doubles. A zero track needs no such guard: it
 * stands at zero on both sides of the division, and the `1fr` beside it takes
 * the rest of the page's own width.
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
 * The host's own column list, in the page's pixels.
 *
 * @param written - the value the host wrote into `grid-template-columns`.
 * @param scale - the scale the page is drawn at.
 * @returns the list to write instead, or null when the page is at its own scale,
 *     or the list holds a track the page resolves itself (`1fr`, a keyword).
 */
export function inPageColumns(written: string, scale: number) {
  if (!(scale > 0) || scale === 1 || written.trim() === '') return null
  const inPage: string[] = []
  for (const part of tracks(written)) {
    const converted = trackInPage(part, scale)
    if (converted === null) return null
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
  /** The page's scale when the read happened: a different scale asks for the read again. */
  scale: number
}

/**
 * The shell's frame. It is marked only while it carries a host class the parts
 * table reads; a shell whose class names the table has not been taught leaves
 * it unmarked, and the frame is then the root slot's own child (D3).
 */
const FRAME_SELECTOR = '[data-dsh-claude-part~="layout-frame"]'

/**
 * What each frame's last carry left, kept on the frame itself.
 *
 * The skin's rules can stand on the page twice — a hot reload mounts the new
 * module before the old one is torn down — and a record kept in the module would
 * be one per copy: the copy that was not the writer reads the other's number as
 * the host's measurement, and divides the columns again on every pass until
 * almost nothing is left. The frame is what both copies share, so the record is
 * kept there, under a name no host and no stylesheet writes.
 */
const CARRY_ATTRIBUTE = 'data-dsh-claude-frame-columns'

function seenOn(frame: HTMLElement): Carry | null {
  const raw = frame.getAttribute(CARRY_ATTRIBUTE)
  if (raw === null) return null
  const [scale, from, to] = raw.split('\u0000')
  if (scale === undefined || from === undefined || to === undefined) return null
  return { from, to, scale: Number(scale) }
}

function markOn(frame: HTMLElement, carry: Carry) {
  frame.setAttribute(CARRY_ATTRIBUTE, `${carry.scale}\u0000${carry.from}\u0000${carry.to}`)
}

function forgetOn(frame: HTMLElement) {
  frame.removeAttribute(CARRY_ATTRIBUTE)
}

/**
 * Lay the host frame's columns out in the page's own pixels.
 *
 * @returns settle: read the frame again, for a host write or a scale that
 *     changed under it; stop: give every frame back.
 */
export function installFrameColumns(vocabulary: FrameColumnsVocabulary) {
  const carry = (frame: HTMLElement) => {
    const value = frame.style.getPropertyValue('grid-template-columns')
    if (value === '') return
    const seen = seenOn(frame)
    const scale = vocabulary.scale()
    // A second pass reads this rule's own number back as the host's write; it is
    // the one kept from the last read, and dividing it again would shrink the
    // columns on every pass. A different scale is a different answer, though: the
    // held number is the host's own, and it is carried again from there.
    if (seen !== null && value === seen.to && seen.scale !== scale) {
      const converted = inPageColumns(seen.from, scale)
      if (converted === null) {
        forgetOn(frame)
        frame.style.setProperty('grid-template-columns', seen.from)
        return
      }
      markOn(frame, { from: seen.from, to: converted, scale })
      frame.style.setProperty('grid-template-columns', converted)
      return
    }
    if (seen !== null && (value === seen.from || value === seen.to)) return
    const inPage = inPageColumns(value, scale)
    if (inPage === null) {
      // The page is at its own scale again, or the write holds a track this rule
      // does not read: the host's own numbers are the ones that stand.
      if (seen !== null) {
        forgetOn(frame)
        frame.style.setProperty('grid-template-columns', seen.from)
      }
      return
    }
    markOn(frame, { from: value, to: inPage, scale })
    frame.style.setProperty('grid-template-columns', inPage)
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
      forgetOn(frame)
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
        const seen = seenOn(frame)
        if (seen !== null) frame.style.setProperty('grid-template-columns', seen.from)
        forgetOn(frame)
      }
      heard.clear()
    },
  }
}
