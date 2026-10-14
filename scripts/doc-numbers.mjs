#!/usr/bin/env node
/**
 * doc-numbers.mjs — every number a document states has a home (D48).
 *
 * A value with a unit drifts silently: a duration moves in the token table
 * while the prose beside it keeps the old figure, a pixel value changes in the
 * stylesheet while the guide keeps the old one. So a document may state a value
 * with a unit only when this file can name where that value lives — a token in
 * packages/client/src/theme/tokens.json, or an entry in ALLOWED carrying the
 * constant behind it. Everything else reads the generated table instead of the
 * number, or says what happens without the figure.
 *
 * An ALLOWED entry is a magnitude, not a spelling: `1 s` covers `1 秒`,
 * `1 second` and `1000ms`, so the two languages of one document are held to the
 * same value once. An entry that matches nothing fails, so the list stays
 * honest.
 *
 * The numbers of docs/FEATURES.md and docs/FEATURES.en.md are read at their
 * source, the manifests those documents are generated from; the generated
 * regions of docs/STYLE.md are read at theirs, the token table. The licence
 * notices, the changelog and the change records are outside this rule: their
 * numbers are a historical record.
 *
 * Usage: node scripts/doc-numbers.mjs [--print]
 *        --print lists every number it read and exits 0.
 */
import fs from 'node:fs'
import path from 'node:path'
import manifestReader from './shared/read-manifests.cjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const PRINT = process.argv.includes('--print')

/** The hand-written documents this rule reads, repository-relative. */
const DOCUMENTS = [
  'README.md',
  'README.en.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'docs/SETTINGS.md',
  'docs/SETTINGS.en.md',
  'docs/STYLE.md',
]

/**
 * A value with a unit, as prose spells it in either language. The character
 * before the number may not continue a word, a version or a decimal; the one
 * after may not continue an identifier, so `0.1.7`, `#FCFCFB` and `30d` are no
 * match.
 */
const NUMBER = /(?<![\w.#-])(\d+(?:[.,]\d+)?)\s*(milliseconds|millisecond|seconds|second|minutes|minute|hours|hour|days|day|weeks|week|characters|character|chars|char|pixels|pixel|ms|s|px|%|MB|KB|毫秒|秒|分钟|小时|天|周|字|像素)(?![\w])/gi

/**
 * Every unit, as the magnitude it stands for: time in milliseconds, length in
 * pixels, size in bytes, and a share or a count as itself.
 */
const UNITS = {
  ms: ['time', 1], millisecond: ['time', 1], milliseconds: ['time', 1],
  s: ['time', 1000], second: ['time', 1000], seconds: ['time', 1000],
  '秒': ['time', 1000], '毫秒': ['time', 1],
  minute: ['time', 60000], minutes: ['time', 60000], '分钟': ['time', 60000],
  hour: ['time', 3600000], hours: ['time', 3600000], '小时': ['time', 3600000],
  day: ['time', 86400000], days: ['time', 86400000], '天': ['time', 86400000],
  week: ['time', 604800000], weeks: ['time', 604800000], '周': ['time', 604800000],
  px: ['length', 1], pixel: ['length', 1], pixels: ['length', 1], '像素': ['length', 1],
  '%': ['share', 1],
  MB: ['size', 1048576], KB: ['size', 1024],
  char: ['characters', 1], chars: ['characters', 1], character: ['characters', 1], characters: ['characters', 1], '字': ['characters', 1],
}

/**
 * The numbers a document may state, each with where it lives. `value` is the
 * magnitude (any spelling of it matches); `home` is the token or the constant
 * behind it.
 */
const ALLOWED = [
  { value: '2 MB', home: 'packages/contracts/src/brand.ts BRAND_IMAGE_MAX_BYTES' },
  { value: '24 hours', home: 'packages/host/src/peakrate.ts PEAKRATE_REFRESH_MS' },
  { value: '99%', home: 'features/context-stats/stats-ramp.ts CACHE_HIT_STOPS' },
  { value: '1 s', home: 'features/chat-wait/wait-state.ts WORD_LOCK_MS' },
  { value: '10 s', home: 'features/chat-wait/wait-state.ts WAIT_OVERTIME_MS' },
  { value: '32 characters', home: 'shared/file-tool.ts FILE_NAME_MAX_CHARS' },
  { value: '40 characters', home: 'shared/activity-phrase.ts PHRASE_MAX_CHARS' },
]

/**
 * One value with a unit as the magnitude it stands for, or null where the unit
 * is not one this rule reads.
 *
 * @returns `{ key, printable }`: the magnitude's key, and how it prints.
 */
function magnitude(number, unit) {
  const entry = UNITS[unit.toLowerCase()] ?? UNITS[unit]
  if (entry === undefined) return null
  const [kind, factor] = entry
  const value = Number(number.replace(',', '.'))
  return { kind, value: value * factor, key: `${kind}:${value * factor}` }
}

/** The token table's values, as the magnitude each token holds. */
function tokenHomes() {
  const file = path.join(ROOT, 'packages', 'client', 'src', 'theme', 'tokens.json')
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'))
  const homes = new Map()
  const units = /^(\d+(?:\.\d+)?)\s*(ms|s|px|%)$/
  for (const group of ['motion', 'layer']) {
    for (const item of doc[group] ?? []) {
      const parts = typeof item.value === 'string' ? item.value.match(units) : null
      if (parts === null) continue
      const found = magnitude(parts[1], parts[2])
      if (found !== null && !homes.has(found.key)) homes.set(found.key, item.token)
    }
  }
  return homes
}

/** Every number one document states, as `{ value, key, line, text }`. */
function numbersOf(text) {
  const found = []
  text.split('\n').forEach((line, at) => {
    for (const match of line.matchAll(NUMBER)) {
      const read = magnitude(match[1], match[2])
      if (read === null) continue
      found.push({ value: match[0].replace(/\s+/g, ' ').trim(), key: read.key, line: at + 1, text: line.trim().slice(0, 70) })
    }
  })
  return found
}

/** A document with its generated regions, its markup and its link targets taken out. */
function readable(text) {
  return text
    .replace(/<!--\s*generated:[^>]*-->[\s\S]*?<!--\s*\/\s*generated:[^>]*-->/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\]\([^)]*\)/g, ']')
}

