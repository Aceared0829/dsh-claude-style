import { QUIET_ATTR } from '../../constants'
import { requestFrame } from '../../core/frame'
import { closestConversationSession, conversationSessionId, findChatTarget } from '../../core/host'
import { copyLabel } from '../../core/i18n'
import { buildElement } from '../../shared/dom'
import { formatHostDuration } from '../../shared/format'
import { releaseSwappingText, setSwappingText } from '../../shared/swapping-text'
import { activityWords } from '../../shared/turn-activity'
import { CHAT_RUNNING_SELECTOR, CHAT_RUNNING_TEXT_SELECTOR } from '@dsh-claude-style/contracts/dom'
import { WAIT_OVERTIME_MS, openTurn, waitStart } from './wait-state'
import type { HostContext, HostText } from '../../core/host'
import type { FeatureUi } from '../../core/feature'
import type manifest from './chat-wait.manifest'

/**
 * The live turn's running row, after dsh-better-display's status line (MIT):
 * what the turn is doing now in this line's own words
 * (shared/turn-activity.ts), the host's own 「深度求索中」 where no state can be
 * read, the turn's elapsed time as a quiet clock beside it, and 「暂未响应」
 * once the model has been silent for ten seconds (wait-state.ts). The wording
 * swaps in place after transitions.dev's "Thinking states" (MIT): a sweeping
 * highlight while a word stands, and a two-copy swap when it changes
 * (shared/swapping-text.ts).
 *
 * The host keeps its row, its whale and its live region: the line is a span of
 * the skin's own beside the whale, marked quiet so its ticking wakes no pass,
 * and the stylesheet hides the host's words while it stands (chat-wait.css).
 * The words, the clock's units and the session's turns are the host's.
 *
 * @param ctx - client context.
 * @param ui - shared handle table.
 * @returns teardown.
 */
export function install(ctx: HostContext, ui: FeatureUi<typeof manifest>) {
  /** On the host's running row while the line stands in for its words. */
  const WAIT_ATTR = 'data-dsh-claude-wait'
  /** On the host's words alone, leaving sibling plugin lines visible. */
  const WORDS_ATTR = 'data-dsh-claude-wait-words'
  /** The clock's step: the host's own row ticks once a second, and a quarter keeps the two in step. */
  const TICK_MS = 250
  /** Each running row with the line drawn into it. */
  const lines = new Map<HTMLElement, HTMLElement>()
  const hostWords = new Map<HTMLElement, Element>()
  /** When each turn's current wait began, by `session:turn`; absent while the model is at work. */
  const waits = new Map<string, number>()
  let timer: number | null = null
  let cancelTick: (() => void) | null = null

  /** The line inside one row, built the first time beside the host's words. */
  function lineOf(row: HTMLElement, words: Element) {
    const previous = hostWords.get(row)
    if (previous !== words) {
      previous?.removeAttribute(WORDS_ATTR)
      words.setAttribute(WORDS_ATTR, '')
      hostWords.set(row, words)
    }
    let line = lines.get(row)
    if (line !== undefined && line.isConnected) return line
    line = buildElement('span', 'dsh-claude-chat-wait')
    line.setAttribute(QUIET_ATTR, '')
    // The host's own words are hidden while this line stands in for them
    // (chat-wait.css), so the line carries what a reader gets: the wording, the
    // clock and the wait badge are ordinary text, and the host's live region
    // still announces the row.
    line.append(
      buildElement('span', 'dsh-claude-chat-wait-label'),
      buildElement('span', 'dsh-claude-chat-wait-clock'),
      buildElement('span', 'dsh-claude-chat-wait-badge'),
    )
    words.after(line)
    lines.set(row, line)
    return line
  }

  function writeText(element: Element, text: string) {
    if (element.textContent !== text) element.textContent = text
  }

  /** Bring one row's line to what the host's snapshot says now. */
  function syncRow(row: HTMLElement, t: HostText, now: number, seen: Set<string>) {
    const words = row.querySelector(CHAT_RUNNING_TEXT_SELECTOR)
    if (words === null) return
    const sessionId = conversationSessionId(closestConversationSession(row))
    const target = sessionId === null ? null : findChatTarget(ctx, sessionId)
    const snapshot = target === null ? null : target.getSnapshot() ?? null
    const turn = snapshot === null ? undefined : openTurn(snapshot)
    const line = lineOf(row, words)
    const [label, clock, badge] = line.children as HTMLCollectionOf<HTMLElement>
    // What the turn is doing, and the host's own word for a turn whose state
    // cannot be read (D58): the line says the model's work, never a guess.
    const activity = activityWords(snapshot, turn)
    const word = activity === null ? t('chat.deepDiving') : copyLabel(activity.key, activity.fallback)
    setSwappingText(label, word, true)
    clock.hidden = turn === undefined || turn.start === undefined
    if (turn !== undefined && turn.start !== undefined) writeText(clock, formatHostDuration(Math.max(1000, now - turn.start.time), t))
    let overtime = false
    if (snapshot !== null && turn !== undefined && activity === null) {
      const key = `${sessionId}:${turn.turn}`
      seen.add(key)
      let began = waits.get(key)
      if (began === undefined) {
        began = waitStart(turn, now)
        waits.set(key, began)
      }
      overtime = now - began >= WAIT_OVERTIME_MS
    }
    badge.hidden = !overtime
    if (overtime) writeText(badge, copyLabel('chatWaitOvertime', 'No response yet'))
    if (!row.hasAttribute(WAIT_ATTR)) row.setAttribute(WAIT_ATTR, '')
  }

  /** Take one row's line down and give the host's words back. */
  function release(row: HTMLElement) {
    const line = lines.get(row)
    if (line !== null && line !== undefined) {
      const label = line.firstElementChild
      if (label instanceof HTMLElement) releaseSwappingText(label)
      line.remove()
    }
    lines.delete(row)
    hostWords.get(row)?.removeAttribute(WORDS_ATTR)
    hostWords.delete(row)
    row.removeAttribute(WAIT_ATTR)
  }

  function sync() {
    const t = ctx.get('locale')?.bind('chat')
    const rows = t === undefined ? [] : [...document.querySelectorAll<HTMLElement>(CHAT_RUNNING_SELECTOR)]
    const now = Date.now()
    const seen = new Set<string>()
    for (const row of rows) syncRow(row, t!, now, seen)
    for (const row of [...lines.keys()]) {
      if (!rows.includes(row)) release(row)
    }
    // A wait the model ended, or a turn that closed, starts over next time.
    for (const key of [...waits.keys()]) {
      if (!seen.has(key)) waits.delete(key)
    }
    // The clock ticks only while a row is on the page.
    if (lines.size > 0 && timer === null) {
      timer = window.setInterval(() => {
        if (cancelTick !== null) return
        cancelTick = requestFrame({ write() { cancelTick = null; sync() } })
      }, TICK_MS)
    } else if (lines.size === 0 && timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
  }

  ui.chatWait = { sync, onCopyChange: sync }

  return () => {
    if (timer !== null) window.clearInterval(timer)
    timer = null
    if (cancelTick !== null) cancelTick()
    cancelTick = null
    for (const row of [...lines.keys()]) release(row)
    for (const row of document.querySelectorAll(`[${WAIT_ATTR}]`)) row.removeAttribute(WAIT_ATTR)
    waits.clear()
    delete ui.chatWait
  }
}
