#!/usr/bin/env node
/**
 * fetch-prices.mjs — refresh the price snapshot the package ships
 *
 * Run by `.github/workflows/data.yml` once a day (and by hand after a pricing
 * change): the official page is parsed once here, in CI, and the result is
 * committed to `packages/host/data/prices.json`. Every install downloads the
 * validated document instead of parsing the page, so a page redesign breaks one
 * workflow run rather than every reader's meter.
 *
 * Both official tables are kept: the Chinese page's CNY prices and the English
 * page's USD prices are published independently (their per-model ratios differ),
 * so neither may be derived from the other. The peak clock and the Chinese
 * public holidays come from the peak rate catalog the same workflow refreshes;
 * a run without them keeps every day at the off-peak rate, which would overprice
 * holidays, so they are required.
 *
 *   node scripts/fetch-prices.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRICES_FILE, validatePrices } from './prices.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = path.join(ROOT, 'packages', 'host', 'data', PRICES_FILE)
const CATALOG = path.join(ROOT, 'packages', 'host', 'data', 'peakrate-catalog.json')
const SOURCE = {
  zh: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',
  en: 'https://api-docs.deepseek.com/quick_start/pricing/',
}
const SCHEDULE = {
  timeZone: 'Asia/Shanghai',
  peakDays: [1, 2, 3, 4, 5],
  peakWindows: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }],
  holidayZone: 'Asia/Shanghai',
}
const ALIASES = {
  'deepseek-v4-flash': 'deepseek-flash',
  'deepseek-v4-flash-vision-exp': 'deepseek-flash',
  'deepseek-v4.1-flash': 'deepseek-flash',
  'deepseek-chat': 'deepseek-flash',
  'deepseek-reasoner': 'deepseek-flash',
}
const MODEL_ID = /deepseek-[a-z0-9_.-]+/i

async function load(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { accept: 'text/html', 'user-agent': 'dsh-claude-style price snapshot' },
  })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return response.text()
}

function decode(text) {
  return text.replace(/&(nbsp|lt|gt|quot|#39|mdash|amp);/g,
    (_, entity) => ({ nbsp: ' ', lt: '<', gt: '>', quot: '"', '#39': "'", mdash: '—', amp: '&' })[entity])
}

function stripTags(html) {
  return decode(String(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function tables(html) {
  return (String(html).match(/<table[\s\S]*?<\/table>/gi) ?? []).map((block) => {
    const rows = []
    for (const tr of block.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
      const cells = []
      for (const cell of tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []) {
        cells.push(stripTags(cell.replace(/^<t[dh][^>]*>/, '').replace(/<\/t[dh]>$/, '')))
      }
      if (cells.length > 0) rows.push(cells)
    }
    return rows
  })
}

function money(cell) {
  const usd = /(?:^|[^\w.$])\$([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)/.exec(cell)
  if (usd !== null) return { value: Number(usd[1].replace(/,/g, '')), currency: 'USD' }
  const cny = /([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*元/.exec(cell)
  if (cny !== null) return { value: Number(cny[1].replace(/,/g, '')), currency: 'CNY' }
  return null
}

function metricOf(text) {
  const upper = text.toUpperCase()
  if (text.includes('缓存未命中') || upper.includes('CACHE MISS')) return 'cacheMiss'
  if (text.includes('缓存命中') || upper.includes('CACHE HIT')) return 'cacheHit'
  if (upper.includes('OUTPUT') && upper.includes('TOKEN')) return 'output'
  if (text.includes('输出') && (text.includes('百万') || text.includes('TOKEN'))) return 'output'
  return null
}

function tierOf(cell) {
  const text = cell.trim().toUpperCase()
  if (text === 'PEAK' || cell.trim() === '高峰时段') return 'peak'
  if (text === 'OFF-PEAK' || cell.trim() === '空闲时段') return 'offPeak'
  return null
}

/**
 * One page's rate table.
 *
 * @returns model id → currency → { offPeak, peak } with the three metrics.
 */
