#!/usr/bin/env node
/**
 * lint.mjs — the rules that need no build.
 *
 * The promises the repository makes in prose and a tool can check without
 * guessing: no source file crosses the stop line, every link in the committed
 * Markdown resolves, every decision a comment or a document cites exists
 * (numbers are stable and a retired one stays citable), every repository path
 * prose names exists, no feature module reaches past the handles its manifest
 * declares (D72), and no pair of files holds a copied stretch (jscpd).
 * Everything else a tool could enforce is already a build check, the type check
 * or a smoke case.
 *
 * Usage: node scripts/lint.mjs
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { filesUnder } from './shared/file-walk.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const DECISIONS = path.join(ROOT, 'docs', 'adr')
/** The stop line: a source file approaching this gets split, not extended. */
const MAX_LINES = 750
/**
 * Files already past the stop line, with the size they stood at when the rule
 * was written: they may not grow until the split lands.
 */
const OVERSIZE = {}

const problems = []

/**
 * What the walk never enters: a directory of local scratch a rule does not
 * govern. `.claude/` holds the editor's own state (gitignored), and a whole
 * second copy of every document inside one would be read as the repository's
 * own files.
 */
const SKIPPED_DIRS = new Set(['.git', '.debug', '.claude', 'node_modules'])

const relative = (file) => path.relative(ROOT, file).replace(/\\/g, '/')

/**
 * The decision numbers that exist and the ones a replacing decision retired.
 * Numbers retired without a successor sit in retired.txt, one per line; a
 * number is never reused, so this set only grows.
 */
function decisionNumbers() {
  const live = new Set()
  const retired = new Set()
  for (const name of fs.readdirSync(DECISIONS)) {
    if (!/^D\d+-.*\.md$/.test(name)) continue
    live.add(Number(name.match(/^D(\d+)/)[1]))
    const text = fs.readFileSync(path.join(DECISIONS, name), 'utf8')
    const replaced = text.match(/^- \*\*取代\*\*：(.+)$/m)
    if (replaced !== null) for (const number of replaced[1].matchAll(/D(\d+)/g)) retired.add(Number(number[1]))
  }
  const retiredFile = path.join(DECISIONS, 'retired.txt')
  if (fs.existsSync(retiredFile)) {
    fs.readFileSync(retiredFile, 'utf8').split('\n').forEach((line, at) => {
      const trimmed = line.trim()
      if (trimmed === '' || trimmed.startsWith('#')) return
      const entry = trimmed.match(/^D(\d+)$/)
      if (entry === null) { problems.push(`docs/adr/retired.txt:${at + 1}: not a bare number: ${trimmed}`); return }
      retired.add(Number(entry[1]))
    })
  }
  return { live, retired }
}

// 1. The stop line.
const sources = [
  ...filesUnder(path.join(ROOT, 'packages'), ['.ts', '.css', '.cjs', '.js'], SKIPPED_DIRS),
  ...filesUnder(path.join(ROOT, 'scripts'), ['.mjs', '.cjs', '.js'], SKIPPED_DIRS),
].filter((file) => !/\.test\.ts$/.test(file) && !/\.d\.ts$/.test(file))
for (const file of sources) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').length
  const exception = OVERSIZE[relative(file)]
  if (exception === undefined) {
    if (lines > MAX_LINES) problems.push(`${relative(file)}: ${lines} lines, over the ${MAX_LINES}-line stop line`)
  } else if (lines > exception.ceiling) {
    problems.push(`${relative(file)}: ${lines} lines, past its recorded ${exception.ceiling} (${exception.reason})`)
  }
}

// The engine's dependency direction (D73): it serves the skin and talks to the
// host, so it may read the shared contract and the host's own packages, and
// nothing of the skin it serves — no client or host module, no generated module
// carrying the skin's own vocabulary.
const ENGINE = path.join(ROOT, 'packages', 'engine', 'src')
for (const file of sources.filter((candidate) => relative(candidate).startsWith('packages/engine/src/'))) {
  const text = fs.readFileSync(file, 'utf8')
  for (const match of text.matchAll(/from '([^']+)'/g)) {
    const specifier = match[1]
    const intoSkin = specifier.startsWith('@dsh-claude-style/client')
      || specifier.startsWith('@dsh-claude-style/host')
      || specifier.startsWith('virtual:dsh-claude-style/')
      || specifier.includes('../client/')
      || specifier.includes('../host/')
    if (intoSkin) problems.push(`${relative(file)}: the engine imports ${specifier}; the skin hands what the engine needs over the seam (packages/engine/src/skin.ts, D73)`)
  }
}

// 2. Links in the committed Markdown.
const markdown = [
  ...filesUnder(ROOT, ['.md'], SKIPPED_DIRS).filter((file) => !relative(file).startsWith('.debug/') && !relative(file).startsWith('node_modules/')),
]
let links = 0
for (const file of markdown) {
  const text = fs.readFileSync(file, 'utf8')
  for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1]
    if (/^(?:https?:|mailto:|#)/.test(target)) continue
    const [clean] = target.split('#')
    if (clean === '') continue
    links += 1
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(clean))
    if (!fs.existsSync(resolved)) problems.push(`${relative(file)}: link to ${target} resolves to nothing`)
  }
}

