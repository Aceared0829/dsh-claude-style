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
 */

/** How much of the reasoning's tail one scan reads, in characters. */
export const PHRASE_TAIL_CHARS = 400
/** The longest clause the line carries; a longer one is cut here. */
export const PHRASE_MAX_CHARS = 40

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
  return phrase === null ? null : cut(phrase)
}

/** The line's own length: a clause past it is cut where it stops fitting. */
function cut(phrase: string) {
  if (phrase.length <= PHRASE_MAX_CHARS) return phrase
  return `${phrase.slice(0, PHRASE_MAX_CHARS).trimEnd()}\u2026`
}
