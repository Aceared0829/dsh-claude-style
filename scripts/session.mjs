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
 *   node scripts/session.mjs finish [--no-push]      merge this tree's branch into
 *                                                    master in the main tree, take
 *                                                    the push's verdict there (a bare
 *                                                    verify run, instant when that
 *                                                    tree is unchanged), then push
 *                                                    master
 *   node scripts/session.mjs sweep                   remove worktrees left by a
 *                                                    session that is gone: no live
 *                                                    owner, no uncommitted change,
 *                                                    nothing the merge did not carry
 *
 * `start` and `sweep` run from the main tree; `finish` runs from inside the
 * session worktree. The worktree and its branch coordinate one session's
 * change; they are never pushed (D68), so the gate and the push belong to the
 * main tree, after the merge. A session worktree never runs `npm install` or
 * `npm ci`: through the junction either one would delete the main tree's real
 * directory. `start` refuses when the lock file differs between the trees —
 * the junction would serve dependencies the session's sources do not match —
 * and `--deps` is the explicit override for the session whose task is the
 * lock file change itself. The junction also goes before the tree does: a
 * recursive delete that meets it walks into the main tree (removeTree below).
 */
import { spawnSync } from 'node:child_process'
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
  // A session branch stays local (D68): what tells a finished session from one
  // still holding work is whether master carries its commits, not whether they
  // were pushed.
  if (tree.branch !== undefined && tree.branch.startsWith('session/')) {
    const pending = between('master', tree.branch)
    if (pending !== '') parts.push(`${pending.split('\n').length} commit(s) not merged into master`)
  }
  return parts
}

/** The one link a session tree is meant to hold: its own `node_modules`. */
const MODULES_LINK = 'node_modules'

/**
 * Every link inside `treePath` other than the `node_modules` junction, so a
 * tree that points anywhere else is seen before it is removed.
 *
 * Nothing here follows a link: `readdirSync` answers for the entry itself, and
 * a link's target is never entered.
 */
function strayLinks(treePath) {
  const found = []
  const walk = (dir, relative) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const at = path.join(dir, entry.name)
      const seen = relative === '' ? entry.name : `${relative}/${entry.name}`
      if (entry.isSymbolicLink()) {
        if (seen !== MODULES_LINK) found.push(seen)
        continue
      }
      if (entry.isDirectory() && entry.name !== '.git') walk(at, seen)
    }
  }
  walk(treePath, '')
  return found
}

/**
 * Remove one session tree: its `node_modules` junction goes first.
 *
 * Windows reports a junction as a directory to git, so `git worktree remove`
 * walks into this one and reaches the main tree's `node_modules`, where npm's
 * workspace junctions (`node_modules/@dsh-claude-style/*`) lead on into the
 * main tree's `packages/*` and delete those files in place (D68). `rmdir`
 * drops the reparse point alone, and the tree is left with no way out of
 * itself. A tree holding any other link out is kept and named rather than
 * removed.
 */
function removeTree(treePath) {
  const strays = strayLinks(treePath)
  if (strays.length > 0) bad(`${treePath} holds links out of itself (${strays.join(', ')}) — remove them by hand and delete the tree, or ask what put them there`)
  const linked = path.join(treePath, MODULES_LINK)
  if (fs.lstatSync(linked, { throwIfNoEntry: false })?.isSymbolicLink() === true) fs.rmdirSync(linked)
  git(['worktree', 'remove', '--force', treePath])
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
      removeTree(target)
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
  const main = mainTree()
  if (canonical(own.path) === canonical(main)) bad('finish runs inside the session worktree; the main tree has nothing to merge')
  const branch = own.branch
  if (branch === undefined || !branch.startsWith('session/')) bad(`this tree is on ${branch ?? '(detached)'}, not a session/ branch`)
  const changed = git(['status', '--porcelain', '--untracked-files=no'], CWD)
  if (changed !== '') bad(`uncommitted changes remain — commit them into ${branch} first:\n${changed}`)
  if (git(['symbolic-ref', '--short', 'HEAD'], main) !== 'master') bad(`the main tree (${main}) is not on master — check master out there and finish again`)
  const mainChanged = git(['status', '--porcelain', '--untracked-files=no'], main)
  if (mainChanged !== '') bad(`the main tree has uncommitted changes — commit or drop them before the merge:\n${mainChanged}`)
  const behind = between('HEAD', 'origin/master', CWD)
  if (behind !== '') console.log(`session: origin/master is ahead — rebase onto it so the merge carries the current base:\n${behind}`)
  // The merge is the delivery (D68): the branch is this session's own and stays
  // local, so what carries the work is the merge commit on master. Its title is
  // the branch's last subject without that commit's own prefix, the shape the
  // merges into master already carry.
  const subject = git(['log', '-1', '--format=%s', branch], CWD)
  const title = subject.replace(/^[a-z]+(\([^)]*\))?: /, '')
  git(['merge', '--no-ff', branch, '-m', `merge: ${title}（${branch}）`], main)
  console.log(`session: merged ${branch} into master in ${main}`)
  if (!push) {
    console.log('session: --no-push given — master holds the merge and nothing was pushed')
    return
  }
  // The pre-push verdict belongs to the tree the push carries (D66): master in
  // the main tree, never the session branch. A bare verify run is that tier, and
  // its cache answers instantly when that tree is unchanged since the run that
  // filed it. A failed verdict refuses the push — the fix comes before the
  // cloud's minutes are spent on a run whose failure the machine already knew.
  const verdict = spawnSync(process.execPath, ['scripts/verify.mjs'], { cwd: main, stdio: 'inherit' })
  if (verdict.error !== undefined) throw verdict.error
  if (verdict.status !== 0) bad(`the pre-push verdict failed (exit ${verdict.status ?? verdict.signal}) — the push is refused; fix it in ${main} and push, or drop the merge there`)
  git(['push', 'origin', 'master'], main)
  console.log('session: pushed master; its cloud run is the verdict on these commits')
  // The tree stays where it is: this process's caller still stands in it, and a
  // removal would meet an access-denied. Sweep on the main tree collects it and
  // deletes the merged branch once this session is gone.
  console.log(`session: done — run \`npm run session -- sweep\` from ${main} to remove this worktree and delete ${branch}`)
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
    removeTree(tree.path)
    if (tree.branch !== undefined && tree.branch.startsWith('session/')) git(['branch', '-D', tree.branch])
    console.log(`session: swept ${name}${tree.branch === undefined ? '' : ` and deleted ${tree.branch}`}`)
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
