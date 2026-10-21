#!/usr/bin/env node
/**
 * verify.mjs — the one entry a test run goes through (D77).
 *
 * Parallel sessions share this working tree, and each of them reaching for a
 * runner of its own is what made the machine run the same build and the same
 * browser several times over. This file is the only place the gates are
 * started; a session asks it and reads its answer.
 *
 *   one entry  the checks, the build, the logic and mechanism specs, the
 *              smoke, the behaviour specs and the end-to-end lane, from one
 *              command.
 *   staged     a gate starts as soon as what it reads exists: the checks, the
 *              build and the spec lane answer about the sources and run
 *              together, and the browser lanes read the build's output and
 *              run together once it is written. What the run costs is the
 *              slowest gate of each stage rather than their sum.
 *   serial     `.debug/verify.lock/` holds one run at a time. A request that
 *              arrives during a run waits for it rather than starting a second
 *              browser, and asks for its own key again when the lock is free.
 *   reuse      a run records its verdict under the hash of the tree it read and
 *              the gates it ran. A later request for the same pair reads that
 *              record instead of starting anything, and says it did.
 *   honest     the build output the browser gates read is hashed when the build
 *              gate ends and again when the run ends: a rebuild behind
 *              `npm run dev` takes no lock, so it can swap the page under the
 *              gates, and a run that saw two different outputs files no verdict.
 *
 * A verdict in the cache is one a run produced. A request whose gates were
 * never run — another tier, a narrower selection, one file changed — is another
 * key and runs; `--force` re-runs a key that has an answer.
 *
 * Usage: node scripts/verify.mjs [--quick] [--e2e] [--scenario <name>[,<name>…]]
 *        [--case <name>[,<name>…]] [--feature <dir>[,<dir>…]] [--full]
 *        [--no-e2e] [--force] [--help]
 *        A bare run is the iteration tier: the checks, the build and the tests
 *        the working tree's change reaches, at once, and nothing that starts a
 *        browser. --quick adds the smoke's quick tier (its motion cases left
 *        out) and every behaviour spec, --case and --feature name the smoke's
 *        cases as they do on its own command line (naming them runs the motion
 *        cases too) and --feature the behaviour specs of those directories,
 *        --full walks the whole smoke and every behaviour spec, and --e2e and
 *        --scenario add the end-to-end lane.
 *        --no-e2e leaves the lane out of either. A request for the whole smoke
 *        and the lane's default table together prints `请确认你正处于发布流程。`
 *        before its gates start: that pair is the cloud's release gate.
 *        --help prints this block and stops.
 */
