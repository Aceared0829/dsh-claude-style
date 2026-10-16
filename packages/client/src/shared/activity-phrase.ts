/**
 * The words the model's own reasoning hands the waiting line (features/chat-wait):
 * the clause the model says it is on — "I am checking the file is true" — read
 * off the tail of the newest reasoning block. One scan reads a fixed window of
 * that text and runs inside the line's own tick, so it costs no timer, no host
 * query and no page read of its own.
 *
 * Where a sentence ends is the page's own sentence rules (`Intl.Segmenter`): a
 * dot inside a file name, a version number or an abbreviation does not end one,
 * so "I am reading app.js now." hands the line that whole clause and `e.g.` no
 * longer cuts it short. A clause is taken once its sentence has ended: wording
 * that grew with every tick would swap in place several times inside one
 * sentence, and this line is read at a glance beside its clock.
 *
 * Inside that sentence the shape is the whole rule: an auxiliary (`am`, `is`,
 * `are`, their contractions, and the perfect `have been`), up to two words of
 * the closed class that may stand between it and its participle (`now`,
 * `currently`, `still`, …), and a participle. A negated clause ("I am not sure
 * …") is passed over, since it says what the model is not doing, and so is a
 * plan the model has not started ("Let me check …", "about to check …"): this
 * line says the work in hand. Chinese reasoning hands it the clause in its own
 * shape (「正在读取 app.js」). The shape admits an adjective built the same way
 * ("the file is missing"), which no rule here can tell from a participle.
 *
 * The clause is carried whole, without the inline markers the reasoning is
 * written with (backticks, paired emphasis, a link's brackets). How much of it
 * the row can show is the row's own question, answered by the line's box and the
 * ellipsis it draws where the room runs out (features/chat-wait/chat-wait.css),
 * so a clause is never cut to a character count the window knows nothing about.
 *
 * The reading is remembered for the text it read: a pass runs four times a
 * second and on every publish the host makes, and a reasoning block that has not
 * grown answers the same both times.
 */

/** How much of the reasoning's tail one scan reads, in characters. */
export const PHRASE_TAIL_CHARS = 800

