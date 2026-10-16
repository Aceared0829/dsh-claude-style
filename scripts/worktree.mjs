#!/usr/bin/env node
/**
 * worktree.mjs — take a scratch worktree off this repository without touching
 * the tree it points at.
 *
 * A scratch worktree under `.debug/` borrows the main tree's `node_modules` by
 * way of a directory link, so the checkout it runs in needs no install of its
 * own. `git worktree remove` deletes the worktree's files itself, and on Windows
 * it follows such a link: every file of the main tree's `packages/` and
 * `node_modules/` goes with it. This script unlinks the links at the worktree's
 * own top level first, then hands the directory to git, so what is deleted is
 * the worktree's files and the links, and nothing a link points at.
 *
 * Only a worktree under `.debug/` is accepted, and only a linked one: the main
 * working tree is never a candidate.
 *
 * Usage: node scripts/worktree.mjs remove <path> [--dry-run]
 */
import fs from 'node:fs'
import path from 'node:path'
import { runner } from './shared/run.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const run = runner(ROOT)

const [action, target, ...flags] = process.argv.slice(2)
if (action !== 'remove' || !target) {
  console.error('usage: node scripts/worktree.mjs remove <path> [--dry-run]')
  process.exit(2)
}
const dryRun = flags.includes('--dry-run')

const worktree = path.resolve(ROOT, target)
const debug = path.join(ROOT, '.debug') + path.sep

// The listed worktrees are absolute paths with forward slashes, one per line.
const listed = run('git', ['worktree', 'list', '--porcelain'])
  .split('\n')
  .filter((line) => line.startsWith('worktree '))
  .map((line) => path.resolve(line.slice('worktree '.length)).toLowerCase())
if (!worktree.toLowerCase().startsWith(debug.toLowerCase())) {
  console.error(`worktree: ${worktree} is outside .debug/; the main tree is never removed here`)
  process.exit(1)
}
if (!listed.includes(worktree.toLowerCase())) {
  console.error(`worktree: ${worktree} is not a linked worktree of this repository`)
  process.exit(1)
}

/** The entries at the worktree's top level that are links rather than directories of their own. */
const links = fs.existsSync(worktree)
  ? fs.readdirSync(worktree).flatMap((name) => {
    const full = path.join(worktree, name)
    return fs.lstatSync(full).isSymbolicLink() ? [full] : []
  })
  : []

for (const link of links) {
  console.log(`${dryRun ? 'would unlink' : 'unlink'} ${path.relative(ROOT, link)} -> ${fs.readlinkSync(link)}`)
  // `unlink` takes the link itself away: the directory it names keeps its files.
  if (!dryRun) fs.unlinkSync(link)
}
if (dryRun) process.exit(0)

run('git', ['worktree', 'remove', '--force', worktree])
console.log(`worktree: removed ${path.relative(ROOT, worktree)} (${links.length} link${links.length === 1 ? '' : 's'} unlinked first)`)
