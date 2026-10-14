#!/usr/bin/env node
/**
 * session.mjs — one session's own working tree, from open to close.
 *
 * Parallel sessions sharing the main tree is where mixed edits, queued test
 * locks and verdicts over somebody else's half-finished change come from.
 * This script opens a session worktree on its own `session/` branch with a
 * junction onto the main tree's `node_modules/` — a private tree whose
 * one-time cost is a junction rather than a reinstall, with its own verify
 * lock, verdict cache and cloud runs.
 *
 *   node scripts/session.mjs start <name> [--deps]   open `.claude/worktrees/<name>`
 *                                                    on branch `session/<name>` and
 *                                                    junction its `node_modules/`
 *   node scripts/session.mjs status                  which tree this is, which
 *                                                    session trees are still open
 *   node scripts/session.mjs finish [--no-push]      push this session's branch,
 *                                                    replacing what it pushed
 *                                                    before a rebase; the cloud
 *                                                    judges it
 *   node scripts/session.mjs sweep                   remove worktrees left by a
 *                                                    session that is gone: no
 *                                                    live owner, no uncommitted
 *                                                    change, nothing unpushed
 *
 * `start` and `sweep` run from the main tree; `finish` runs from inside the
 * session worktree. A session worktree never runs `npm install` or `npm ci`:
 * through the junction either one would delete the main tree's real
 * directory. `start` refuses when the lock file differs between the trees —
 * the junction would serve dependencies the session's sources do not match —
 * and `--deps` is the explicit override for the session whose task is the
 * lock file change itself.
 */
import fs from 'node:fs'
import path from 'node:path'
import { runner } from './shared/run.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const CWD = process.cwd()

/** Run git in `cwd` (the main tree by default) and return stdout. */
const git = (args, cwd = ROOT) => runner(cwd)('git', args)

/** End over a request this script cannot honour. */
function bad(message) {
  console.error(`session: ${message}`)
  process.exit(2)
}

/**
 * One spelling for a path compared against another: git's porcelain speaks
 * forward slashes, Node's path.resolve answers with the platform's, and only
 * the case-folded native form makes the two comparable.
 */
function canonical(value) {
  return path.resolve(value).toLowerCase()
}

/** Whether `body` runs to completion, read off git's exit code. */
function trying(body) {
  try {
    body()
    return true
  } catch {
    return false
  }
}

/** Whether a revision names something in this repository. */
function exists(ref) {
  return trying(() => git(['rev-parse', '--verify', '--quiet', ref]))
}

/** The commits `from..to` holds, one `<hash> <title>` per line; '' for none. */
function between(from, to, cwd = ROOT) {
  if (!exists(from) || !exists(to)) return ''
  return runner(cwd)('git', ['log', '--format=%h %s', `${from}..${to}`])
}

/**
 * The commits the tree at `cwd` holds that its upstream does not, or null when
 * the branch has never been pushed. This is what sweep reads to tell a session
 * that finished from one whose work exists nowhere else.
 */
