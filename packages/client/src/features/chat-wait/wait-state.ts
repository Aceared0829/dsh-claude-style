import type { HostChatSnapshot, HostTurn } from '@dsh-claude-style/contracts/services'

/**
 * When the model has kept the reader waiting, read off the host's chat
 * snapshot. The wait counts from the moment the move went back to the model,
 * not from the turn's first message, so the minutes a tool spent never count
 * against the model.
 */

/** Past this, a wait stops reading as a pause and reads as the model not answering. */
export const WAIT_OVERTIME_MS = 10_000

/**
 * Where a wait first seen at `now` began. Before the model has written anything
 * in the turn, the wait is the turn's own, from its start; after that the move
 * came back the moment the page saw the wait begin, which is as close as the
 * snapshot says — it carries no time for a tool's result.
 */
export function waitStart(turn: HostTurn, now: number) {
  const wrote = turn.steps.some(step => {
    const assistant = step.data.get('assistant-step')
    return assistant !== undefined && assistant.blocks.length > 0
  })
  return !wrote && turn.start !== undefined ? turn.start.time : now
}

/** The newest open turn of a snapshot, the one the running row speaks for. */
export function openTurn(snapshot: HostChatSnapshot): HostTurn | undefined {
  let found: HostTurn | undefined
  for (const turn of snapshot.timeline.turns.values()) {
    if (turn.status !== 'open') continue
    if (found === undefined || turn.turn > found.turn) found = turn
  }
  return found
}

/**
 * How long one wording stands once it has been written. A turn moves through
 * several states a second — a step settles and the next one starts, a call that
 * lasts a frame, the model's own clause — and a line that swapped on every one
 * of them reads as flicker. The wording written here is locked for this long,
 * and the pass that finds the lock run out writes whatever stands then, so
 * nothing that came and went inside the second is played back.
 */
export const WORD_LOCK_MS = 1000

/** The wording standing on one row, and until when it may not be replaced. */
export interface StandingWords {
  word: string
  until: number
}

/** The words a call in flight gave while a lock stood, and when they were read. */
export interface PendingCall {
  word: string
  at: number
}

/** What one row holds between passes: the wording standing, and the call words waiting for it. */
export interface RowWords {
  standing: StandingWords
  pending?: PendingCall
}

/** What one pass read: the words the state answers, the call the words are about, and the host's words under both. */
export interface PassReading {
  /** The words the state answers, or null where no state can be read at all. */
  word: string | null
  /** The words naming the file a call in flight works on, or null where no call names one. */
  file: string | null
  /** The state's own words are about a call: one being drawn up, or calls running with no file named. */
  onCall: boolean
  /** The host's own words for a wait, which stand when nothing else does. */
  host: string
}

/**
 * The word one pass writes, and what the row holds after it. A wording written
 * is locked for a second: inside that second the newest state waits, and the
 * pass that finds the lock run out writes it. A call's own words are the one
 * thing the lock may not lose — a read of a small file is over inside a frame —
 * so they wait for the lock and are written as soon as it ends, ahead of
 * whatever the state says by then; a state about another call takes their place,
 * since that is newer work than the file they name.
 */
export function wordForPass(reading: PassReading, row: RowWords | undefined, now: number): { word: string, row: RowWords } {
  const waiting = reading.file !== null
    ? { word: reading.file, at: now }
    : (reading.onCall ? undefined : row?.pending)
  if (row !== undefined && now < row.standing.until) {
    return { word: row.standing.word, row: waiting === undefined ? { standing: row.standing } : { standing: row.standing, pending: waiting } }
  }
  const candidate = waiting === undefined ? reading.word ?? reading.host : waiting.word
  if (row !== undefined && row.standing.word === candidate) return { word: candidate, row: { standing: row.standing } }
  return { word: candidate, row: { standing: { word: candidate, until: now + WORD_LOCK_MS } } }
}
