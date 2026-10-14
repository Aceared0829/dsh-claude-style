#!/usr/bin/env node
/**
 * decision-number.mjs — assign a draft decision its real number (D48).
 *
 * A decision is drafted under the D00 placeholder so parallel branches never
 * fight over "the next number". At merge time this script takes the highest
 * number in use — live or retired — plus one, rewrites the draft's file name,
 * title and every D00 citation across the repository, and rebuilds the index.
 *
 * Usage: node scripts/decision-number.mjs [D00-<slug>.md]
 * With several drafts in flight, name the one to number; each draft's own
 * sweep leaves the other drafts' placeholders alone.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { filesUnder } from './shared/file-walk.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const DECISIONS = path.join(ROOT, 'docs', 'decisions')
/** The placeholder as a citation: the same boundaries lint's citation rule uses. */
const PLACEHOLDER = /(?<![\w#-])D00(?![\w-])/g

/** The walk never enters local scratch or build output. */
const SKIPPED_DIRS = new Set(['.git', '.debug', '.claude', 'node_modules', 'lib'])

/**
 * Files the sweep never rewrites: the mechanism's own documentation mentions
 * D00 without citing a draft, the CHANGELOG is a historical record, and a
 * draft still waiting for its number keeps its placeholder.
 */
const MECHANISM_FILES = new Set([
  'docs/decisions/D48-documentation.md',
  'docs/decisions/README.md',
  'scripts/decisions-index.mjs',
  'scripts/decision-number.mjs',
  'scripts/lint.mjs',
  'CHANGELOG.md',
])

const relative = (file) => path.relative(ROOT, file).replace(/\\/g, '/')

function fail(message) {
  console.error(`decision-number: ${message}`)
  process.exit(1)
}

const entries = fs.readdirSync(DECISIONS)
const drafts = entries.filter((name) => /^D00-.*\.md$/.test(name))
const lives = entries.filter((name) => /^D\d+-.*\.md$/.test(name) && !name.startsWith('D00-'))

const asked = process.argv[2]
if (asked !== undefined && !drafts.includes(asked)) fail(`${asked} is not a draft (D00-<slug>.md) in docs/decisions/`)
if (asked === undefined && drafts.length === 0) fail('no draft (D00-<slug>.md) in docs/decisions/')
if (asked === undefined && drafts.length > 1) fail(`several drafts in flight (${drafts.join(', ')}); name the one to number`)
const draft = asked ?? drafts[0]

/** The highest number in use, live or retired; a retired number is never reused. */
const taken = lives.map((name) => Number(name.match(/^D(\d+)/)[1]))
for (const name of lives) {
  const text = fs.readFileSync(path.join(DECISIONS, name), 'utf8')
  const related = text.match(/^- \*\*关联\*\*：(.+)$/m)
  const replaced = related === null ? null : related[1].match(/取代\s*([^；;]+)/)
  if (replaced !== null) for (const number of replaced[1].matchAll(/D(\d+)/g)) taken.push(Number(number[1]))
}
const retiredFile = path.join(DECISIONS, 'retired.txt')
if (fs.existsSync(retiredFile)) {
  for (const line of fs.readFileSync(retiredFile, 'utf8').split('\n')) {
    const entry = line.trim().match(/^D(\d+)$/)
    if (entry !== null) taken.push(Number(entry[1]))
  }
}
const next = Math.max(0, ...taken) + 1

// The draft itself: title, associations and body, then the file name.
const from = path.join(DECISIONS, draft)
const text = fs.readFileSync(from, 'utf8')
const rewritten = text.replace(PLACEHOLDER, `D${next}`)
if (rewritten === text) fail(`${draft} never mentions D00 — its title should read "# D00. <标题>"`)
const toName = draft.replace(/^D00-/, `D${next}-`)
fs.writeFileSync(from, rewritten)
fs.renameSync(from, path.join(DECISIONS, toName))

// Every citation the draft's change collected: code, styles, documents and the
// pending changelog entries, except the files the sweep never reads.
const targets = [
  ...filesUnder(path.join(ROOT, 'packages'), ['.ts', '.css', '.cjs', '.js'], SKIPPED_DIRS),
  ...filesUnder(path.join(ROOT, 'scripts'), ['.mjs', '.cjs', '.js'], SKIPPED_DIRS),
  ...filesUnder(ROOT, ['.md'], SKIPPED_DIRS),
  ...filesUnder(path.join(ROOT, 'docs', 'changes'), ['.json'], SKIPPED_DIRS),
  path.join(ROOT, 'AGENTS.md'),
].filter((file, at, all) => all.indexOf(file) === at && fs.existsSync(file)
  && !MECHANISM_FILES.has(relative(file))
  && !path.basename(file).startsWith('D00-'))
const touched = []
for (const file of targets) {
  const before = fs.readFileSync(file, 'utf8')
  const after = before.replace(PLACEHOLDER, `D${next}`)
  if (after === before) continue
  fs.writeFileSync(file, after)
  touched.push(relative(file))
}

const index = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'decisions-index.mjs')], { stdio: 'inherit' })
if (index.status !== 0) process.exit(index.status ?? 1)
console.log(`decision-number: ${draft} is now D${next} (${toName}); rewrote ${touched.length} files with citations`)
for (const file of touched) console.log(`  ${file}`)