function unpushed(cwd) {
  let upstream = null
  try {
    upstream = runner(cwd)('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])
  } catch {
    return null
  }
  return Number(runner(cwd)('git', ['rev-list', '--count', `${upstream}..HEAD`]))
}

/** The worktrees of this repository, as porcelain records; the main tree first. */
function worktrees() {
  const out = git(['worktree', 'list', '--porcelain'])
  const trees = []
  let current = {}
  for (const line of out.split('\n')) {
    if (line === '') {
      if (current.path !== undefined) trees.push(current)
      current = {}
      continue
    }
    const [key, ...rest] = line.split(' ')
    if (key === 'worktree') current.path = rest.join(' ')
    if (key === 'HEAD') current.head = rest[0]
    if (key === 'branch') current.branch = rest[0].replace('refs/heads/', '')
    if (key === 'detached') current.detached = true
  }
  if (current.path !== undefined) trees.push(current)
  return trees
}

/** The main tree: porcelain order guarantees it is the first record. */
function mainTree() {
  return worktrees()[0].path
}

/** Which worktree holds `cwd`: the longest path that contains it. */
function ownTree(cwd) {
  const here = canonical(cwd)
  const found = worktrees()
    .filter((tree) => here === canonical(tree.path) || here.startsWith(canonical(tree.path) + path.sep))
    .sort((a, b) => b.path.length - a.path.length)
  if (found.length === 0) bad(`${cwd} is not inside a worktree of ${mainTree()}`)
  return found[0]
}

/** The session worktrees still open, under the main tree's `.claude/worktrees/`. */
function sessionTrees() {
  const base = canonical(path.join(mainTree(), '.claude', 'worktrees')) + path.sep
  return worktrees().filter((tree) => (canonical(tree.path) + path.sep).startsWith(base))
}

/** The lock file a tree describes, as a content hash; null where none is. */
function lockHash(treePath) {
  if (!fs.existsSync(path.join(treePath, 'package-lock.json'))) return null
  return git(['hash-object', 'package-lock.json'], treePath)
}

/** Whether a pid still runs, by the operating system's own answer. */
function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

/** The marker a session leaves in its tree: whose process opened it, when. */
function ownerMarker(treePath) {
  const file = path.join(treePath, '.debug', 'owner.json')
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** What one session tree is holding back, in one line for status and sweep. */
function holding(tree) {
  const parts = []
  const owner = ownerMarker(tree.path)
  if (owner !== null && Number.isInteger(owner.pid) && alive(owner.pid)) parts.push(`owner pid ${owner.pid} is running`)
  const changed = git(['status', '--porcelain', '--untracked-files=no'], tree.path)
  if (changed !== '') parts.push('uncommitted changes')
  const pending = unpushed(tree.path)
  if (pending === null) parts.push('no upstream — nothing pushed yet')
  else if (pending > 0) parts.push(`${pending} commit(s) not pushed`)
  return parts
}

function cmdStart(name, deps) {
  if (name === undefined || !/^[a-z0-9][a-z0-9-]*$/.test(name)) bad(`a session name is lowercase words joined by dashes, got "${name ?? ''}"`)
  const main = mainTree()
  if (canonical(CWD) !== canonical(main)) bad(`start runs from the main tree (${main})`)
  const target = path.join(main, '.claude', 'worktrees', name)
  if (fs.existsSync(target)) bad(`${target} already exists — work in it, or let sweep remove it`)
  if (exists(`refs/heads/session/${name}`)) bad(`branch session/${name} already exists — pick another name`)
  const modules = path.join(main, 'node_modules')
  if (!fs.existsSync(modules)) bad('the main tree has no node_modules/ — run npm ci there first')
  git(['worktree', 'add', target, '-b', `session/${name}`])
  // The junction serves every npm command below from the main tree's installed
  // dependencies; npm install/ci in this tree would delete them through the
  // link, and a session never runs them.
  fs.symlinkSync(modules, path.join(target, 'node_modules'), 'junction')
  fs.mkdirSync(path.join(target, '.debug'), { recursive: true })
  fs.writeFileSync(path.join(target, '.debug', 'owner.json'), `${JSON.stringify({ pid: process.ppid, at: new Date().toISOString(), name }, null, 2)}\n`)
  console.log(`session: opened .claude/worktrees/${name} on branch session/${name}`)
  if (lockHash(main) !== lockHash(target)) {
    const message = 'the lock file differs between the main tree and this one — run npm ci in the main tree, or open with --deps when the lock file change is the task'
    if (!deps) {
      git(['worktree', 'remove', '--force', target])
      git(['branch', '-D', `session/${name}`])
      bad(message)
    }
    console.log(`session: warning — ${message}`)
  }
  const ahead = between('HEAD', 'origin/master', target)
  if (ahead !== '') console.log(`session: origin/master is ahead of this tree — rebase before finishing:\n${ahead}`)
}

function cmdStatus() {
  const own = ownTree(CWD)
  const main = mainTree()
  const where = canonical(own.path) === canonical(main) ? '(main)' : path.relative(main, own.path)
  console.log(`session: this tree is ${where}${own.branch === undefined ? '' : ` on ${own.branch}`}`)
  const sessions = sessionTrees()
  if (sessions.length === 0) {
    console.log('session: no session trees are open')
    return
  }
  for (const tree of sessions) {
    const held = holding(tree)
    console.log(`session: open ${path.basename(tree.path)}${tree.branch === undefined ? '' : ` (${tree.branch})`} — ${held.length === 0 ? 'idle and clean' : held.join(', ')}`)
  }
}

function cmdFinish(push) {
  const own = ownTree(CWD)
  if (canonical(own.path) === canonical(mainTree())) bad('finish runs inside the session worktree; the main tree has no session branch to push')
  const branch = own.branch
  if (branch === undefined || !branch.startsWith('session/')) bad(`this tree is on ${branch ?? '(detached)'}, not a session/ branch`)
  const changed = git(['status', '--porcelain', '--untracked-files=no'], CWD)
  if (changed !== '') bad(`uncommitted changes remain — commit them into ${branch} first:\n${changed}`)
  const behind = between('HEAD', 'origin/master', CWD)
  if (behind !== '') console.log(`session: origin/master is ahead — rebase onto it so the cloud judges this work on the current base:\n${behind}`)
  if (push) {
    // The branch belongs to this session alone, and a session rebases it onto
    // origin/master before finishing, so its commits replace the ones this
    // branch already carries. The lease refuses the push when the remote moved
    // since this tree last fetched.
    git(['push', '--force-with-lease', '--set-upstream', 'origin', branch], CWD)
    console.log(`session: pushed ${branch}; its cloud run is the verdict on these commits`)
  }
  // The tree stays where it is: this process's caller still stands in it, and
  // a removal would meet an access-denied. Sweep on the main tree collects it
  // once the session is gone and nothing is left uncommitted or unpushed.
  console.log(`session: done — the main tree's sweep removes this worktree once this session is gone; branch ${branch} stays for the merge`)
}

function cmdSweep() {
  const sessions = sessionTrees()
  if (sessions.length === 0) {
    console.log('session: nothing to sweep')
    return
  }
  for (const tree of sessions) {
    const held = holding(tree)
    const name = path.basename(tree.path)
    if (held.length > 0) {
      console.log(`session: keeping ${name} — ${held.join(', ')}`)
      continue
    }
    git(['worktree', 'remove', '--force', tree.path])
    if (tree.branch !== undefined && tree.branch.startsWith('session/')) git(['branch', '-D', tree.branch])
    console.log(`session: swept ${name}`)
  }
}

const [, , command, ...rest] = process.argv
const flag = (name) => rest.includes(`--${name}`)
switch (command) {
  case 'start': cmdStart(rest.find((arg) => !arg.startsWith('--')), flag('deps')); break
  case 'status': cmdStatus(); break
  case 'finish': cmdFinish(!flag('no-push')); break
  case 'sweep': cmdSweep(); break
  default:
    console.error('usage: node scripts/session.mjs start <name> [--deps] | status | finish [--no-push] | sweep')
    process.exit(2)
}
