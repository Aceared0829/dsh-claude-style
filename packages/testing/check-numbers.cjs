#!/usr/bin/env node
/**
 * check-numbers.cjs — every number a check decides on, as a generated record
 * (D00, 断言的写法).
 *
 * A check's failure used to be answered by loosening whichever number stood in
 * its expression, and nothing made that edit visible. This tool reads every
 * `check(name, expression, …)` in the two lanes, lists the numeric literals its
 * expression decides on, and writes them per file and per check name into
 * packages/testing/check-numbers.json. `--check` fails when the tree and the
 * record disagree, so changing a number — loosening one included — is a diff in
 * the record as well as in the code: a reviewer sees which checks moved and by
 * how much. The bound itself, with the reason it holds that value, belongs in
 * packages/testing/bounds.json, which the checks read.
 *
 * The name is the check's own first argument; a name built from a template is
 * keyed by its fixed part, so the record does not follow a constant's value.
 *
 * Usage: node packages/testing/check-numbers.cjs [--check]
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')
const RECORD = path.join(__dirname, 'check-numbers.json')

/** The files whose checks are recorded: the smoke's cases and probes, and the lane's own scenarios. */
function sources() {
  const files = []
  const add = (dir, pattern) => {
    for (const name of fs.readdirSync(path.join(ROOT, dir))) {
      if (pattern.test(name)) files.push(`${dir}/${name}`)
    }
  }
  add('packages/testing/smoke/cases', /\.cjs$/)
  add('packages/testing/smoke/probe', /\.js$/)
  for (const name of fs.readdirSync(path.join(ROOT, 'packages/testing'))) {
    if (/\.cjs$/.test(name) && !['host-half.cjs', 'smoke.cjs', 'lane.cjs', 'check-numbers.cjs', 'mock-llm.cjs', 'browser.cjs', 'privacy.cjs'].includes(name)) {
      files.push(`packages/testing/${name}`)
    }
  }
  return files.sort()
}

/**
 * The text of one call, from the opening parenthesis to its match, with strings
 * and comments read past so a parenthesis inside either does not count.
 */
function callText(text, open) {
  let depth = 0
  for (let at = open; at < text.length; at += 1) {
    const char = text[at]
    if (char === '/' && text[at + 1] === '/') {
      at = text.indexOf('\n', at)
      if (at === -1) return null
      continue
    }
    if (char === '/' && text[at + 1] === '*') {
      at = text.indexOf('*/', at + 2)
      if (at === -1) return null
      at += 1
      continue
    }
    if (char === '\'' || char === '"' || char === '`') {
      const quote = char
      at += 1
      while (at < text.length) {
        if (text[at] === '\\') at += 2
        else if (text[at] === quote) break
        else at += 1
      }
      continue
    }
    if (char === '(') depth += 1
    else if (char === ')') {
      depth -= 1
      if (depth === 0) return { body: text.slice(open + 1, at), end: at }
    }
  }
  return null
}

/** The call's arguments, split at the commas that stand outside every bracket and string. */
function argumentsOf(body) {
  const args = []
  let depth = 0
  let start = 0
  for (let at = 0; at < body.length; at += 1) {
    const char = body[at]
    if (char === '\'' || char === '"' || char === '`') {
      const quote = char
      at += 1
      while (at < body.length) {
        if (body[at] === '\\') at += 2
        else if (body[at] === quote) break
        else at += 1
      }
      continue
    }
    if ('([{'.includes(char)) depth += 1
    else if (')]}'.includes(char)) depth -= 1
    else if (char === ',' && depth === 0) {
      args.push(body.slice(start, at))
      start = at + 1
    }
  }
  args.push(body.slice(start))
  return args.map((arg) => arg.trim())
}

