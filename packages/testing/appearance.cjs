#!/usr/bin/env node
/**
 * appearance.cjs — the committed appearance snapshot against what a smoke run
 * read (D00, 外观层).
 *
 * The smoke's every page state records what its parts compute to
 * (smoke/probe/appearance.js) and the run writes those readings to
 * `.debug/smoke/appearance.json`, which no gate commits. This compares that
 * reading with `packages/testing/appearance.json`, the snapshot in version
 * control: a part missing from a state, one whose property changed, and one the
 * snapshot holds and the state no longer draws are each named with the values
 * on both sides.
 *
 * The snapshot is written by a run, never by hand: `node packages/testing/smoke.cjs`
 * records the whole walk, `node packages/testing/appearance.cjs --write` then
 * rewrites the snapshot, and the diff is what a reviewer reads. Only
 * font-independent properties are recorded, because a computed font family
 * answers for the machine's installed faces (D00, 代价): the judgement is made
 * where the walk runs, and this machine's own snapshot is a reference.
 *
 * Usage: node packages/testing/appearance.cjs [--write] [--record <path>]
 *        --write  rewrite the snapshot from the reading
 *        --record the reading's path instead of the run's own scratch
 *
 * A run's reading is kept in `.debug/smoke/appearance.json` across runs on
 * purpose: a walk of one case leaves the states it did not drive untouched, so
 * the snapshot can be grown a case at a time.
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')
const SNAPSHOT = path.join(__dirname, 'appearance.json')
const READING = path.join(ROOT, '.debug', 'smoke', 'appearance.json')
const args = process.argv.slice(2)
const argOf = (flag) => {
  const at = args.indexOf(`--${flag}`)
  return at === -1 ? undefined : args[at + 1]
}

/** The reading a run left, or a failure naming the run that has to happen first. */
function reading() {
  const file = argOf('record') ?? READING
  if (!fs.existsSync(file)) {
    console.error(`appearance: ${path.relative(ROOT, file).replace(/\\/g, '/')} is not there — the appearance layer reads what a smoke walk recorded, so run one first: node packages/testing/smoke.cjs`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')).cases ?? {}
}

const cases = reading()

if (args.includes('--write')) {
  const sorted = {}
  for (const name of Object.keys(cases).sort()) sorted[name] = cases[name]
  fs.writeFileSync(SNAPSHOT, `${JSON.stringify({
    note: 'The appearance layer\'s snapshot: what each page state\'s parts compute to, recorded by packages/testing/smoke.cjs through probe/appearance.js and written by packages/testing/appearance.cjs (D00, 外观层). Regenerate with a smoke walk (node packages/testing/smoke.cjs) then node packages/testing/appearance.cjs --write; a change here without a change under packages/client/src fails scripts/ci-scope.mjs.',
    cases: sorted,
  }, null, 2)}\n`)
  const states = Object.keys(sorted).length
  const parts = Object.values(sorted).reduce((sum, state) => sum + Object.keys(state).length, 0)
  console.log(`appearance: wrote ${states} page states and ${parts} part readings to packages/testing/appearance.json`)
  process.exit(0)
}

const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')).cases ?? {}
const problems = []
for (const [state, recorded] of Object.entries(cases)) {
  const known = snapshot[state]
  if (known === undefined) {
    problems.push(`${state}: no snapshot for this page state — record it with a smoke walk (node packages/testing/smoke.cjs), then node packages/testing/appearance.cjs --write`)
    continue
  }
  for (const [part, values] of Object.entries(recorded)) {
    const before = known[part]
    if (before === undefined) {
      problems.push(`${state} ${part}: the state draws this part and the snapshot has no reading for it`)
      continue
    }
    for (const [property, value] of Object.entries(values)) {
      if (before[property] === value) continue
      problems.push(`${state} ${part} ${property}: ${JSON.stringify(before[property])} became ${JSON.stringify(value)}`)
    }
    for (const property of Object.keys(before)) {
      if (values[property] === undefined) problems.push(`${state} ${part} ${property}: the snapshot holds ${JSON.stringify(before[property])} and the reading has no value for it`)
    }
  }
  for (const part of Object.keys(known)) {
    if (recorded[part] === undefined) problems.push(`${state} ${part}: the snapshot holds a reading and the state no longer draws this part`)
  }
}
for (const state of Object.keys(snapshot)) {
  if (cases[state] === undefined) problems.push(`${state}: the snapshot holds this page state and the run read nothing for it — the walk has to cover it`)
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`appearance: ${problem}`)
  console.error(`appearance: ${problems.length} difference(s) between the snapshot and the walk; a change here is a change to what the page looks like, so record it with the run that made it and say why in the change`)
  process.exit(1)
}
const states = Object.keys(cases).length
const parts = Object.values(cases).reduce((sum, state) => sum + Object.keys(state).length, 0)
console.log(`appearance: ${states} page states and ${parts} part readings match packages/testing/appearance.json`)
