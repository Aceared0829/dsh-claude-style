/**
 * The words the model's own reasoning hands the waiting line (features/chat-wait):
 * an English present continuous clause — "I am checking the file is true" — read
 * off the tail of the newest reasoning block. One scan reads a fixed window of
 * that text and runs inside the line's own tick, so it costs no timer, no host
 * query and no page read of its own.
 *
 * A clause is taken once it has ended: wording that grew with every tick would
 * swap in place several times inside one sentence, and this line is read at a
 * glance beside its clock. A negated clause ("I am not sure …") is passed over,
 * since it says what the model is not doing. The shape is the whole rule, so an
 * adjective built the same way ("the file is missing") reads as a clause too.
 *
 * The clause is carried whole. How much of it the row can show is the row's own
 * question, answered by the line's box and the ellipsis it draws where the room
 * runs out (features/chat-wait/chat-wait.css), so a clause is never cut to a
 * character count the window knows nothing about.
 */

/** How much of the reasoning's tail one scan reads, in characters. */
export const PHRASE_TAIL_CHARS = 400

/** One clause: its auxiliary (a contraction included), an optional negation, and its participle. */
const CLAUSE = /(?:\b(?:am|is|are)|['\u2019](?:m|re|s))(\s+not)?\s+([a-z]+ing)\b/gi
/** Where a clause ends: sentence punctuation, a closing bracket, a dash or a line break. */
const CLAUSE_END = /[.,;:!?)\u2014\u2013\n\u3002\uff0c\uff1b\uff1a\uff01\uff1f\uff09]/

/**
 * What the model says it is doing, off one reasoning text, or null where it
 * says nothing of the kind: the last complete clause of the tail, its
 * participle capitalized and the auxiliary dropped ("Checking the file is true").
 */
export function activityPhrase(text: string): string | null {
  const tail = text.length <= PHRASE_TAIL_CHARS ? text : text.slice(-PHRASE_TAIL_CHARS)
  let phrase: string | null = null
  for (const match of tail.matchAll(CLAUSE)) {
    if (match[1] !== undefined) continue
    const rest = tail.slice((match.index ?? 0) + match[0].length)
    const end = rest.search(CLAUSE_END)
    if (end === -1) continue
    const words = `${match[2]}${rest.slice(0, end)}`.replace(/\s+/g, ' ').trim()
    if (words === '') continue
    phrase = words.charAt(0).toUpperCase() + words.slice(1)
  }
  return phrase
}
