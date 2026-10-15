import { subscribeMutations } from '../../core/bus'
import { CHAT_FLYING_ATTR, MESSAGE_ENTER_ATTR, MESSAGE_ENTER_GROW } from '../../constants'
import { motionReduced, readPrefs } from '../../core/prefs'
import { motionMs } from '../../shared/motion'
import { currentRow, lastUserRow, takeFreshEcho, touchesUserRow } from './send-rows'
import { SUBMISSION_ECHO_SELECTOR } from '@dsh-claude-style/contracts/dom'

/**
 * The reader's message growing into its row instead of flying to it
 * (constants.ts MESSAGE_ENTER_MODES, the Motion tab's card): the same two
 * moments the flight watches — the host's echo, then the real row replacing it
 * — with no stand-in at all. The echo keeps its box and is hidden, and the row
 * that takes its place is marked so the stylesheet grows it out of its own
 * bottom-right corner (send-flight.css, shared/motion.css). Nothing beside the
 * message moves, which is the whole of the choice: the flight carries the words
 * up from the box they were typed in, this one writes them where they belong
 * and lets them take their size.
 *
 * Only the row that replaced the echo this watcher was following is marked, so
 * a row rendered by a restored session never animates: the echoes lying on the
 * page at install time are all handled up front.
 *
 * @returns teardown: the watchers go, and a message still hidden is shown.
 */
export function watchGrowEnter() {
  /** The echoes already dealt with; the ones lying on the page at install time are included (a restored session has them). */
  const handled = new WeakSet<Element>()
  for (const echo of document.querySelectorAll(SUBMISSION_ECHO_SELECTOR)) handled.add(echo)
  /** The row hidden while its message waits to grow. */
  let hidden: HTMLElement | null = null
  /** The last row standing when the submission was recognised: what makes the row that follows the new one. */
  let previous: HTMLElement | null = null
  /** The backstop timer: the mark is a decoration, and it may not outlive the message it is on. */
  let rescue = 0

  let stopRowWatch: (() => void) | null = null
  const unwind = () => {
    if (stopRowWatch !== null) stopRowWatch()
    stopRowWatch = null
    window.clearTimeout(rescue)
    rescue = 0
    hidden?.removeAttribute(CHAT_FLYING_ATTR)
    hidden = null
    previous = null
  }

  /**
   * Grow the row that has taken the echo's place. The mark comes off on the
   * row's own animationend, so a row that never animates — the choice turned to
   * Reduced while it waited — keeps no mark either.
   */
  const growRow = (records: MutationRecord[]) => {
    if (!touchesUserRow(records)) return
    const row = currentRow(previous)
    if (row === null) return
    unwind()
    row.setAttribute(MESSAGE_ENTER_ATTR, '')
    row.addEventListener('animationend', (event) => {
      if (event.target === row) row.removeAttribute(MESSAGE_ENTER_ATTR)
    }, { once: true })
  }

  const onEchoRecords = () => {
    if (hidden !== null) return
    if (readPrefs().messageEnter !== MESSAGE_ENTER_GROW) return
    // The reader's animation choice is read here rather than once at install
    // (D26): a still page writes the message without the growth.
    if (motionReduced()) return
    const echo = takeFreshEcho(handled)
    if (echo === null) return
    previous = lastUserRow()
    hidden = echo
    echo.setAttribute(CHAT_FLYING_ATTR, '')
    if (stopRowWatch === null) stopRowWatch = subscribeMutations(document.body, { childList: true, subtree: true }, growRow)
    rescue = window.setTimeout(unwind, motionMs('--dsh-claude-duration-enter') * 4)
  }

  const stopEchoWatch = subscribeMutations(document.body, { childList: true, subtree: true }, onEchoRecords)
  return () => {
    stopEchoWatch()
    unwind()
  }
}