function parsePage(html, url) {
  const found = new Map()
  let currency = null
  for (const rows of tables(html)) {
    let ids = []
    let metric = null
    for (const row of rows) {
      const first = (row[0] ?? '').trim()
      if (/^MODEL$/i.test(first) || first === '模型') {
        const named = row.slice(1).map(cell => (MODEL_ID.exec(cell) ?? [])[0]).filter(Boolean)
        if (named.length > 0) ids = named.map(id => id.toLowerCase())
        continue
      }
      const detected = metricOf(row.join(' '))
      if (detected !== null) metric = detected
      if (ids.length === 0 || metric === null) continue
      const tierIndex = row.findIndex(cell => tierOf(cell) !== null)
      if (tierIndex < 0) continue
      const tier = tierOf(row[tierIndex])
      const prices = row.slice(tierIndex + 1, tierIndex + 1 + ids.length).map(money)
      if (prices.some(price => price === null)) continue
      if (prices.some(price => price.currency !== prices[0].currency)) {
        throw new Error(`fetch-prices: ${url} mixes currencies in one row`)
      }
      currency = prices[0].currency
      for (let i = 0; i < ids.length; i++) {
        let model = found.get(ids[i])
        if (model === undefined) {
          model = { offPeak: {}, peak: {} }
          found.set(ids[i], model)
        }
        model[tier][metric] = prices[i].value
      }
    }
  }
  for (const [id, model] of found) {
    for (const tier of ['offPeak', 'peak']) {
      for (const metric of ['cacheHit', 'cacheMiss', 'output']) {
        const value = model[tier][metric]
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          throw new Error(`fetch-prices: ${url} does not price ${id} ${tier}.${metric}`)
        }
      }
    }
    for (const metric of ['cacheHit', 'cacheMiss', 'output']) {
      if (model.peak[metric] < model.offPeak[metric]) {
        throw new Error(`fetch-prices: ${url} prices ${id} peak ${metric} below off-peak`)
      }
    }
  }
  if (currency === null) throw new Error(`fetch-prices: ${url} yields no rates`)
  return { currency, models: found }
}

/** The Chinese public holidays the peak rate catalog carries for DeepSeek. */
function holidays() {
  if (!fs.existsSync(CATALOG)) throw new Error(`fetch-prices: ${CATALOG} is missing; run scripts/fetch-peakrate-catalog.mjs first`)
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'))
  const profile = (catalog.profiles ?? []).find(entry => entry?.id === 'deepseek-v4')
  const dates = profile?.schedule?.publicHolidayDates
  if (!Array.isArray(dates) || dates.length === 0) {
    throw new Error('fetch-prices: the peak rate catalog carries no Chinese public holidays for DeepSeek')
  }
  return [...new Set(dates.filter(day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)))].sort()
}

const zh = parsePage(await load(SOURCE.zh), SOURCE.zh)
const en = parsePage(await load(SOURCE.en), SOURCE.en)
if (zh.currency !== 'CNY' || en.currency !== 'USD') {
  throw new Error(`fetch-prices: expected CNY from the Chinese page and USD from the English one, got ${zh.currency}/${en.currency}`)
}
const ids = [...zh.models.keys()].sort()
const englishIds = [...en.models.keys()].sort()
if (ids.join(',') !== englishIds.join(',')) {
  throw new Error(`fetch-prices: the two pages price different models (${ids.join(',')} vs ${englishIds.join(',')})`)
}

const models = {}
for (const id of ids) {
  models[id] = { CNY: zh.models.get(id), USD: en.models.get(id) }
}

const now = new Date()
const document = {
  schemaVersion: 1,
  updatedAt: now.toISOString().slice(0, 10),
  capturedAt: now.toISOString(),
  source: SOURCE,
  schedule: { ...SCHEDULE, holidays: holidays() },
  models,
  aliases: ALIASES,
}
validatePrices(document, TARGET)

// A daily rewrite that only moves the timestamps would make a commit a day.
// The rates, the clock and the holidays are what the document is for; when they
// match the committed copy, the file is left alone.
if (fs.existsSync(TARGET)) {
  const previous = JSON.parse(fs.readFileSync(TARGET, 'utf8'))
  const facts = (doc) => {
    const { updatedAt, capturedAt, ...rest } = doc
    return JSON.stringify(rest)
  }
  if (facts(previous) === facts(document)) {
    console.log(`prices unchanged (${ids.length} models)`)
    process.exit(0)
  }
}

fs.writeFileSync(TARGET, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
console.log(`wrote packages/host/data/${PRICES_FILE} (${ids.length} models, CNY/USD, ${document.schedule.holidays.length} holidays, updatedAt ${document.updatedAt})`)
