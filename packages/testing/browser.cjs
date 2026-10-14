/**
 * browser.cjs — the headless Chrome/Edge every tool here drives through
 * Playwright, and the browser lookup they share (D66).
 *
 * The machine's own Chrome or Edge is what runs; Playwright's bundled browsers
 * are never downloaded. CHROME_PATH overrides the lookup.
 */
'use strict'
const fs = require('node:fs')
const { chromium } = require('playwright')

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
]

/** The browser to drive: CHROME_PATH, else the first installed Chrome/Edge; undefined when there is none. */
function findChrome() {
  return CANDIDATES.filter(Boolean).find((candidate) => fs.existsSync(candidate))
}

/**
 * Start that browser headless and open one page on it.
 *
 * @param options.headless - run without a window (default true).
 * @param options.args - extra Chrome switches.
 * @param options.width/height - the viewport.
 * @param options.reducedMotion - 'no-preference' or 'reduce'; left out, the
 *     machine's own setting answers, which only a case that watches motion wants.
 * @param options.initScript - a function the page runs before any of its own
 *     scripts, for a reading that has to be in place before the first frame.
 * @returns `{ browser, context, page, newContext(), close() }`. `newContext()`
 *   opens another isolated context on the same browser — its own cache and
 *   cookies — which is how a page that must fetch everything fresh gets one.
 */
async function openBrowser(options = {}) {
  const executablePath = findChrome()
  if (!executablePath) throw new Error('no local Chrome or Edge found; set CHROME_PATH')
  const browser = await chromium.launch({ executablePath, headless: options.headless ?? true, args: options.args ?? [] })
  const viewport = { width: options.width ?? 1280, height: options.height ?? 900 }
  const newContext = async (extra = {}) => {
    const context = await browser.newContext({
      viewport,
      ...(options.reducedMotion === undefined ? {} : { reducedMotion: options.reducedMotion }),
      ...extra,
    })
    if (options.initScript !== undefined) await context.addInitScript(options.initScript)
    return context
  }
  const context = await newContext()
  const page = await context.newPage()
  return { browser, context, page, newContext, close: () => browser.close() }
}

module.exports = { findChrome, openBrowser }
