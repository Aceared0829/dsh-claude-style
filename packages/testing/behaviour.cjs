#!/usr/bin/env node
/**
 * behaviour.cjs — the behaviour layer (D77): what a reader can see on the BUILT
 * plugin (`lib/`), loaded into the smoke's stand-in host page and driven from
 * outside through Playwright; no running DSH instance is needed.
 *
 * Each spec under packages/testing/specs/behaviour/<capability>/ names the
 * stand-in page it loads and the viewport bands it is judged at
 * (packages/testing/matrix.json); every test gets a fresh context, a fresh page
 * and the skin applied and settled, and judges what it reads with the
 * predicates in packages/testing/specs/fixtures/behaviour.cjs. A test's id is
 * `behaviour/<capability>/<name>`, with `@<band>` when the spec is judged at
 * more than one band.
 *
 * A failure leaves its evidence under `.debug/behaviour/<run>/<test>/`: the
 * Playwright trace of the whole test (DOM snapshots per action, console and
 * network), a screenshot and the page's markup at the moment it failed, and
 * the predicate's expected and actual values. `npx playwright show-trace
 * <trace.zip>` opens the trace; `--spec <id>` runs that one test again.
 *
 * A test listed in packages/testing/quarantine.json fails over a defect someone
 * has taken up: it runs and prints like any other, its failure does not fail
 * the run, and its passing does, so the entry leaves with the fix.
 *
 * Usage: node packages/testing/behaviour.cjs [--feature <dir>[,<dir>…]] [--spec <id prefix>[,…]] [--band <name>] [--jobs <n>] [--list]
 *        --feature runs the specs whose @features name the directory, --spec the
 *        tests whose id starts with a prefix, --band one viewport band of those
 *        a spec declares; none of them means every test. --list prints the ids.
 * Exit:  0 every test passed · 1 a test failed · 2 the run could not start
 */
'use strict'
const fs = require('node:fs')
const { availableParallelism } = require('node:os')
const path = require('node:path')
const { launchBrowser, newContextOn } = require('./browser.cjs')
const { page: standInPage, PRELUDE } = require('./smoke/page.cjs')
const { serveStandIn } = require('./smoke/server.cjs')
const { readers, expectThat, surface, host } = require('./specs/fixtures/behaviour.cjs')
const { ROOT, specFiles, readHeader, testId } = require('../../scripts/shared/spec-header.cjs')
const { withLock } = require('../../scripts/shared/verify-lock.cjs')
const { mapAtOnce } = require('./at-once.cjs')

const MATRIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'matrix.json'), 'utf8'))
const QUARANTINED = new Map(JSON.parse(fs.readFileSync(path.join(__dirname, 'quarantine.json'), 'utf8')).tests.map((entry) => [entry.id, entry]))
const OUT = path.join(ROOT, '.debug', 'behaviour')
/** Pages wait on the skin's passes and on frames, so they run beside each other up to half the cores. */
const DEFAULT_JOBS = Math.max(2, Math.min(8, Math.floor(availableParallelism() / 2)))

function bad(message) {
  console.error(`behaviour: ${message}`)
  process.exit(2)
}

/** The request on the command line. */
function request() {
  const args = process.argv.slice(2)
  const named = { feature: [], spec: [], band: [] }
  let jobs = DEFAULT_JOBS
  let list = false
  for (let at = 0; at < args.length; at += 1) {
    const arg = args[at]
    if (arg === '--list') { list = true; continue }
    const flag = arg.replace(/^--/, '').split('=')[0]
    const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : args[++at]
    if (flag === 'jobs') {
      if (!/^\d+$/.test(value ?? '') || Number(value) < 1) bad(`--jobs takes how many pages to drive at once, not "${value}"`)
      jobs = Number(value)
      continue
    }
    if (named[flag] === undefined || !arg.startsWith('--')) bad(`unknown argument "${arg}"`)
    if (value === undefined || value.trim() === '') bad(`--${flag} needs a value`)
    named[flag].push(...value.split(',').map((one) => one.trim()).filter(Boolean))
  }
  return { ...named, jobs, list }
}

/** Every test of every behaviour spec, fanned out over the bands its spec declares. */
function plan(asked) {
  const bands = new Map(MATRIX.bands.map((band) => [band.name, band]))
  const densities = new Set(MATRIX.densities)
  const items = []
  for (const file of specFiles().filter((one) => one.startsWith('packages/testing/specs/behaviour/'))) {
    const header = readHeader(file)
    const declared = require(path.join(ROOT, file))
    for (const band of declared.bands) {
      if (!bands.has(band)) bad(`${file} names the band "${band}", which packages/testing/matrix.json does not hold`)
    }
    for (const density of declared.densities) {
      if (!densities.has(density)) bad(`${file} names the density "${density}x", which packages/testing/matrix.json does not hold`)
    }
    for (const band of declared.bands) {
      for (const density of declared.densities) {
        for (const one of declared.tests) {
          const suffix = (declared.bands.length > 1 ? `@${band}` : '') + (declared.densities.length > 1 ? `@${density}x` : '')
          items.push({ id: `${testId(header, one.name)}${suffix}`, header, page: declared.page, band: bands.get(band), density, body: one.body })
        }
      }
    }
  }
  const ids = new Set()
  for (const item of items) {
    if (ids.has(item.id)) bad(`two tests answer to the id "${item.id}"`)
    ids.add(item.id)
  }
  // A quarantined id that no test answers to would hold nothing: the defect it
  // names is either fixed or the test moved (a new band adds a suffix), and
  // either way the entry has to leave the record by hand.
  for (const id of QUARANTINED.keys()) {
    if (!ids.has(id)) bad(`packages/testing/quarantine.json holds "${id}", which no test answers to`)
  }
  return items.filter((item) => (asked.feature.length === 0 || item.header.features.some((feature) => asked.feature.includes(feature)))
    && (asked.spec.length === 0 || asked.spec.some((prefix) => item.id.startsWith(prefix)))
    && (asked.band.length === 0 || asked.band.includes(item.band.name)))
}

