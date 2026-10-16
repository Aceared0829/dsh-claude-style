/**
 * appearance.cjs — the appearance layer: what each page state's parts compute
 * to on the real host, against the committed snapshot (D66).
 *
 * A behaviour check asks whether a thing works; this asks what it looks like.
 * The importance walk (importance.cjs) is the lane's tour of every page state on
 * a scratch host, and before it audits a state it lands every animation and
 * reads here, with the skin's own sheet in place, every part in the vocabulary
 * the stylesheets may read (packages/client/src/core/parts-table.ts, listed in
 * appearance-parts.json). Each part gives the properties a sheet writes and a
 * machine cannot change: colours, borders, radii, shadows, placement and
 * overflow. The resolved family and size of the font are left out on purpose:
 * both answer for the faces the machine has installed.
 *
 * The reading is compared with packages/testing/appearance.json: a part missing
 * from a state, one whose property changed, and one the snapshot holds and the
 * state no longer draws are each named with the values on both sides. The
 * snapshot is written by a run, never by hand —
 * `DSH_APPEARANCE=write node packages/testing/e2e.cjs --scenario importance` —
 * and scripts/ci-scope.mjs refuses one that moves without the client sources
 * that draw the pages.
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const SNAPSHOT = path.join(__dirname, 'appearance.json')
const PARTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'appearance-parts.json'), 'utf8')).parts
const PROPS = [
  'background-color',
  'color',
  'border-top-color',
  'border-top-width',
  'border-top-style',
  'border-top-left-radius',
  'box-shadow',
  'opacity',
  'display',
  'visibility',
  'position',
  'z-index',
  'font-weight',
  'overflow-x',
  'overflow-y',
]

/** One page state's reading; runs inside the page. A part the state does not draw is absent. */
function readInPage({ parts, props }) {
  const reading = {}
  for (const name of parts) {
    const element = document.querySelector(`[data-dsh-claude-part~="${name}"]`)
    if (element === null) continue
    const style = getComputedStyle(element)
    const values = {}
    for (const prop of props) values[prop] = style.getPropertyValue(prop)
    reading[name] = values
  }
  return reading
}

/**
 * Read one page state.
 * @param page - the Playwright page, settled and with the skin's own sheet in place.
 */
function readAppearance(page) {
  return page.evaluate(readInPage, { parts: PARTS, props: PROPS })
}

/** Every difference between a walk's readings, by state, and the committed snapshot. */
function compareAppearance(readings) {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')).states
  const problems = []
  for (const [state, recorded] of Object.entries(readings)) {
    const known = snapshot[state]
    if (known === undefined) {
      problems.push(`${state}: no snapshot for this page state`)
      continue
    }
    for (const [part, values] of Object.entries(recorded)) {
      const before = known[part]
      if (before === undefined) {
        problems.push(`${state} ${part}: the state draws this part and the snapshot has no reading for it`)
        continue
      }
      for (const [property, value] of Object.entries(values)) {
        if (before[property] !== value) problems.push(`${state} ${part} ${property}: ${JSON.stringify(before[property])} became ${JSON.stringify(value)}`)
      }
    }
    for (const part of Object.keys(known)) {
      if (recorded[part] === undefined) problems.push(`${state} ${part}: the snapshot holds a reading and the state no longer draws this part`)
    }
  }
  for (const state of Object.keys(snapshot)) {
    if (readings[state] === undefined) problems.push(`${state}: the snapshot holds this page state and the walk read nothing for it`)
  }
  return problems
}

/** Rewrite the snapshot from a walk's readings. */
function writeAppearance(readings) {
  const states = {}
  for (const name of Object.keys(readings).sort()) states[name] = readings[name]
  fs.writeFileSync(SNAPSHOT, `${JSON.stringify({
    note: 'The appearance layer\'s snapshot: what each page state\'s parts compute to on the real host, read by the importance walk through packages/testing/appearance.cjs (D66). Regenerate with DSH_APPEARANCE=write node packages/testing/e2e.cjs --scenario importance; a change here without a change under packages/client/src fails scripts/ci-scope.mjs.',
    states,
  }, null, 2)}\n`)
}

module.exports = { readAppearance, compareAppearance, writeAppearance }
