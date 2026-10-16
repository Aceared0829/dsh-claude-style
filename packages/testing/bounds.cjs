#!/usr/bin/env node
/**
 * bounds.cjs — the bounds a check compares against, read from one table
 * (D00, 断言的写法).
 *
 * A bound is a limit on a reading rather than a fixture the walk sets up: how
 * far behind the tail the scroller may lag, how long a frame may take, how much
 * long-task time a turn may spend. Those numbers are what a failing check gets
 * loosened to, so they live in packages/testing/bounds.json with the reason each
 * holds its value, and a check reads them from here instead of carrying a
 * literal of its own — a loosened bound is then one line in one file, visible in
 * the diff beside its reason.
 *
 * Usage: `const { bound } = require('./bounds.cjs')` from a lane's own module.
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const FILE = path.join(__dirname, 'bounds.json')
const TABLE = JSON.parse(fs.readFileSync(FILE, 'utf8'))

/** One bound's value by name; a name the table does not hold fails where it is read. */
function bound(name) {
  const entry = TABLE.bounds.find((item) => item.name === name)
  if (entry === undefined) throw new Error(`bounds: ${name} is not in packages/testing/bounds.json`)
  return entry.value
}

module.exports = { bound }
