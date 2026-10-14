/**
 * verify-lock.cjs — the one run at a time a shared working tree allows (D66).
 *
 * Two sessions on one tree otherwise build and drive browsers on top of each
 * other's output: a build rewrites `lib/`, and a lane reading `lib/` sees the
 * page change under it. Every entry that writes `lib/` or drives a browser
 * through it takes this lock — `scripts/build.mjs`, the smoke, the end-to-end
 * lane and the live probes — and `npm run verify` owns the run that starts the
 * gates, so a gate it starts inherits `DSH_CLAUDE_STYLE_LOCK_HELD` and takes
 * nothing. A rebuild the watcher behind `npm run dev` starts takes nothing
 * either: it happens while the reader is looking at the page, and waiting
 * minutes for a test run would freeze the loop it exists to serve.
 *
 * The lock is a directory and `owner.json` names the process holding it, so a
 * run killed outright reads as gone and its lock is taken over.
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')
const LOCK = path.join(ROOT, '.debug', 'verify.lock')
const OWNER = path.join(LOCK, 'owner.json')
/** Set on the gates of a run and on the rebuilds of the watcher. */
const HELD = 'DSH_CLAUDE_STYLE_LOCK_HELD'
const DEV = 'DSH_CLAUDE_STYLE_DEV'
/** A lock whose owner file cannot be read is given this long before it is read as a run that died taking it. */
const OWNER_GRACE_MS = 60_000
/** How often a waiting request looks at the lock again. */
const WAIT_POLL_MS = 2_000
/** How often a waiting request says it is still waiting. */
const WAIT_SAY_MS = 30_000

const say = (line) => process.stdout.write(`${line}\n`)

/**
 * Whether a pid is still alive. The operating system answers this by throwing
 * rather than by returning: `ESRCH` means the process is gone, `EPERM` that it
 * exists and belongs to somebody else.
 */
function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

/**
 * What the lock says right now.
 * @returns `{ kind: 'free' }`, `{ kind: 'held', owner }` or `{ kind: 'stale', note }`.
 */
function lockState() {
  const stat = fs.statSync(LOCK, { throwIfNoEntry: false })
  if (stat === undefined) return { kind: 'free' }
  if (fs.existsSync(OWNER)) {
    let owner = null
    // The file is read and parsed in one step: it is written whole, so what
    // fails here is a reader that raced a run taking the lock, not a state.
    try {
      owner = JSON.parse(fs.readFileSync(OWNER, 'utf8'))
    } catch {
      owner = null
    }
    if (owner !== null && Number.isInteger(owner.pid)) {
      return alive(owner.pid) ? { kind: 'held', owner } : { kind: 'stale', note: `pid ${owner.pid} is gone` }
    }
  }
  const age = Date.now() - stat.mtimeMs
  return age > OWNER_GRACE_MS
    ? { kind: 'stale', note: `no owner file after ${Math.round(age / 1000)} s` }
    : { kind: 'held', owner: null }
}

/** Hold the lock, waiting out any run in flight, and return the release. */
async function takeLock(label, runId) {
  let announced = 0
  for (;;) {
    try {
      // The lock directory is the lock, and it lives under `.debug/`, which a
      // fresh checkout does not have yet: create that parent first, so the
      // mkdir below answers EEXIST for a lock in flight instead of ENOENT for
      // a missing parent.
      fs.mkdirSync(path.dirname(LOCK), { recursive: true })
      fs.mkdirSync(LOCK)
      fs.writeFileSync(OWNER, `${JSON.stringify({ pid: process.pid, at: new Date().toISOString(), label, runId }, null, 2)}\n`)
      return () => fs.rmSync(LOCK, { recursive: true, force: true })
    } catch (error) {
      // The lock directory is the lock: another run holds it.
      if (error.code !== 'EEXIST') throw error
    }
    const state = lockState()
    if (state.kind === 'stale') {
      say(`${label}: taking the lock from a run that left it behind — ${state.note}`)
      fs.rmSync(LOCK, { recursive: true, force: true })
      continue
    }
    const owner = state.owner
    if (announced === 0 || Date.now() - announced >= WAIT_SAY_MS) {
      announced = Date.now()
      say(owner === null
        ? `${label}: a run is taking the lock; waiting for it`
        : `${label}: waiting for the run in flight — pid ${owner.pid}, started ${owner.at}, ${owner.runId}`)
    }
    await new Promise((resolve) => { setTimeout(resolve, WAIT_POLL_MS) })
  }
}

/**
 * Run `body` under the lock, releasing it however `body` ends. A gate of a run
 * and a rebuild behind the watcher go straight through: the lock is already
 * held above them.
 */
async function withLock(label, runId, body) {
  if (process.env[HELD] === LOCK || process.env[DEV] === '1') return await body()
  const release = await takeLock(label, runId)
  process.env[HELD] = LOCK
  try {
    return await body()
  } finally {
    release()
    delete process.env[HELD]
  }
}

module.exports = { LOCK, HELD, DEV, lockState, takeLock, withLock }
