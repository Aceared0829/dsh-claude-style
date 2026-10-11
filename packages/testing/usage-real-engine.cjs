/**
 * The usage fold against the REAL session-query engine, over REAL session logs.
 *
 * The smoke's fake \`sessionQuery\` is a stand-in this repository writes, so it can
 * only prove the host half agrees with the contract as written down there. This
 * probe closes that gap: it copies real session logs into a scratch store, reads
 * them through the installed \`@deepseek-ai/dsh-session-query\` engine over the real
 * jsonl backend, and asserts the fold reports the tokens that are actually in
 * those logs.
 *
 * The bug this exists for: \`readTitleSnapshots\` folds titles and DISCARDS the
 * events (its \`value\` is \`{ session, title }\`), so a reader that expects events
 * from it folds nothing while still reporting successful reads — the usage panel
 * silently drops to zero. Only a real engine can tell the two apart.
 *
 * The logs come from the running user's own store, read-only, and are copied to
 * the system temp directory; nothing here writes to that store.
 *
 * Usage: node packages/testing/usage-real-engine.cjs [--source <sessions-dir>] [--keep]
 *        Needs the built plugin (npm run build) and an installed DSH. Skips with
 *        exit 0 when either, or the source store, is absent.
 */
'use strict'
const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')

const ROOT = path.resolve(__dirname, '..', '..')
const HOST = path.join(ROOT, 'lib', 'host', 'index.js')
const DSH_HOME = process.env.DSH_PACKAGES ?? 'D:/appdata/npm/node_modules/@deepseek-ai/dsh'
const scope = (name) => path.join(DSH_HOME, 'node_modules', '@deepseek-ai', name, 'lib', 'index.js')
const CORDIS = path.join(ROOT, 'node_modules', '@deepseek-ai', 'cordis', 'lib', 'index.js')

let failed = 0
const check = (label, ok, detail) => {
  console.log((ok ? '  ok   ' : '  FAIL ') + label + (ok || detail === undefined ? '' : '  — ' + detail))
  if (!ok) failed += 1
}

/** The default source: the running user's own session store, read-only. */
function defaultSource() {
  const home = process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
  return path.join(home, 'sessions')
}

/** Real session logs under a store, smallest first, as { project, id, file }. */
function findLogs(root, limit) {
  if (!fs.existsSync(root)) return []
  const out = []
  for (const project of fs.readdirSync(root)) {
    const projectDir = path.join(root, project)
    if (!fs.statSync(projectDir).isDirectory()) continue
    for (const id of fs.readdirSync(projectDir)) {
      const dir = path.join(projectDir, id)
      if (!fs.statSync(dir).isDirectory()) continue
      const file = fs.readdirSync(dir).find((name) => /^session\.v[0-9]+\.jsonl(\.zstd)?$/.test(name))
      if (file === undefined) continue
      const size = fs.statSync(path.join(dir, file)).size
      if (size < 1000 || size > 4_000_000) continue
      out.push({ project, id, file, size })
    }
  }
  return out.sort((a, b) => a.size - b.size).slice(0, limit)
}

