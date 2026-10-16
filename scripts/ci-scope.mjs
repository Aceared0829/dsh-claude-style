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
 * It also holds the one push this cannot accept: a change to the appearance
 * snapshot (`packages/testing/appearance.json`) with no change under
 * `packages/client/src` (D00, 外观层). The snapshot is what the pages look like,
 * so it only moves when what draws them moved; a push that carries it alone is
 * a snapshot recorded by hand, and `--appearance` fails it. A snapshot the base
 * does not hold at all is the layer's own arrival, which is no page's change.
 *
 * Usage: node scripts/ci-scope.mjs [--base <ref> | --all | --files <path>] [--print] [--appearance]
 *        --base diffs that ref against this commit (an all-zero ref means a new
 *        branch, which diffs against master's merge base). A merge queue entry
 *        and a manual run judge the whole tree whatever the base says: neither
 *        is a push whose change can be read off the event, and both are asked
 *        for on purpose. --all covers every tracked file, for the same answer
 *        from a machine with no event to read; --files reads the changed paths
 *        from that file, one per line, for trying the mapping itself. --print
 *        writes the answers to stdout; without it they are appended to
 *        `$GITHUB_OUTPUT`. --appearance fails the run over the snapshot push
 *        instead of answering for the jobs.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { changedPaths } from './shared/changed-paths.mjs'
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

/**
 * The snapshot whose change stands for the pages themselves, and the sources
 * whose change is what may move it. Only the client's own sources count: the
 * snapshot is the computation of the sheets those sources carry, and the list
 * of parts read beside it (packages/testing/appearance-parts.json) is the one
 * testing file that decides the reading.
 */
const APPEARANCE = 'packages/testing/appearance.json'
const APPEARANCE_PARTS = 'packages/testing/appearance-parts.json'
const APPEARANCE_SOURCES = [/^packages\/client\/src\//]

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

/**
 * Every path the working tree has changed, a file the change removed included:
 * the snapshot rule has to see a path that is gone as well, or a push that took
 * the snapshot down would read as no change at all.
 */
function workingTreePaths() {
  return changedPaths()
}

/** The paths this push changed, by the base the caller named. */
function changedFiles() {
  // A list read from a file answers the same question without a checkout to
  // diff, which is how the mapping itself is tried by hand.
  const listed = argOf('files')
  if (listed !== undefined) {
    return fs.readFileSync(listed, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean)
  }
  // The working tree, for the snapshot rule: a session records the snapshot
  // before it commits, so both the file and the sources that moved it are still
  // uncommitted when the rule is asked. Every other question is about a push,
  // which is read from the base below.
  if (args.includes('--tree')) return workingTreePaths()
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

/**
 * The one push the mapping refuses: the appearance snapshot moved and nothing
 * under `packages/client/src` did. The snapshot is written by a smoke walk
 * (packages/testing/appearance.cjs), so a push carrying it alone is a snapshot
 * recorded by hand — it would accept whatever the page happened to look like on
 * the machine that wrote it, with no change to the sheets to say why. A snapshot
 * the base does not hold is the layer arriving, not a page changing, and stands.
 */
function refuseSnapshotAlone(files) {
  if (!files.includes(APPEARANCE)) return
  const moved = files.filter((file) => APPEARANCE_SOURCES.some((pattern) => pattern.test(file)))
  if (moved.length > 0 || files.includes(APPEARANCE_PARTS)) return
  const base = argOf('base')
  const known = args.includes('--tree') || base === undefined || base === '' || /^0+$/.test(base)
    ? tracked().includes(APPEARANCE)
    : holds(`${base}:${APPEARANCE}`)
  if (!known) return
  console.error(`ci-scope: ${APPEARANCE} changed and nothing under packages/client/src did — the appearance snapshot is recorded by a smoke walk and only moves with the sheets that draw the pages; drop it from the push or carry the change it belongs to`)
  process.exit(1)
}

const changed = changedFiles()
if (args.includes('--appearance')) {
  refuseSnapshotAlone(changed)
  const moved = changed.filter((file) => APPEARANCE_SOURCES.some((pattern) => pattern.test(file)))
  console.log(`ci-scope: ${APPEARANCE} ${changed.includes(APPEARANCE) ? `moved with ${moved.length} client source file(s)` : 'did not move'}`)
  process.exit(0)
}
const answers = scope(changed)
const lines = Object.entries(answers).map(([key, value]) => `${key}=${value}`)
if (args.includes('--print')) {
  process.stdout.write(`${lines.join('\n')}\n`)
} else {
  const file = process.env.GITHUB_OUTPUT
  if (file === undefined || file === '') throw new Error('ci-scope: no $GITHUB_OUTPUT; use --print to read the answers here')
  fs.appendFileSync(file, `${lines.join('\n')}\n`)
}