/** A sentence has ended once it ends with one of these, closing marks aside. */
const SENTENCE_MARKS = /[.!?\u2026\u3002\uff01\uff1f]+$/
/** What may follow a sentence's end: whitespace, a closing quote or bracket. */
const CLOSERS = /[\s"'\u201d\u2019\u300d\u300f\uff09)\]]+$/
/** Where a clause stops inside its sentence: punctuation below the sentence's own end. */
const CLAUSE_END = /[,;:\u2014\u2013)\uff0c\uff1b\uff1a\uff09]/
/** The same for a Chinese clause, whose sentence ends with its own mark. */
const CLAUSE_END_ZH = /[,;:!?)\u2014\u2013\u3002\uff0c\uff1b\uff1a\uff01\uff1f\uff09]/
/** A whole word, which is what an auxiliary, a qualifier and a participle are read as. */
const WORD = /[A-Za-z\u2019']+/g
/**
 * The words that may stand between an auxiliary and its participle. The list is
 * the whole class: anything else there means the auxiliary heads something this
 * line has no words for.
 */
const QUALIFIERS = new Set(['not', 'now', 'currently', 'still', 'just', 'already', 'again', 'simply', 'only', 'also', 'really'])
/** How many qualifiers one clause may carry. */
const QUALIFIER_LIMIT = 2
/**
 * `-ing` words that end a clause as nouns in reasoning ("It is morning", "There
 * is nothing left"), which the shape would otherwise read as a participle. An
 * entry belongs here only for a wording a real reasoning text carried.
 */
const NOMINAL_ING = new Set(['nothing', 'anything', 'everything', 'something', 'thing', 'morning', 'evening'])
/** The contraction tails that carry an auxiliary ("I'm", "it's", "I've"). */
const CONTRACTED_AUX = /['\u2019](m|re|s|ve)$/
/** The Chinese progressive marker, which the line carries along with its clause. */
const CHINESE_ANCHOR = '\u6b63\u5728'

/** The page's sentence rules, built once, at the runtime's own locale: the rules for English, Chinese and the dots inside a token are the same ones. */
let segmenter: Intl.Segmenter | null = null
/** What the last scan read, and what it answered, so a pass over an unchanged reasoning costs one comparison. */
let scannedText = ''
let scannedPhrase: string | null = null

/**
 * The sentences of `text` that have ended, newest first: a clause is never read
 * out of the sentence still growing at the end of the tail.
 */
function endedSentences(text: string): string[] {
  if (segmenter === null) segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' })
  const sentences: string[] = []
  for (const piece of segmenter.segment(text)) {
    if (SENTENCE_MARKS.test(piece.segment.replace(CLOSERS, ''))) sentences.push(piece.segment)
  }
  return sentences.reverse()
}

/** The clause without the markers reasoning is written with; a pair of `**` or `__` goes, a single `*` or `_` stays as an identifier's own. */
function stripMarkup(text: string) {
  return text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/`|\*\*|__|~~/g, '')
}

/** A participle: an `-ing` word the shape may anchor, the nominal ones left out. */
function isParticiple(token: string) {
  return /^[a-z]+ing$/i.test(token) && !NOMINAL_ING.has(token.toLowerCase())
}

/** What a token carries: the present auxiliary, the perfect one (which needs `been`), or either, as a bare `'s` can be. */
type Auxiliary = 'present' | 'perfect' | 'either'

function auxiliaryOf(token: string): Auxiliary | null {
  const lower = token.toLowerCase()
  const contracted = CONTRACTED_AUX.exec(lower)
  const form = contracted === null ? lower : contracted[1]
  if (form === 'am' || form === 'is' || form === 'are' || form === 'm' || form === 're') return 'present'
  if (form === 'have' || form === 'has' || form === 'had' || form === 've') return 'perfect'
  return form === 's' ? 'either' : null
}

/** A clause's body: from the participle to the first stop inside the sentence, or to the sentence's end. */
function clauseBody(sentence: string, from: number) {
  const rest = sentence.slice(from)
  const stop = rest.search(CLAUSE_END)
  const body = stripMarkup(stop === -1 ? rest : rest.slice(0, stop))
  // The marks a sentence carries after its end go first: a sentence the segmenter
  // handed over keeps its own full stop and the space after it.
  return body.replace(CLOSERS, '').replace(SENTENCE_MARKS, '').replace(/\s+/g, ' ').trim()
}

/**
 * The model's own clause out of one English sentence, or null where the sentence
 * says nothing of the kind: the sentence's last clause whose auxiliary is
 * followed by at most two qualifiers and a participle ("I am now checking the
 * row", "I have been checking it"). A negated clause is passed over rather than
 * ending the scan, since a clause before it may still say what the model is on.
 */
function englishClause(sentence: string): string | null {
  const words = [...sentence.matchAll(WORD)].map(match => ({ text: match[0], end: (match.index ?? 0) + match[0].length }))
  let phrase: string | null = null
  for (let at = 0; at < words.length; at++) {
    const head = auxiliaryOf(words[at].text)
    if (head === null) continue
    let next = at + 1
    const aspect = head === 'either' ? (words[next]?.text.toLowerCase() === 'been' ? 'perfect' : 'present') : head
    if (aspect === 'perfect') {
      if (words[next]?.text.toLowerCase() !== 'been') continue
      next += 1
    }
    let negated = false
    let taken = 0
    while (taken < QUALIFIER_LIMIT && next < words.length && QUALIFIERS.has(words[next].text.toLowerCase())) {
      if (words[next].text.toLowerCase() === 'not') negated = true
      next += 1
      taken += 1
    }
    if (negated || next >= words.length || !isParticiple(words[next].text)) continue
    const participle = words[next].text
    const body = clauseBody(sentence, words[next].end)
    phrase = `${participle.charAt(0).toUpperCase()}${participle.slice(1)}${body === '' ? '' : ` ${body}`}`
  }
  return phrase
}

/** The model's own clause out of one Chinese sentence, or null: the words after 正在, up to the sentence's own end. */
function chineseClause(sentence: string): string | null {
  const at = sentence.lastIndexOf(CHINESE_ANCHOR)
  if (at === -1) return null
  const rest = sentence.slice(at + CHINESE_ANCHOR.length)
  const stop = rest.search(CLAUSE_END_ZH)
  const body = stripMarkup(stop === -1 ? rest : rest.slice(0, stop)).replace(/\s+/g, ' ').trim()
  return body === '' ? null : `${CHINESE_ANCHOR}${body}`
}

/**
 * What the model says it is doing, off one reasoning text, or null where it says
 * nothing of the kind: the newest ended sentence of the tail that hands the line
 * a clause — a sentence saying nothing, or saying only what the model is not
 * doing, lets the one before it speak.
 */
export function activityPhrase(text: string): string | null {
  if (text === scannedText) return scannedPhrase
  const tail = text.length <= PHRASE_TAIL_CHARS ? text : text.slice(-PHRASE_TAIL_CHARS)
  scannedText = text
  scannedPhrase = null
  for (const sentence of endedSentences(tail)) {
    const clause = englishClause(sentence) ?? chineseClause(sentence)
    if (clause !== null) {
      scannedPhrase = clause
      break
    }
  }
  return scannedPhrase
}
