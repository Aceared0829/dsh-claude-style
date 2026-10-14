#!/usr/bin/env node
/**
 * verify.mjs — the one entry a test run goes through (D66).
 *
 * Parallel sessions share this working tree, and each of them reaching for a
 * runner of its own is what made the machine run the same build and the same
 * browser several times over. This file is the only place the gates are
 * started; a session asks it and reads its answer.
 *
 *   one entry  the checks, the build, the unit tests, the smoke and the
 *              end-to-end lane, in the order they depend on each other, from
 *              one command.
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
 *        [--no-e2e] [--force]
 *        A bare run is the stretch before a push: the checks, the build, the
 *        unit tests and the smoke's quick tier, with no end-to-end lane. The
 *        full smoke walk and the lane are the minutes-long parts, so a run
 *        takes them when they are what the push needs judged: --case and
 *        --feature name the smoke's cases as they do on its own command line
 *        (naming them drops the quick tier, which leaves the motion cases
 *        out), --e2e and --scenario add the lane, --full walks the whole smoke
 *        and the lane's default table, and --no-e2e leaves the lane out of
 *        either. A request for everything the tool holds prints
 *        `请确认你正处于发布流程。` before its gates start: the whole smoke and
 *        the lane's default table are the cloud's release gate.
 */
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { filesUnder } from './shared/file-walk.mjs'
import { HELD, LOCK, takeLock } from './shared/verify-lock.cjs'

const require = createRequire(import.meta.url)
const ROOT = path.resolve(import.meta.dirname, '..')
const CACHE = path.join(ROOT, '.debug', 'verify-cache')
/**
 * Vitest's own entry, resolved from the installed package: a nested copy of
 * vitest answers the same way the hoisted one does.
 */
const VITEST = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs')
/** Bumped when a recorded verdict stops meaning what this file reads it as. */
const FORMAT = 1
/**
 * The directories whose bytes decide a verdict. `lib/` is the build's own
 * output and `.debug/` is what the runs write, so neither is an input.
 */
const TREES = ['packages', 'scripts', 'locale', 'docs']
/** What no walk enters: the build output, the local scratch and the worktrees under `.claude/`. */
const SKIPPED = new Set(['.git', '.debug', '.claude', 'node_modules', 'lib'])
/** The flags a request may carry, without their dashes; the three name-taking ones carry values. */
const FLAGS = new Set(['quick', 'full', 'e2e', 'no-e2e', 'force', 'case', 'feature', 'scenario'])

/** The run in flight, so an interrupt can take it down with this process. */
let running = null
/** The release of the lock this process holds, or null while it holds none. */
let holding = null