const allowed = new Map(ALLOWED.map((entry) => {
  const parts = entry.value.match(/^(\d+(?:\.\d+)?)\s*(\S+)$/)
  const read = magnitude(parts[1], parts[2])
  if (read === null) throw new Error(`doc-numbers: the allow-list entry "${entry.value}" has no unit this rule reads`)
  return [read.key, entry]
}))
const used = new Set()
const problems = []
let read = 0

function readDocument(where, text) {
  const homes = tokenHomes()
  for (const found of numbersOf(readable(text))) {
    read += 1
    if (PRINT) {
      console.log(`${where}:${found.line}  ${found.value}  ${found.text}`)
      continue
    }
    if (allowed.has(found.key)) {
      used.add(found.key)
      continue
    }
    const token = homes.get(found.key)
    problems.push(
      `${where}:${found.line}: states "${found.value}"${token === undefined ? ', which no token holds' : `, which is the token ${token}`}` +
      ` — read it from there, write the effect without the figure, or register it in scripts/doc-numbers.mjs with its home`,
    )
  }
}

for (const file of DOCUMENTS) {
  const full = path.join(ROOT, file)
  if (!fs.existsSync(full)) continue
  readDocument(file, fs.readFileSync(full, 'utf8'))
}

const manifests = manifestReader.readManifests()
for (const manifest of manifests) {
  for (const language of ['zh', 'en']) {
    const copy = manifest.description[language]
    readDocument(`packages/client/src/${manifest.file} (${language})`, `${copy.title}\n${copy.text}`)
  }
}

for (const entry of ALLOWED) {
  const parts = entry.value.match(/^(\d+(?:\.\d+)?)\s*(\S+)$/)
  if (!used.has(magnitude(parts[1], parts[2]).key)) {
    problems.push(`doc-numbers: the allow-list entry "${entry.value}" (${entry.home}) matches no document — remove it or restore the number`)
  }
}

if (PRINT) {
  console.log(`doc-numbers: read ${read} numbers`)
} else if (problems.length > 0) {
  for (const problem of problems) console.error(`doc-numbers: ${problem}`)
  console.error(`doc-numbers: ${problems.length} problems in ${DOCUMENTS.length} documents and ${manifests.length} manifests`)
  process.exitCode = 1
} else {
  console.log(`doc-numbers: ${read} numbers in ${DOCUMENTS.length} documents and ${manifests.length} manifests, each with a home (${allowed.size} allow-listed)`)
}
