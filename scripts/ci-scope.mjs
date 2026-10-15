#!/usr/bin/env node
/**
 * ci-scope.mjs — what a push changed, as the workflow's own outputs (D69).
 *
 * A push that touched no file the build or a browser reads does not need those
 * lanes, and one that touched a single feature directory does not need the
 * smoke's whole walk. This reads the changed paths once and answers for the
 * jobs: whether any code changed, which smoke selection the change earns, and
 * the tree hash the build cache is keyed on. The directory names it prints are
 * checked against the feature table the manifests produce (D42), so a printed
 * selection is one the smoke accepts, and a change it cannot place falls back to
 * the whole walk.
 *
 * Usage: node scripts/ci-scope.mjs [--base <ref> | --all | --files <path>] [--print]
 *        --base diffs that ref against this commit (an all-zero ref means a new
 *        branch, which diffs against master's merge base). A merge queue entry
 *        and a manual run judge the whole tree whatever the base says: neither
 *        is a push whose change can be read off the event, and both are asked
 *        for on purpose. --all covers every tracked file, for the same answer
 *        from a machine with no event to read; --files reads the changed paths
 *        from that file, one per line, for trying the mapping itself. --print
 *        writes the answers to stdout; without it they are appended to
 *        `$GITHUB_OUTPUT`.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { treeHash } from './shared/tree-hash.mjs'

const require = createRequire(import.meta.url)
const ROOT = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const argOf = (flag) => {
  const at = args.indexOf(`--${flag}`)
  return at === -1 ? undefined : args[at + 1]
}

/**
 * What no gate reads: the documents, the changelog, the locale files and the
 * workflow itself. A push holding only these still runs the checks, which need
 * no build, and leaves the lanes that read a built page alone.
 */
const UNREAD = [/^docs\//, /^locale\//, /^\.github\//, /\.md$/, /^LICENSE$/, /^THIRD_PARTY_NOTICES\.txt$/]

function git(...argv) {
  const result = spawnSync('git', argv, { cwd: ROOT, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`git ${argv.join(' ')} failed: ${result.stderr.trim()}`)
  return result.stdout
}

/** Every tracked path: the answer a run that cannot read a change falls back to. */
function tracked() {
  return git('ls-files').split('\n').filter(Boolean)
}

/** Whether this checkout holds a revision at all — a force push can leave none. */
function holds(revision) {
  return spawnSync('git', ['rev-parse', '--verify', '--quiet', `${revision}^{commit}`], { cwd: ROOT, encoding: 'utf8' }).status === 0
}

/** The paths this push changed, by the base the caller named. */
function changedFiles() {
  // A list read from a file answers the same question without a checkout to
  // diff, which is how the mapping itself is tried by hand.
  const listed = argOf('files')
  if (listed !== undefined) {
    return fs.readFileSync(listed, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean)
  }
  // A queue entry and a manual run judge the whole tree: neither is a push whose
  // change can be read off the event, and both are asked for on purpose.
  const event = process.env.GITHUB_EVENT_NAME ?? ''
  if (args.includes('--all') || event === 'merge_group' || event === 'workflow_dispatch') return tracked()
  const named = argOf('base')
  const base = named === undefined || named === '' || /^0+$/.test(named) ? 'origin/master' : named
  // A base this checkout does not hold — a rewritten branch whose old tip no
  // branch points at, a revision the fetch left out — leaves the change
  // unreadable, and the whole tree is the answer that cannot be wrong.
  if (!holds(base)) {
    console.error(`ci-scope: ${base} is not in this checkout; judging the whole tree`)
    return tracked()
  }
  // Three dots is the merge base: a branch push answers for the branch's own
  // commits rather than for everything master did meanwhile.
  return git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean)
}

/** The answers the workflow's jobs read. */
function scope(files) {
  const { featureCases, readManifests } = require('./shared/read-manifests.cjs')
  const featureCasesOf = featureCases(readManifests())
  const features = new Set()
  let code = false
  let shared = false
  for (const file of files) {
    if (UNREAD.some((pattern) => pattern.test(file))) continue
    code = true
    const feature = file.match(/^packages\/client\/src\/features\/([^/]+)\//)
    if (feature !== null && (featureCasesOf[feature[1]] ?? []).length > 0) {
      features.add(feature[1])
      continue
    }
    shared = true
  }
  // A change to the shared layer reaches every feature, and a selection is only
  // the narrow answer when every changed file sits inside a covered directory.
  const smoke = !code || shared || features.size === 0 ? '' : `--feature ${[...features].sort().join(',')}`
  return { code, smoke, tree: treeHash(ROOT).hash }
}

const answers = scope(changedFiles())
const lines = Object.entries(answers).map(([key, value]) => `${key}=${value}`)
if (args.includes('--print')) {
  process.stdout.write(`${lines.join('\n')}\n`)
} else {
  const file = process.env.GITHUB_OUTPUT
  if (file === undefined || file === '') throw new Error('ci-scope: no $GITHUB_OUTPUT; use --print to read the answers here')
  fs.appendFileSync(file, `${lines.join('\n')}\n`)
}