/** A check's key: its name, with escapes read and any template's dynamic tail dropped. */
function nameOf(argument) {
  const quoted = /^(['"])(.*)\1$/s.exec(argument)
  const text = (quoted !== null ? quoted[2] : argument.replace(/^`|`$/g, '')).replace(/\\(['"`\\])/g, '$1')
  const fixed = text.split('${')[0]
  return fixed.replace(/\s+/g, ' ').trim()
}

/** The numeric literals one expression decides on, strings and comments left out. */
function numbersOf(expression) {
  const bare = expression
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, ' ')
    .replace(/"(?:[^"\\]|\\.)*"/g, ' ')
    .replace(/`(?:[^`\\]|\\.)*`/g, ' ')
  const found = new Set()
  for (const match of bare.matchAll(/(?<![\w.$])(\d+(?:\.\d+)?)(?![\w.])/g)) found.add(Number(match[1]))
  return [...found].sort((left, right) => left - right)
}

/** Every check in one file: its name key and the numbers its expression decides on. */
function record(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8')
  const found = {}
  // `check(` and the lane's own `lane.check(` both count; a helper named
  // `basicChecks(` is no check of its own, which the lookbehind keeps out.
  for (const match of text.matchAll(/(?<![\w])check\s*\(/g)) {
    const call = callText(text, match.index + match[0].length - 1)
    if (call === null) continue
    const args = argumentsOf(call.body)
    if (args.length < 2) continue
    let name = nameOf(args[0])
    if (name === '' || name.includes('${')) continue
    const numbers = numbersOf(args[1])
    if (numbers.length === 0) continue
    // Two checks can share a name that is built from the same fixed part; the
    // later one is keyed by its own line so neither hides the other.
    if (found[name] !== undefined) name = `${name} (line ${text.slice(0, match.index).split('\n').length})`
    found[name] = numbers
  }
  return found
}

/** The whole record, as the file holds it. */
function current() {
  const out = {}
  for (const file of sources()) {
    const found = record(file)
    if (Object.keys(found).length > 0) out[file] = found
  }
  return out
}

/** What changed between the record on disk and the tree, one line per check. */
function differences(recorded, tree) {
  const problems = []
  for (const file of Object.keys(tree)) {
    const before = recorded[file] ?? {}
    for (const [name, numbers] of Object.entries(tree[file])) {
      const had = before[name]
      if (had === undefined) problems.push(`${file}: the check "${name}" is new, its numbers are ${numbers.join(', ')}`)
      else if (had.join(',') !== numbers.join(',')) problems.push(`${file}: the check "${name}" decided on ${had.join(', ')} and now decides on ${numbers.join(', ')}`)
    }
    for (const name of Object.keys(before)) {
      if (tree[file]?.[name] === undefined) problems.push(`${file}: the check "${name}" is gone`)
    }
  }
  for (const file of Object.keys(recorded)) {
    if (tree[file] === undefined) problems.push(`${file}: no check is recorded from this file any more`)
  }
  return problems
}

const tree = current()
if (process.argv.includes('--check')) {
  let recorded = {}
  try {
    recorded = JSON.parse(fs.readFileSync(RECORD, 'utf8')).checks
  } catch (error) {
    console.error(`check-numbers: packages/testing/check-numbers.json is unreadable (${error.message})`)
    process.exit(1)
  }
  const problems = differences(recorded, tree)
  if (problems.length > 0) {
    for (const problem of problems) console.error(`check-numbers: ${problem}`)
    console.error(`check-numbers: ${problems.length} checks moved — run \`npm run checks:numbers\`, and say in the change why each number moved`)
    process.exit(1)
  }
  const checks = Object.values(tree).reduce((sum, file) => sum + Object.keys(file).length, 0)
  const numbers = Object.values(tree).reduce((sum, file) => sum + Object.values(file).flat().length, 0)
  console.log(`check-numbers: ${checks} checks decide on ${numbers} numbers, as recorded`)
  process.exit(0)
}
fs.writeFileSync(RECORD, `${JSON.stringify({ note: 'Generated by packages/testing/check-numbers.cjs — the numbers each check decides on (D00). A change here is a change to what a check accepts: say why in the change.', checks: tree }, null, 2)}\n`)
const checks = Object.values(tree).reduce((sum, file) => sum + Object.keys(file).length, 0)
const numbers = Object.values(tree).reduce((sum, file) => sum + Object.values(file).flat().length, 0)
console.log(`check-numbers: recorded ${checks} checks and ${numbers} numbers from ${Object.keys(tree).length} files`)