const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`
const say = (line) => process.stdout.write(`${line}\n`)

/** End the run over a request that cannot be honoured, before any gate starts. */
function bad(message) {
  console.error(`verify: ${message}`)
  process.exit(2)
}

/**
 * Every file a gate can read, as root-relative paths in one fixed order: the
 * directories above, and the files at the root that hold the scripts, the
 * lockfile and the configuration they read.
 */
function treeFiles() {
  const files = []
  // An empty extension matches every name, which is what hashing the tree wants.
  for (const dir of TREES) files.push(...filesUnder(path.join(ROOT, dir), [''], SKIPPED))
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (entry.isFile()) files.push(path.join(ROOT, entry.name))
  }
  return files.map((file) => path.relative(ROOT, file).replace(/\\/g, '/')).sort()
}

/** The hash of the tree a verdict belongs to: each file's own path and content hash. */
function treeHash() {
  const files = treeFiles()
  const digest = crypto.createHash('sha256')
  for (const file of files) {
    digest.update(file)
    digest.update('\0')
    digest.update(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest())
  }
  return { hash: digest.digest('hex'), files: files.length }
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

/** One request's own flags, read off this process's command line. */
function parseRequest() {
  const args = process.argv.slice(2)
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
  return {
    // The smoke's quick tier unless the request names cases or features (a motion
    // case is not in the quick tier) or asks for the whole smoke.
    quick: args.includes('--quick') || (!full && cases.length === 0 && features.length === 0),
    force: args.includes('--force'),
    cases,
    features,
    scenarios,
    e2e: !noLane && (full || askLane || scenarios.length > 0),
  }
}

/**
 * Whether a request walks everything the tool holds: the whole smoke and the
 * end-to-end lane's default table. That pair is the cloud's release gate, so a
 * request for it is asked to say what it is before the minutes start.
 */
function walksEverything(request) {
  return !request.quick
    && request.cases.length === 0
    && request.features.length === 0
    && request.e2e
    && request.scenarios.length === 0
}

/** The gates this request runs, in the order each depends on the one before it. */
function gatesFor(request) {
  const smoke = []
  if (request.quick) smoke.push('--quick')
  if (request.cases.length > 0) smoke.push('--case', request.cases.join(','))
  if (request.features.length > 0) smoke.push('--feature', request.features.join(','))
  const gates = [
    // The cloud's fast tier starts with the checks that need no build, so the
    // same set answers here and a document mistake fails in seconds.
    { id: 'lint', script: 'scripts/lint.mjs', args: [] },
    { id: 'features', script: 'scripts/features.mjs', args: ['--check'] },
    { id: 'docs', script: 'scripts/decisions-index.mjs', args: ['--check'] },
    { id: 'changelog', script: 'scripts/changelog.mjs', args: ['--check'] },
    { id: 'agents', script: 'scripts/agents-commands.mjs', args: ['--check'] },
    { id: 'build', script: 'scripts/build.mjs', args: [] },
    { id: 'unit', script: VITEST, args: ['run'] },
    { id: 'smoke', script: 'packages/testing/smoke.cjs', args: smoke },
  ]
  if (request.e2e) {
    gates.push({
      id: 'e2e',
      script: 'packages/testing/e2e.cjs',
      args: request.scenarios.length > 0 ? ['--scenario', request.scenarios.join(',')] : [],
    })
  }
  return gates
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
    running = child
    child.on('error', reject)
    child.on('close', (code) => {
      running = null
      resolve(code ?? 1)
    })
  })
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
  for (const gate of gatesFor(request)) {
    say(`\nverify: ${gate.id} — node ${gate.script}${gate.args.length === 0 ? '' : ` ${gate.args.join(' ')}`}`)
    const at = Date.now()
    const code = await runGate(gate)
    gates.push({ id: gate.id, code, ms: Date.now() - at })
    say(`verify: ${gate.id} ${code === 0 ? 'ok' : `exit ${code}`} (${seconds(Date.now() - at)})`)
    if (code !== 0) {
      // A failed gate ends the run: the lanes after it read what it produces, and
      // the fix comes before their minutes are spent.
      exitCode = 1
      break
    }
    if (gate.id === 'build') built = libHash()
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
    filed: !swapped,
    gates,
  }
  if (swapped) {
    say('verify: the build output changed while the gates ran — a rebuild behind `npm run dev` takes no lock; no verdict filed, re-run over a still tree')
    return record
  }
  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(path.join(CACHE, `${key}.json`), `${JSON.stringify(record, null, 2)}\n`)
  return record
}

/** What this request's answer was, and where it came from. */
function report(record, source) {
  const gates = record.gates.map((gate) => `${gate.id} ${gate.code === 0 ? 'ok' : `exit ${gate.code}`}`).join(', ')
  if (source === 'cache') {
    say(`verify: reused — the same tree and the same gates ${record.exitCode === 0 ? 'passed' : 'failed'} at ${record.at} (run ${record.runId}, ${seconds(record.ms)}); --force re-runs them`)
    say(`verify: ${record.exitCode === 0 ? 'PASS' : 'FAIL'} — ${gates}`)
    return
  }
  const filed = record.filed === false ? '; no verdict filed' : `; verdict filed as ${record.key.slice(0, 12)}`
  say(`\nverify: ${record.exitCode === 0 ? 'PASS' : 'FAIL'} — ${gates} (${seconds(record.ms)})${filed}`)
}

async function main() {
  const request = parseRequest()
  const tree = treeHash()
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
    if (running !== null) running.kill(signal)
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
