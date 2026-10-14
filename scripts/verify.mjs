#!/usr/bin/env node
/**
 * verify.mjs — the one entry a test run goes through (D66).
 *
 * Parallel sessions share this working tree, and each of them reaching for a
 * runner of its own is what made the machine run the same build and the same
 * browser several times over. This file is the only place the gates are
 * started; a session asks it and reads its answer.
 *
 *   one entry  the build, the unit tests, the smoke and the end-to-end lane,
 *              in the order they depend on each other, from one command.
 *   serial     `.debug/verify.lock/` holds one run at a time. A request that
 *              arrives during a run waits for it rather than starting a second
 *              browser, and asks for its own key again when the lock is free.
 *   reuse      a run records its verdict under the hash of the tree it read and
 *              the gates it ran. A later request for the same pair reads that
 *              record instead of starting anything, and says it did.
 *
 * A verdict in the cache is one a run produced. A request whose gates were
 * never run — another tier, a narrower selection, one file changed — is another
 * key and runs; `--force` re-runs a key that has an answer.
 *
 * Usage: node scripts/verify.mjs [--quick] [--no-e2e] [--force]
 *        [--case <name>[,<name>…]] [--feature <dir>[,<dir>…]]
 *        [--scenario <name>[,<name>…]]
 *        --quick is the iteration tier: the smoke's quick tier and no
 *        end-to-end lane (it is the minutes-long part, and the lane has no
 *        per-feature selection to narrow it with). --case and --feature reach
 *        the smoke as they do on its own command line; --scenario reaches the
 *        end-to-end lane.
 */
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { filesUnder } from './shared/file-walk.mjs'
import { HELD, LOCK, takeLock } from './shared/verify-lock.cjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const CACHE = path.join(ROOT, '.debug', 'verify-cache')
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
const FLAGS = new Set(['quick', 'no-e2e', 'force', 'case', 'feature', 'scenario'])

/** The run in flight, so an interrupt can take it down with this process. */
let running = null

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
  const quick = args.includes('--quick')
  const scenarios = sorted(values.scenario)
  if (quick && scenarios.length > 0) bad('--quick leaves the end-to-end lane out; drop --scenario or drop --quick')
  return {
    quick,
    force: args.includes('--force'),
    cases: sorted(values.case),
    features: sorted(values.feature),
    scenarios,
    e2e: !quick && !args.includes('--no-e2e'),
  }
}

/** The gates this request runs, in the order each depends on the one before it. */
function gatesFor(request) {
  const smoke = []
  if (request.quick) smoke.push('--quick')
  if (request.cases.length > 0) smoke.push('--case', request.cases.join(','))
  if (request.features.length > 0) smoke.push('--feature', request.features.join(','))
  const gates = [
    { id: 'build', script: 'scripts/build.mjs', args: [] },
    { id: 'unit', script: 'node_modules/vitest/vitest.mjs', args: ['run'] },
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
  for (const gate of gatesFor(request)) {
    say(`\nverify: ${gate.id} — node ${gate.script}${gate.args.length === 0 ? '' : ` ${gate.args.join(' ')}`}`)
    const at = Date.now()
    const code = await runGate(gate)
    gates.push({ id: gate.id, code, ms: Date.now() - at })
    say(`verify: ${gate.id} ${code === 0 ? 'ok' : `exit ${code}`} (${seconds(Date.now() - at)})`)
    // A failed gate ends the run: the lanes after it read what it produces, and
    // the fix comes before their minutes are spent.
    if (code !== 0) {
      exitCode = 1
      break
    }
  }
  const record = {
    format: FORMAT,
    key,
    tree: tree.hash,
    files: tree.files,
    request,
    runId,
    at: new Date().toISOString(),
    ms: Date.now() - started,
    exitCode,
    gates,
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
  say(`\nverify: ${record.exitCode === 0 ? 'PASS' : 'FAIL'} — ${gates} (${seconds(record.ms)}); verdict filed as ${record.key.slice(0, 12)}`)
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
  const release = await takeLock('verify', key.slice(0, 12))
  // The gates run under this lock: they must not ask for it again.
  process.env[HELD] = LOCK
  let record
  try {
    // The run this request waited for may have answered this very key.
    record = (request.force ? null : cached(key)) ?? await runAll(request, tree, key)
  } finally {
    release()
    delete process.env[HELD]
  }
  report(record, 'run')
  process.exit(record.exitCode)
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (running !== null) running.kill(signal)
    fs.rmSync(LOCK, { recursive: true, force: true })
    say(`verify: interrupted (${signal})`)
    process.exit(signal === 'SIGINT' ? 130 : 143)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