import { execFileSync, spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { filesUnder } from './shared/file-walk.mjs'
import { changedPaths } from './shared/changed-paths.mjs'
import { SKIPPED, TREES, treeHash } from './shared/tree-hash.mjs'
import { HELD, LOCK, takeLock } from './shared/verify-lock.mjs'

const require = createRequire(import.meta.url)
const { UNJUDGED_EXIT } = require('../packages/testing/host-version.mjs')
const ROOT = path.resolve(import.meta.dirname, '..')
const CACHE = path.join(ROOT, '.debug', 'verify-cache')
/**
 * Vitest's own entry, resolved from the installed package: a nested copy of
 * vitest answers the same way the hoisted one does.
 */
const VITEST = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs')
/** Bumped when a recorded verdict stops meaning what this file reads it as. */
const FORMAT = 1
/** The flags a request may carry, without their dashes; the three name-taking ones carry values. */
const FLAGS = new Set(['quick', 'full', 'e2e', 'no-e2e', 'force', 'case', 'feature', 'scenario'])

/** The gates in flight, so an interrupt can take them down with this process. */
const running = new Set()
/** The release of the lock this process holds, or null while it holds none. */
let holding = null

const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`
const say = (line) => process.stdout.write(`${line}\n`)

/** End the run over a request that cannot be honoured, before any gate starts. */
function bad(message) {
  console.error(`verify: ${message}`)
  process.exit(2)
}

/** The directories the spec lane reads: what a change under them can reach a spec through. */
const UNIT_SOURCES = ['packages/client/src', 'packages/contracts/src', 'packages/engine/src', 'packages/testing/specs']

/**
 * The spec gate of a request (the logic and mechanism layers, D77): the whole
 * lane, or — for the iteration tier — the specs the working tree's change reaches, which is what makes that tier answer
 * in seconds while a session is editing. A tree with no change under the
 * sources runs the lane whole: a bare request on a still tree still answers for
 * every test.
 */
function unitGate(iteration) {
  if (!iteration) return { id: 'unit', script: VITEST, args: ['run'] }
  const changed = changedPaths(...UNIT_SOURCES)
  if (changed.length === 0) return { id: 'unit', script: VITEST, args: ['run'] }
  return { id: 'unit', script: VITEST, args: ['related', ...changed] }
}

/**
 * The bytes of the build output the browser gates read, or null before the
 * build has written any. The rebuilds behind `npm run dev` go straight through
 * the lock on purpose, so this is what tells a run whether the page it drove is
 * still the page its build produced.
 */
function libHash() {
  const digest = crypto.createHash('sha256')
  const lib = path.join(ROOT, 'lib')
  // An empty extension matches every name, which is what hashing the output wants.
  const files = filesUnder(lib, [''], SKIPPED).map((file) => path.relative(lib, file).replace(/\\/g, '/')).sort()
  if (files.length === 0) return null
  for (const file of files) {
    digest.update(file)
    digest.update('\0')
    digest.update(crypto.createHash('sha256').update(fs.readFileSync(path.join(lib, file))).digest())
  }
  return digest.digest('hex')
}

/**
 * The usage text, read off this file's own header: everything from the `Usage:`
 * line on, so the header stays its one home.
 */
function usage() {
  const header = fs.readFileSync(new URL(import.meta.url), 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[1]
  const lines = header.split('\n').map((line) => line.replace(/^\s*\*?\s?/, ''))
  return lines.slice(lines.findIndex((line) => line.startsWith('Usage:'))).join('\n').trimEnd()
}

/** One request's own flags, read off this process's command line. */
function parseRequest() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    say(usage())
    process.exit(0)
  }
  const values = { case: [], feature: [], scenario: [] }
  for (let at = 0; at < args.length; at += 1) {
    const arg = args[at]
    const split = arg.indexOf('=')
    const flag = (split === -1 ? arg : arg.slice(0, split)).replace(/^--/, '')
    if (!arg.startsWith('--') || !FLAGS.has(flag)) bad(`unknown argument "${arg}"`)
    if (values[flag] === undefined) {
      if (split !== -1) bad(`--${flag} takes no value`)
      continue
    }
    let value
    if (split === -1) {
      at += 1
      value = args[at]
    } else {
      value = arg.slice(split + 1)
    }
    if (value === undefined || value.trim() === '' || value.startsWith('--')) bad(`--${flag} needs a name`)
    values[flag].push(...value.split(',').map((name) => name.trim()).filter(Boolean))
  }
  const sorted = (names) => [...new Set(names)].sort()
  const cases = sorted(values.case)
  const features = sorted(values.feature)
  const scenarios = sorted(values.scenario)
  const full = args.includes('--full')
  const askLane = args.includes('--e2e')
  const noLane = args.includes('--no-e2e')
  const named = cases.length + features.length + scenarios.length > 0
  // The two ways to spend minutes are named and never inherited: a bare request
  // is the stretch before a push, and each of these is asked for by name.
  if (full && named) bad('--full walks the whole smoke and the lane\'s every scenario; drop the names')
  if (askLane && noLane) bad('--e2e and --no-e2e say opposite things; keep one')
  if (args.includes('--quick') && (full || askLane || scenarios.length > 0)) {
    bad('--quick is the smoke\'s quick tier on its own; --e2e, --scenario and --full name the longer walks')
  }
  // The iteration tier is the bare request: the checks, the build and the tests
  // the change reaches, with no browser at all. Everything else runs the smoke,
  // and the whole walk is asked for by name.
  const iteration = !full && !args.includes('--quick') && !askLane && !noLane
    && cases.length === 0 && features.length === 0 && scenarios.length === 0
  return {
    // The smoke's walk: the whole walk under --full, the named cases or features
    // when the request names them, the quick tier otherwise.
    smoke: iteration ? null
      : full ? []
        : cases.length + features.length > 0
          ? [...(cases.length > 0 ? ['--case', cases.join(',')] : []), ...(features.length > 0 ? ['--feature', features.join(',')] : [])]
          : ['--quick'],
    iteration,
    force: args.includes('--force'),
    cases,
    features,
    scenarios,
    // The lane is named: `--full` is the whole smoke walk, and the release gate
    // is that walk with the lane beside it (`--full --e2e`).
    e2e: !noLane && (askLane || scenarios.length > 0),
  }
}

/**
 * Whether a request walks everything the tool holds: the whole smoke and the
 * end-to-end lane's default table. That pair is the cloud's release gate, so a
 * request for it is asked to say what it is before the minutes start.
 */
function walksEverything(request) {
  return request.smoke !== null && request.smoke.length === 0
    && request.e2e
    && request.scenarios.length === 0
}

function gatesFor(request) {
  const gates = [
    // The cloud's fast tier starts with the checks that need no build, so the
    // same set answers here and a document mistake fails in seconds.
    { id: 'lint', script: 'scripts/lint.mjs', args: [] },
    { id: 'docs', script: 'scripts/decisions-index.mjs', args: ['--check'] },
    { id: 'changelog', script: 'scripts/changelog.mjs', args: ['--check'] },
    { id: 'agents', script: 'scripts/agents-commands.mjs', args: ['--check'] },
    { id: 'numbers', script: 'packages/testing/check-numbers.mjs', args: ['--check'] },
    // The rule that the appearance snapshot only moves with what draws or reads
    // the pages (D77), and the records that only shrink, against HEAD.
    { id: 'scope', script: 'scripts/ci-scope.mjs', args: ['--appearance', '--ledgers', '--tree'] },
    { id: 'build', script: 'scripts/build.mjs', args: [] },
    unitGate(request.iteration),
  ]
  if (request.smoke !== null) gates.push({ id: 'smoke', script: 'packages/testing/smoke.mjs', args: request.smoke })
  // The behaviour specs ride with the smoke: they read the same build and the
  // same stand-in host. A request naming smoke cases alone names no spec.
  if (request.smoke !== null && !(request.cases.length > 0 && request.features.length === 0)) {
    gates.push({ id: 'behaviour', script: 'packages/testing/behaviour.mjs', args: request.features.length > 0 ? ['--feature', request.features.join(',')] : [] })
  }
  if (request.e2e) {
    gates.push({
      id: 'e2e',
      script: 'packages/testing/e2e.mjs',
      args: request.scenarios.length > 0 ? ['--scenario', request.scenarios.join(',')] : [],
    })
  }
  return gates
}

/**
 * Those gates grouped by what waits for what. The checks and the build stand
 * first: the build writes what the browser lanes read, and the checks answer in
 * moments. The spec lane answers about the sources and waits for nothing, so it
 * runs beside the behaviour specs; the smoke and the end-to-end lane come last,
 * on their own, because their checks that watch frames and passes are what a
 * loaded machine disturbs, and the behaviour specs' pages beside them load it.
 * Each stage costs its slowest gate instead of the sum of its gates.
 */
function stagesFor(request) {
  const gates = gatesFor(request)
  const framed = gates.filter((gate) => gate.id === 'smoke' || gate.id === 'e2e')
  const before = gates.filter((gate) => gate.id === 'unit' || gate.id === 'behaviour')
  if (framed.length === 0 && !before.some((gate) => gate.id === 'behaviour')) return [gates]
  const first = gates.filter((gate) => framed.indexOf(gate) === -1 && before.indexOf(gate) === -1)
  return [first, before, framed].filter((stage) => stage.length > 0)
}

/** The key a verdict is filed under: this tree, these gates. */
function keyOf(tree, request) {
  const gates = gatesFor(request).map((gate) => `${gate.id} ${gate.args.join(' ')}`)
  return crypto.createHash('sha256').update(JSON.stringify({ format: FORMAT, tree, gates })).digest('hex')
}

/** The verdict filed under a key, or null where none is. */
function cached(key) {
  const file = path.join(CACHE, `${key}.json`)
  if (!fs.existsSync(file)) return null
  const record = JSON.parse(fs.readFileSync(file, 'utf8'))
  return record.format === FORMAT ? record : null
}

/** Run one gate with its output on this terminal, and answer with its exit code. */
function runGate(gate) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [gate.script, ...gate.args], { cwd: ROOT, stdio: 'inherit' })
    running.add(child)
    child.on('error', reject)
    child.on('close', (code) => {
      running.delete(child)
      resolve(code ?? 1)
    })
  })
}

/**
 * Run the gates of one stage beside each other. The gates of a stage read what
 * the stages before them wrote and nothing the stage itself produces, so what
 * the stage costs is its slowest gate.
 */
async function runStage(stage) {
  say(`\nverify: ${stage.length === 1 ? stage[0].id : `${stage.map((gate) => gate.id).join(', ')} together`}`)
  for (const gate of stage) say(`verify:   ${gate.id} — node ${gate.script}${gate.args.length === 0 ? '' : ` ${gate.args.join(' ')}`}`)
  return Promise.all(stage.map(async (gate) => {
    const at = Date.now()
    const code = await runGate(gate)
    const ms = Date.now() - at
    say(`verify: ${gate.id} ${code === 0 ? 'ok' : code === UNJUDGED_EXIT ? 'gave no verdict' : `exit ${code}`} (${seconds(ms)})`)
    return { id: gate.id, code, ms }
  }))
}

/** Run every gate of this request, file the verdict, and return the record. */
async function runAll(request, tree, key) {
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`
  say(`verify: run ${runId}`)
  const started = Date.now()
  const gates = []
  let exitCode = 0
  /** The build output the build gate left behind; null before that gate runs. */
  let built = null
  for (const stage of stagesFor(request)) {
    gates.push(...await runStage(stage))
    if (stage.some((gate) => gate.id === 'build')) built = libHash()
    if (gates.some((gate) => gate.code !== 0)) {
      // A failed gate ends the run before the next stage: the lanes above it read
      // what it produces, and the fix comes before their minutes are spent. A gate
      // that gave no verdict (a host other than the pinned one) is not a failure
      // and not a pass, so the run answers "unjudged" unless another gate failed.
      exitCode = gates.some((gate) => gate.code !== 0 && gate.code !== UNJUDGED_EXIT) ? 1 : UNJUDGED_EXIT
      break
    }
  }
  const swapped = exitCode === 0 && libHash() !== built
  const record = {
    format: FORMAT,
    key,
    tree: tree.hash,
    files: tree.files,
    request,
    runId,
    at: new Date().toISOString(),
    ms: Date.now() - started,
    exitCode: swapped ? 1 : exitCode,
    // A run that left a gate unjudged answers nothing a later request could reuse.
    filed: !swapped && exitCode !== UNJUDGED_EXIT,
    gates,
  }
  if (swapped) {
    say('verify: the build output changed while the gates ran — a rebuild behind `npm run dev` takes no lock; no verdict filed, re-run over a still tree')
    return record
  }
  if (exitCode === UNJUDGED_EXIT) return record
  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(path.join(CACHE, `${key}.json`), `${JSON.stringify(record, null, 2)}\n`)
  return record
}

