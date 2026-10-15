#!/usr/bin/env node
/**
 * ci-required.mjs — the one check a branch rule names (D69).
 *
 * A branch rule that lists every job has to be edited whenever a job is added or
 * renamed, and a job a rule does not name is a job a merge can skip. This reads
 * the `needs` the workflow hands it — the JSON `toJson(needs)` produces, one
 * entry per job with that job's `result` — and fails when any of them is not
 * `success`, so the rule names this one check and the jobs stay free to change.
 *
 * A job that was skipped is `success` here, which is what lets a push that
 * touched no code pass without running the lanes.
 *
 * Usage: node scripts/ci-required.mjs '<toJson(needs)>'
 */
const needs = JSON.parse(process.argv[2] ?? '{}')
const entries = Object.entries(needs)
if (entries.length === 0) {
  console.error('ci-required: no job was handed over; the workflow must pass `needs` in')
  process.exit(2)
}
for (const [job, state] of entries) console.log(`ci-required: ${job} — ${state.result}`)
// A job the workflow's own `if` left out reports `skipped`, which is the answer
// a push that touched no code gets; a cancelled or failed job is not.
const failed = entries.filter(([, state]) => state.result !== 'success' && state.result !== 'skipped')
if (failed.length > 0) {
  console.error(`ci-required: ${failed.map(([job]) => job).join(', ')} did not pass`)
  process.exit(1)
}
console.log(`ci-required: every one of ${entries.length} jobs passed`)