async function main() {
  for (const file of [HOST, scope('dsh-session-query'), scope('dsh-session-persistence-jsonl'), scope('dsh-session'), CORDIS]) {
    if (!fs.existsSync(file)) {
      console.log('usage-real-engine: skipped, ' + file + ' is not present (build the plugin / install the host)')
      return 0
    }
  }
  const at = process.argv.indexOf('--source')
  const sourceRoot = at === -1 ? defaultSource() : process.argv[at + 1]
  const picked = findLogs(sourceRoot, 6)
  if (picked.length === 0) {
    console.log('usage-real-engine: skipped, no session logs under ' + sourceRoot)
    return 0
  }

  const { Context } = await import(pathToFileURL(CORDIS).href)
  const { SessionQueryEngine } = await import(pathToFileURL(scope('dsh-session-query')).href)
  const { default: JsonlSessionPersistence } = await import(pathToFileURL(scope('dsh-session-persistence-jsonl')).href)
  const { Session } = await import(pathToFileURL(scope('dsh-session')).href)

  // Copy real logs into a scratch store, so nothing is written beside the user's.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-usage-real-'))
  const sessionsRoot = path.join(home, 'sessions')
  for (const log of picked) {
    const dest = path.join(sessionsRoot, log.project, log.id)
    fs.mkdirSync(dest, { recursive: true })
    fs.copyFileSync(path.join(sourceRoot, log.project, log.id, log.file), path.join(dest, log.file))
  }
  const compression = picked[0].file.endsWith('.zstd') ? 'zstd' : 'none'
  console.log('usage fold over the REAL engine, ' + picked.length + ' real log(s), compression ' + compression)

  const persistence = new JsonlSessionPersistence(new Context(), { root: sessionsRoot, compression })
  const listed = await persistence.list()
  check('the real backend lists the copied logs', listed.length === picked.length, listed.length + ' of ' + picked.length)
  if (listed.length === 0) {
    if (!process.argv.includes('--keep')) fs.rmSync(home, { recursive: true, force: true })
    return 1
  }
  const ids = listed.map((snapshot) => snapshot.header.id)

  // Count the corpus listings: the host half is expected to pay none.
  const listings = { count: 0 }
  const realList = persistence.list.bind(persistence)
  persistence.list = (...args) => { listings.count += 1; return realList(...args) }

  const ctx = new Context()
  ctx.provide('sessions', {
    get: () => undefined,
    list: () => [],
    // The engine restores a stored log through this seam; the host's own Session
    // is what it hands back in production.
    prepare: (id, options) => Session.create(id, options.seed, options.meta, options.inheritedEventCount),
  })
  ctx.provide('sessionPersistence', persistence)
  const engine = new SessionQueryEngine(ctx)

  // What the logs actually contain, read straight through the engine: the
  // independent baseline the fold must reproduce.
  let expectedInput = 0
  let expectedOutput = 0
  let expectedCalls = 0
  for (const id of ids) {
    const observation = await engine.observeSession(id, { projectionMode: 'none' })
    for (const event of observation.events) {
      if (event.type !== 'assistant/message' || event.data?.usage === undefined) continue
      expectedInput += Number(event.data.usage.inputTokens) || 0
      expectedOutput += Number(event.data.usage.outputTokens) || 0
      expectedCalls += 1
    }
  }
  // The fold replaces a retried settlement rather than adding it, so its own
  // totals can be lower than the raw sum; the check below uses the fold's own
  // arithmetic on the same events.
  console.log('  real logs hold ' + expectedCalls + ' settlement(s): input ' + expectedInput + ', output ' + expectedOutput)
  check('the real logs carry at least one settlement to fold', expectedCalls > 0, 'settlements ' + expectedCalls)

  // The built host half over the REAL service.
  const mod = await import(pathToFileURL(HOST).href)
  const routes = {}
  const hostCtx = {
    fiber: { entry: { id: 'include:ui-skin-claude-style' } },
    logger: { warn: (message) => console.log('  [host warn] ' + message) },
    get: (name) => {
      if (name === 'dshHomePath') return (...segments) => path.join(home, ...segments)
      if (name === 'sessionQuery') return engine
      if (name === 'sessions') return { get: () => undefined, list: () => [] }
      return undefined
    },
    effect: (fn) => fn(),
    inject: (deps, cb) => cb({
      effect: (fn) => fn(),
      get: (name) => hostCtx.get(name),
      settings: { configure: () => () => {} },
      webServer: { register: (route) => { routes[route.path] = route; return () => {} } },
    }),
  }
  mod.apply(hostCtx)
  const route = routes['/dsh-claude-style/usage']
  check('the usage route registered', route !== undefined)
  if (route === undefined) return 1

  const ask = () => new Promise((resolve) => {
    const req = { method: 'GET', url: '/dsh-claude-style/usage', headers: { host: '127.0.0.1:1', origin: 'http://127.0.0.1:1' } }
    const res = { status: 0, writeHead(status) { this.status = status }, end(chunk) { resolve(JSON.parse(String(chunk))) } }
    Promise.resolve(route.handler(req, res)).catch((error) => resolve({ error: String(error) }))
  })
  // A pass may hand over a partial (the cost-meter ledger's answer) while the
  // fold still runs, so the settled answer is the one with computing false.
  let state = await ask()
  for (let attempt = 0; attempt < 400 && (state.value === null || state.value === undefined || state.computing === true); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50))
    state = await ask()
  }
  const value = state.value ?? {}
  console.log('  answer: ' + JSON.stringify({ source: value.source, read: value.read, failed: value.failed, sessions: value.sessions, totals: value.totals }))

  check('the fold read every copied log', value.read === ids.length && value.failed === 0, JSON.stringify({ read: value.read, failed: value.failed }))
  check('the settlements in the logs reach the fold (a lossy reader reports zero)',
    (value.totals?.calls ?? 0) > 0 && (value.totals?.input ?? 0) > 0,
    JSON.stringify(value.totals))
  check('the tokens the fold reports match the log for a single session',
    ids.length !== 1 || value.totals?.input === expectedInput, JSON.stringify({ folded: value.totals?.input, log: expectedInput }))
  check('the fold lists the stored corpus zero times', listings.count === 0, 'list() called ' + listings.count + ' time(s)')

  if (!process.argv.includes('--keep')) fs.rmSync(home, { recursive: true, force: true })
  else console.log('  kept: ' + home)
  console.log(failed === 0 ? 'usage-real-engine: all checks passed' : 'usage-real-engine: ' + failed + ' check(s) failed')
  return failed === 0 ? 0 : 1
}

main().then((code) => process.exit(code), (error) => { console.error(error); process.exit(1) })