/** What this request's answer was, and where it came from. */
function report(record, source) {
  const gates = record.gates.map((gate) => `${gate.id} ${gate.code === 0 ? 'ok' : gate.code === UNJUDGED_EXIT ? 'gave no verdict' : `exit ${gate.code}`}`).join(', ')
  if (source === 'cache') {
    say(`verify: reused — the same tree and the same gates ${record.exitCode === 0 ? 'passed' : 'failed'} at ${record.at} (run ${record.runId}, ${seconds(record.ms)}); --force re-runs them`)
    say(`verify: ${record.exitCode === 0 ? 'PASS' : 'FAIL'} — ${gates}`)
    return
  }
  const filed = record.filed === false ? '; no verdict filed' : `; verdict filed as ${record.key.slice(0, 12)}`
  const word = record.exitCode === 0 ? 'PASS' : record.exitCode === UNJUDGED_EXIT ? 'UNJUDGED' : 'FAIL'
  say(`\nverify: ${word} — ${gates} (${seconds(record.ms)})${filed}`)
}

async function main() {
  const request = parseRequest()
  const tree = treeHash(ROOT)
  const key = keyOf(tree.hash, request)
  say(`verify: tree ${tree.hash.slice(0, 12)} (${tree.files} files under ${TREES.join(', ')} and the root), gates ${gatesFor(request).map((gate) => gate.id).join(', ')}`)
  const before = request.force ? null : cached(key)
  if (before !== null) {
    report(before, 'cache')
    process.exit(before.exitCode)
  }
  // A verdict already filed answers in a moment and says nothing; a run that is
  // about to spend the release gate's minutes asks before it starts.
  if (walksEverything(request)) say('verify: warning — 请确认你正处于发布流程。')
  const release = await takeLock('verify', key.slice(0, 12))
  holding = release
  // The gates run under this lock: they must not ask for it again.
  process.env[HELD] = LOCK
  let record
  try {
    // The run this request waited for may have answered this very key.
    record = (request.force ? null : cached(key)) ?? await runAll(request, tree, key)
  } finally {
    release()
    holding = null
    delete process.env[HELD]
  }
  report(record, 'run')
  process.exit(record.exitCode)
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const child of running) child.kill(signal)
    // Only the lock this process holds is released: a request still waiting for
    // the lock must leave the run it is waiting for alone.
    if (holding !== null) holding()
    say(`verify: interrupted (${signal})`)
    process.exit(signal === 'SIGINT' ? 130 : 143)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