// 3. Decision numbers cited by code and documents.
const { live, retired } = decisionNumbers()
const citing = [
  ...sources,
  ...markdown,
  path.join(ROOT, 'AGENTS.md'),
  // The licence file is prose as well, and names repository paths the same way.
  path.join(ROOT, 'LICENSE'),
].filter((file, at, all) => all.indexOf(file) === at && fs.existsSync(file))
let citations = 0
for (const file of citing) {
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, at) => {
    for (const match of line.matchAll(/(?<![\w#-])D(\d{1,3})(?![\w-])/g)) {
      const number = Number(match[1])
      citations += 1
      if (live.has(number) || retired.has(number)) continue
      problems.push(`${relative(file)}:${at + 1}: cites D${number}, which is not a decision`)
    }
  })
}

// 4. A backticked repository path in prose has to exist. Directory mentions and
// placeholder segments are out of reach; the CHANGELOG is a historical record.
// A path that starts at a feature layer names a file under packages/client/src.
const prose = citing.filter((file) => !relative(file).startsWith('CHANGELOG'))
const PROSE_PATHS = [
  { pattern: /`((?:packages|scripts|docs|tests|changes|locale)\/[^`\s]+?\.[a-z0-9]+)`/g, base: ROOT },
  { pattern: /`((?:features|core|shared|theme)\/[^`\s]+?\.[a-z0-9]+)`/g, base: path.join(ROOT, 'packages', 'client', 'src') },
]
let prosePaths = 0
for (const file of prose) {
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, at) => {
    for (const { pattern, base } of PROSE_PATHS) {
      for (const match of line.matchAll(pattern)) {
        const mention = match[1]
        if (mention.includes('<') || mention.includes('*')) continue
        prosePaths += 1
        if (!fs.existsSync(path.resolve(base, mention))) problems.push(`${relative(file)}:${at + 1}: names ${mention}, which does not exist`)
      }
    }
  })
}

// 5. A feature sees `ui` as FeatureUi of its own manifest: its handle and the
// handles the manifest `reads` (D72). The whole registry type is the entry's
// and the scheduler's; a feature module importing it would read any handle
// with nothing declared.
const featureModules = filesUnder(path.join(ROOT, 'packages', 'client', 'src', 'features'), ['.ts'], SKIPPED_DIRS).filter((file) => !/\.(test|manifest)\.ts$/.test(file))
let featureUiChecked = 0
for (const file of featureModules) {
  const text = fs.readFileSync(file, 'utf8')
  if (/\bFeatureUi\b/.test(text)) featureUiChecked += 1
  if (/^import type \{[^}]*\bUi\b[^}]*\} from '[./]+core\/scheduler'/m.test(text)) problems.push(`${relative(file)}: imports the whole ui registry type; type ui as FeatureUi<typeof manifest> and list the handles it reads in the manifest (D72)`)
}

// 6. Copied code (jscpd, scanned as .jscpd.json says): a pattern's second copy
// is where it moves into the shared layer, so any copy at all fails, and so
// does a scan that read nothing. `npx jscpd` lists every copy.
const copies = spawnSync(process.execPath, [
  path.join(ROOT, 'node_modules', 'jscpd', 'run-jscpd.js'),
  '--threshold', '0',
  '--fail-on-empty',
  '--reporters', 'console',
  '--no-colors',
], { cwd: ROOT, encoding: 'utf8' })
if (copies.status !== 0) {
  // The console report lists every copy, each followed by its two places.
  problems.push(`copied code; move the shared part into the shared layer (npx jscpd lists every copy):\n${copies.stdout}${copies.stderr}`)
}