/** A directory name for one test's evidence. */
const slug = (id) => id.replace(/[^\w@.-]+/g, '-').replace(/-+/g, '-').slice(0, 120)

/** Run one test in a context of its own, and answer its result. */
async function runOne(browser, base, item, runDir) {
  const context = await newContextOn(browser, { width: item.band.width, height: item.band.height, reducedMotion: 'no-preference' }, { deviceScaleFactor: item.density })
  await context.tracing.start({ screenshots: true, snapshots: true })
  const page = await context.newPage()
  const consoleLines = []
  page.on('console', (message) => consoleLines.push(`${message.type()}: ${message.text()}`))
  page.on('pageerror', (error) => consoleLines.push(`pageerror: ${error.message}`))
  const started = Date.now()
  try {
    await page.goto(`${base}/${item.page}`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.__smoke !== undefined, undefined, { timeout: 10000 })
    const report = await page.evaluate(() => window.__smoke)
    if (report.applyError !== null) throw new Error(`the skin did not apply: ${report.applyError}`)
    const settle = (quietMs) => page.evaluate((ms) => window.__dshSmokeProbe.settle(ms), quietMs)
    await settle()
    await item.body({
      page,
      read: readers(page),
      expectThat,
      surface,
      host,
      settle,
      /** Change preferences the way the settings page does, and let the page settle. */
      prefs: async (patch) => {
        await page.evaluate((value) => window.__pushForm(value), patch)
        await settle()
      },
    })
    await context.tracing.stop()
    return { id: item.id, ok: true, ms: Date.now() - started }
  } catch (error) {
    const dir = path.join(runDir, slug(item.id))
    fs.mkdirSync(dir, { recursive: true })
    await context.tracing.stop({ path: path.join(dir, 'trace.zip') })
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {})
    fs.writeFileSync(path.join(dir, 'dom.html'), await page.content().catch(() => ''))
    fs.writeFileSync(path.join(dir, 'console.txt'), consoleLines.join('\n'))
    fs.writeFileSync(path.join(dir, 'evidence.json'), `${JSON.stringify({ id: item.id, band: item.band, density: item.density, message: error.message, evidence: error.evidence ?? null }, null, 2)}\n`)
    return { id: item.id, ok: false, ms: Date.now() - started, error: error.message, evidence: path.relative(ROOT, dir).replace(/\\/g, '/') }
  } finally {
    await context.close()
  }
}

async function main() {
  const asked = request()
  const items = plan(asked)
  if (asked.list) {
    for (const item of items) console.log(item.id)
    return 0
  }
  if (items.length === 0) {
    // A feature directory no behaviour spec covers has nothing here to judge; a
    // spec id that matches nothing is a misspelling, and must not pass as a run.
    if (asked.spec.length > 0 || asked.feature.length === 0) bad('the selection holds no behaviour test')
    console.log(`behaviour: no behaviour spec covers ${asked.feature.join(', ')}`)
    return 0
  }
  if (!fs.existsSync(path.join(ROOT, 'lib', 'client.js'))) bad('lib/client.js is missing; run npm run build')
  const runDir = path.join(OUT, new Date().toISOString().replace(/[:.]/g, '-'))
  const server = await serveStandIn((name) => (items.some((item) => item.page === name) ? standInPage(name, 'full', [name], PRELUDE) : undefined))
  const browser = await launchBrowser()
  let results
  try {
    console.log(`behaviour: ${items.length} tests, ${asked.jobs} at a time`)
    results = await mapAtOnce(items, asked.jobs, (item) => runOne(browser, server.base, item, runDir))
  } finally {
    await browser.close()
    await server.close()
  }
  for (const result of results) {
    const quarantined = QUARANTINED.has(result.id)
    result.quarantined = quarantined
    // A quarantined test that passes has outlived its entry: that is what fails.
    result.blocking = quarantined ? result.ok : !result.ok
    const word = result.ok ? (quarantined ? 'PASS' : 'ok  ') : 'FAIL'
    console.log(`  ${word} ${result.id} (${(result.ms / 1000).toFixed(1)} s)${quarantined ? ' — quarantined' : ''}`)
    if (quarantined && result.ok) console.log('       passes now: take it out of packages/testing/quarantine.json')
    if (quarantined && !result.ok) console.log(`       ${QUARANTINED.get(result.id).defect}`)
    if (!result.ok) console.log(`       ${result.error.split('\n').join('\n       ')}\n       evidence: ${result.evidence} (npx playwright show-trace ${result.evidence}/trace.zip)`)
  }
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify({ at: new Date().toISOString(), results }, null, 2)}\n`)
  const blocking = results.filter((result) => result.blocking).length
  const held = results.filter((result) => result.quarantined && !result.ok).length
  const quarantine = held === 0 ? '' : `; ${held} quarantined ${held === 1 ? 'failure' : 'failures'} printed above`
  console.log(blocking === 0
    ? `\nbehaviour: ${results.length - held} of ${results.length} tests passed${quarantine}`
    : `\nbehaviour: ${blocking} of ${results.length} tests block the run${quarantine}`)
  return blocking === 0 ? 0 : 1
}

withLock('behaviour', 'behaviour', main).then((code) => process.exit(code ?? 0), (error) => {
  console.error(error)
  process.exit(1)
})