// 7. The whole-document lookups the browser half makes outside the modules that
// own them (D9): a lookup inside a refresh pass or a frame callback costs the
// page's own size on every frame of a long conversation, and each of the
// regressions behind that cost was one such call. A query by an element's id is
// not counted: the browser answers it from its own index rather than by walking
// the tree. The sanctioned readers are the accessors and registries that cache
// their answer — packages/client/src/core/host.ts, core/bus.ts, shared/chat-dom.ts, and
// the sheet the engine's stylesheet.ts mounts itself. Every other site is recorded in
// packages/testing/document-lookups.json with the reason it is still there: a
// file's count has to match its entry, and an entry whose count reaches zero
// comes out of the file. That the record's total never rises is held against
// the base by scripts/ci-scope.mjs --ledgers.
const LOOKUP = /document\.(?:querySelectorAll|querySelector)(?:<[^>]*>)?\s*\(|document\.body\.(?:querySelectorAll|querySelector)(?:<[^>]*>)?\s*\(|removeStrayNodes\(\s*document\b/g
const LOOKUP_OWNERS = new Set([
  'packages/client/src/core/host.ts',
  'packages/engine/src/bus.ts',
  'packages/engine/src/stylesheet.ts',
  'packages/engine/src/chat-dom.ts',
])
const recordedLookups = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', 'testing', 'document-lookups.json'), 'utf8')).files
let lookups = 0
for (const file of sources) {
  if (!file.endsWith('.ts') || relative(file).includes('packages/testing/')) continue
  if (LOOKUP_OWNERS.has(relative(file))) continue
  const count = (fs.readFileSync(file, 'utf8').match(LOOKUP) ?? []).length
  lookups += count
  const entry = recordedLookups[relative(file)]
  if (count === 0) {
    if (entry !== undefined) problems.push(`packages/testing/document-lookups.json: ${relative(file)} records ${entry.count} whole-document lookups and the file has none — take the entry out`)
    continue
  }
  if (entry === undefined) {
    problems.push(`${relative(file)}: ${count} whole-document ${count === 1 ? 'lookup' : 'lookups'} with no entry in packages/testing/document-lookups.json — read the seat through core/host.ts's accessors or core/bus.ts's registry, or record it there with the reason it stays`)
    continue
  }
  if (entry.count !== count) {
    problems.push(`packages/testing/document-lookups.json: ${relative(file)} records ${entry.count} whole-document lookups and the file has ${count} — write the count down again with the reason it changed`)
  }
}
for (const file of Object.keys(recordedLookups)) {
  if (fs.existsSync(path.join(ROOT, file))) continue
  problems.push(`packages/testing/document-lookups.json: ${file} is gone from the tree — take its entry out`)
}

// 8. The bounds a check compares against, and every name a check asks for.
// packages/testing/bounds.json is where a limit on a reading lives, each with
// the reason it holds its value, so loosening one is a line in a diff rather
// than a number buried in an assertion (D66). A name nothing reads
// means the rule it guards is gone; a name something reads and the table does
// not hold fails where it is read, which is why the pass over the sources is
// part of the rule rather than a comment on the table.
const boundsFile = path.join(ROOT, 'packages', 'testing', 'bounds.json')
const readBounds = JSON.parse(fs.readFileSync(boundsFile, 'utf8'))
if (!Array.isArray(readBounds.bounds) || readBounds.bounds.length === 0) {
  problems.push('packages/testing/bounds.json: the table holds no bounds')
}
const boundNames = new Set()
for (const entry of readBounds.bounds) {
  if (typeof entry.name !== 'string' || entry.name === '') {
    problems.push('packages/testing/bounds.json: a bound has no name')
    continue
  }
  boundNames.add(entry.name)
  if (typeof entry.value !== 'number' || !Number.isFinite(entry.value)) {
    problems.push(`packages/testing/bounds.json: ${entry.name} is not a finite number`)
  }
  if (typeof entry.reason !== 'string' || entry.reason.trim().length < 40) {
    problems.push(`packages/testing/bounds.json: ${entry.name} carries no reason for its value`)
  }
}
if (boundNames.size !== readBounds.bounds.length) {
  problems.push('packages/testing/bounds.json: a name stands twice in the table')
}
const readBound = /bound\(\s*'([A-Za-z0-9_]+)'/g
const askedBounds = new Set()
let boundReads = 0
for (const file of sources) {
  if (!file.endsWith('.cjs') || !relative(file).startsWith('packages/testing/')) continue
  if (relative(file) === 'packages/testing/bounds.cjs') continue
  const text = fs.readFileSync(file, 'utf8')
  for (const match of text.matchAll(readBound)) {
    if (match[1] === 'name') continue
    askedBounds.add(match[1])
    boundReads += 1
  }
}
for (const name of askedBounds) {
  if (!boundNames.has(name)) problems.push(`packages/testing/bounds.json: ${name} is read by a check and the table does not hold it`)
}
for (const name of boundNames) {
  if (!askedBounds.has(name)) problems.push(`packages/testing/bounds.json: ${name} is in the table and no check reads it — take the entry out, or read it where its rule lives`)
}
if (boundReads === 0) problems.push('lint: no bound was read — the bounds pattern matches nothing')

// A rule whose pattern stopped matching anything would pass forever: each of the
// rules has to have looked at something.
if (featureUiChecked === 0) problems.push('lint: no feature module types ui as FeatureUi — the feature rule matches nothing')
if (links === 0) problems.push('lint: no Markdown link was examined — the link pattern matches nothing')
if (citations === 0) problems.push('lint: no decision number was examined — the citation pattern matches nothing')
if (prosePaths === 0) problems.push('lint: no repository path in prose was examined — the path pattern matches nothing')
if (lookups === 0) problems.push('lint: no whole-document lookup was counted — the lookup rule matches nothing')

if (problems.length > 0) {
  for (const problem of problems) console.error(`lint: ${problem}`)
  console.error(`lint: ${problems.length} problems in ${sources.length} sources and ${markdown.length} documents`)
  process.exitCode = 1
} else {
  console.log(`lint: ${sources.length} sources, ${markdown.length} documents, ${links} links, ${citations} decision citations, ${prosePaths} prose paths, ${lookups} recorded whole-document lookups and ${featureUiChecked} feature modules' ui clean (stop line ${MAX_LINES} lines; no copied code anywhere)`)
}
