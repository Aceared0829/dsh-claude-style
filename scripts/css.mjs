/**
 * css.mjs — the stylesheet half of the build (D51).
 *
 * Every stylesheet is plain CSS: it is parsed with PostCSS, and the rules the
 * skin's CSS lives by are checked on the syntax tree, selectors through
 * postcss-selector-parser:
 *
 *   scope        every selector holds `body[data-dsh-claude-style]` (outside :not())
 *   :has()       only in its selector's last compound, at every nesting level (D9)
 *   token gates  a rule writing a host token carries the Claude palette or
 *                typeface gate, and every private token the Claude choice
 *                defines has an alias under the host's (D30)
 *   composer     the rules below a sheet's `@composer-gate` comment get the
 *                composer gate stamped onto their scope compound (D4)
 *   attributes   every `data-dsh-*` attribute a selector reads is one the
 *                browser half writes: its name appears in the TypeScript
 *   motion       a time or an easing curve is written only in the token
 *                stylesheet, no two keyframes say the same thing, and every
 *                motion token is read somewhere (D65)
 *
 * The token stylesheet is generated from packages/client/src/theme/tokens.json, and so are the
 * token and motion tables in docs/STYLE.md; it also declares the brand marks' addresses
 * as `--dsh-claude-image-<name>`, the one thing in the CSS only the build knows.
 *
 * The joined sheet ships minified (scripts/shared/minify-css.cjs): comments and
 * formatting are for the source, and the checks above read the source.
 */
import fs from 'node:fs'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import { minifyCss } from './shared/minify-css.cjs'

/** The selector root every skin rule hangs off. */
const SCOPE_TAG = 'body'
const SCOPE_ATTRIBUTE = 'data-dsh-claude-style'
const SCOPE = `${SCOPE_TAG}[${SCOPE_ATTRIBUTE}]`
/** The comment in a gated sheet below which every rule follows the composer preference. */
const COMPOSER_GATE_MARKER = '@composer-gate'
/** The token stylesheet's place in the sheet list: generated, never read from disk. */
export const TOKEN_SHEET = 'theme/tokens.json'
const TOKEN_SCHEMA = 'theme/tokens.schema.json'
/** The region of docs/STYLE.md the token table is written into. */
const TABLE_BEGIN = '<!-- generated:tokens (packages/client/src/theme/tokens.json) -->'
const TABLE_END = '<!-- /generated:tokens -->'
const MOTION_BEGIN = '<!-- generated:motion (packages/client/src/theme/tokens.json) -->'
const MOTION_END = '<!-- /generated:motion -->'

/**
 * A time and an easing curve as a declaration's value spells them (D65). A
 * name such as `--dsh-claude-ease-out` or `win11-spin` is no match: the
 * character before must not continue an identifier or a number. `linear` and
 * the step functions are mechanical timing, not a style choice, and stay.
 */
const TIME_PATTERN = /(?<![\w.#-])(\d*\.?\d+)(ms|s)(?![\w-])/g
const EASE_PATTERN = /(?<![\w-])(?:ease|ease-in|ease-out|ease-in-out)(?![\w-])|cubic-bezier\(/

/** The prefix of the attributes the skin writes; the host's own are read as contracts (D44). */
const SKIN_ATTRIBUTE_PREFIX = 'data-dsh-'
/**
 * Attributes the browser half builds rather than spells out: the mascot
 * player marks its stand `data-dsh-claude-<character>-anchor` from the
 * character's name (features/mascot/mascot-player.ts).
 */
const BUILT_ATTRIBUTES = new Set(['data-dsh-claude-crab-anchor', 'data-dsh-claude-deepy-anchor'])

/* ---------- selectors ---------- */

/** The compound a selector node sits in: its siblings up to the nearest combinators. */
function compoundOf(node) {
  const nodes = node.parent.nodes
  let start = nodes.indexOf(node)
  let end = start
  while (start > 0 && nodes[start - 1].type !== 'combinator') start--
  while (end < nodes.length - 1 && nodes[end + 1].type !== 'combinator') end++
  return nodes.slice(start, end + 1)
}

/** Whether a selector node sits inside a :not(). */
function negated(node) {
  for (let parent = node.parent; parent !== undefined; parent = parent.parent) {
    if (parent.type === 'pseudo' && parent.value.toLowerCase() === ':not') return true
  }
  return false
}

/**
 * The scope compounds of one selector: each `[data-dsh-claude-style]` on a
 * `body` compound outside :not(), with the compound around it. A rule that
 * paints the document element reaches the scope through `html:has(…)`.
 */
function scopeCompounds(selector) {
  const found = []
  selector.walkAttributes((attribute) => {
    if (attribute.attribute !== SCOPE_ATTRIBUTE || negated(attribute)) return
    const compound = compoundOf(attribute)
    if (compound.some((node) => node.type === 'tag' && node.value === SCOPE_TAG)) found.push({ attribute, compound })
  })
  return found
}

/** Whether a selector's scope compound carries `[attribute="value"]`. */
function carries(selector, attribute, value) {
  return scopeCompounds(selector).some(({ compound }) => compound.some((node) => node.type === 'attribute' && node.attribute === attribute && node.value === value))
}

/**
 * Refuse a `:has()` outside its selector's last compound (D9): `A:has(B) C`
 * re-matches every descendant of every A on each DOM change below it. Each
 * level is checked on the way out, so `:is(A:has(B) C)` and
 * `A:not(:has(B)) C` are refused too.
 */
function checkHasPlacement(where, selector) {
  selector.walkPseudos((pseudo) => {
    if (pseudo.value.toLowerCase() !== ':has') return
    for (let node = pseudo; ;) {
      const level = node.parent
      if (level.nodes.slice(level.index(node) + 1).some((item) => item.type === 'combinator')) {
        throw new Error(`build: ${where} has a :has() followed by a combinator; mark the element from the skin's pass instead`)
      }
      if (level.parent.type !== 'pseudo') return
      node = level.parent
    }
  })
}

/**
 * Hold every write of a host token to its gate (D30), and record the private
 * tokens the Claude choice defines and the host choice aliases.
 *
 * A `--dsw-font-*` declaration must sit in a rule whose every selector carries
 * the Claude typeface gate; any other `--dsw-*` one in a rule carrying the
 * Claude palette gate. Under "follow the host" those rules drop out and the
 * host's tokens (or another theme plugin's) stand.
 */
function checkTokenGates(file, rule, selectors, gates, names) {
  const every = (gate, value) => selectors.every((selector) => carries(selector, gate.attribute, value))
  for (const node of rule.nodes) {
    if (node.type !== 'decl' || !node.prop.startsWith('--')) continue
    const name = node.prop
    const where = `packages/client/src/${file}:${node.source.start.line}`
    if (name.startsWith('--dsw-font-')) {
      if (!every(gates.typeface, gates.typeface.claude)) throw new Error(`build: ${where} writes ${name} outside the Claude typeface gate`)
    } else if (name.startsWith('--dsw-')) {
      if (!every(gates.palette, gates.palette.claude)) throw new Error(`build: ${where} writes ${name} outside the Claude palette gate`)
    }
    if (!name.startsWith('--dsh-claude-')) continue
    const gate = name.startsWith('--dsh-claude-font-') ? gates.typeface : gates.palette
    if (every(gate, gate.claude)) names.claude.add(name)
    if (every(gate, gate.host)) names.host.add(name)
  }
}

/** Whether a declaration is one of the motion properties the literal check reads. */
function motionProperty(prop) {
  return prop.startsWith('transition') || prop.startsWith('animation') || prop.startsWith('--')
}

/**
 * Hold every time and easing curve in a stylesheet to the token table (D65):
 * outside the token sheet itself, motion values are read as `var(--dsh-claude-…)`
 * and never written as literals, so one look at the token table answers what the
 * skin's motion is made of. `linear` and the step functions are timing rather
 * than a style choice, and a zero delay or duration is no motion at all, so both
 * stay in the sheets.
 */
function checkMotionLiterals(file, rule) {
  if (file === TOKEN_SHEET) return
  for (const node of rule.nodes) {
    if (node.type !== 'decl' || !motionProperty(node.prop)) continue
    const time = [...node.value.matchAll(TIME_PATTERN)].map((match) => match[0]).filter((value) => Number.parseFloat(value) !== 0)
    const easing = node.value.match(EASE_PATTERN)
    if (time.length === 0 && easing === null) continue
    const found = [...time, ...easing === null ? [] : [easing]].join(', ')
    throw new Error(`build: packages/client/src/${file}:${node.source.start.line} writes ${found} in ${node.prop}; read the token table in packages/client/src/${TOKEN_SHEET} (D65)`)
  }
}

/**
 * Record one sheet's keyframes, refusing a second body that says the same thing
 * as an earlier one: the same effect twice is what the shared presets are for
 * (D65).
 *
 * @param seen - signature → `name (file:line)`, across the sheets in cascade order.
 */
function collectKeyframes(file, root, seen) {
  root.walkAtRules(/keyframes$/i, (at) => {
    const body = at.nodes.map((rule) => `${rule.selector}{${rule.nodes.filter((node) => node.type === 'decl').map((node) => `${node.prop}:${node.value.replace(/\s+/g, ' ')}`).join(';')}}`).join(' ')
    const where = `${at.params} (packages/client/src/${file}:${at.source.start.line})`
    const first = seen.get(body)
    if (first !== undefined) throw new Error(`build: ${where} repeats the keyframes of ${first}; use the shared preset (D65)`)
    seen.set(body, where)
  })
}

/**
 * Parse one stylesheet, check every rule, and stamp the composer
 * gate below the marker of a gated sheet (D4). The composer preference decides
 * per page which composer surface the skin repaints, so the gate is one
 * attribute on `<body>` stamped onto the scope compound of every rule below
 * the marker; a gated sheet without the marker, or with no rule below it,
 * fails the build.
 *
 * @param read - collects the skin attributes the sheet's selectors read, each with where.
 * @param keyframes - signature → where, across the sheets, for the repeat check (D65).
 * @returns the sheet's text, comments and formatting kept.
 */
function processSheet(sheet, text, gates, names, read, keyframes) {
  const root = postcss.parse(text, { from: `packages/client/src/${sheet.file}` })
  let markerEnd = null
  if (sheet.gate === true) {
    const marker = root.nodes.find((node) => node.type === 'comment' && node.text === COMPOSER_GATE_MARKER)
    if (marker === undefined) throw new Error(`build: packages/client/src/${sheet.file} is missing the /* ${COMPOSER_GATE_MARKER} */ marker`)
    markerEnd = marker.source.end.offset
  }
  let stamped = 0
  root.walkRules((rule) => {
    if (rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return
    const where = `packages/client/src/${sheet.file}:${rule.source.start.line}`
    const selectors = selectorParser().astSync(rule.selector)
    selectors.walkAttributes((attribute) => {
      if (attribute.attribute.startsWith(SKIN_ATTRIBUTE_PREFIX) && !read.has(attribute.attribute)) read.set(attribute.attribute, where)
    })
    const stamp = markerEnd !== null && rule.source.start.offset > markerEnd
    for (const selector of selectors.nodes) {
      const scopes = scopeCompounds(selector)
      if (scopes.length === 0) throw new Error(`build: ${where} selector "${selector.toString().trim()}" is not under ${SCOPE}`)
      checkHasPlacement(where, selector)
      if (!stamp) continue
      for (const { attribute } of scopes) attribute.parent.insertAfter(attribute, selectorParser.attribute({ attribute: gates.composer }))
    }
    checkTokenGates(sheet.file, rule, selectors.nodes, gates, names)
    checkMotionLiterals(sheet.file, rule)
    if (!stamp) return
    rule.selector = selectors.toString()
    stamped += 1
  })
  collectKeyframes(sheet.file, root, keyframes)
  if (markerEnd !== null && stamped === 0) throw new Error(`build: packages/client/src/${sheet.file} has no rules below /* ${COMPOSER_GATE_MARKER} */`)
  return root.toString()
}

/* ---------- tokens ---------- */

/**
 * Read and validate packages/client/src/theme/tokens.json: its declared shape, and each token
 * named once per group.
 */
export function loadTokens(srcDir) {
  const schema = JSON.parse(fs.readFileSync(path.join(srcDir, TOKEN_SCHEMA), 'utf8'))
  const validate = new Ajv2020({ allErrors: true }).compile(schema)
  const doc = JSON.parse(fs.readFileSync(path.join(srcDir, TOKEN_SHEET), 'utf8'))
  if (!validate(doc)) throw new Error(`build: packages/client/src/${TOKEN_SHEET} ${validate.errors.map((error) => `${error.instancePath || '/'} ${error.message}`).join('; ')}`)
  for (const group of ['typeface', 'apex', 'palette', 'motion']) {
    const seen = new Set()
    for (const item of doc[group]) {
      if (seen.has(item.token)) throw new Error(`build: packages/client/src/${TOKEN_SHEET} names ${item.token} twice in ${group}`)
      seen.add(item.token)
    }
  }
  return doc
}

/** One rule of the token sheet; a block with nothing in it is left out. */
function tokenBlock(selector, declarations) {  if (declarations.length === 0) return ''
  return `${selector} {\n${declarations.map(([token, value]) => `  ${token}: ${value};`).join('\n')}\n}\n`
}

/** The declarations a group holds for one choice: `pick` reads the value, undefined when the token has none there. */
function declarationsOf(items, pick) {
  return items.flatMap((item) => {
    const value = pick(item)
    return value === undefined ? [] : [[item.token, value]]
  })
}

/**
 * The token stylesheet, in cascade order.
 *
 * Every block that writes a host token carries the Claude gate, so under
 * "follow the host" the host's own tokens stand (D30). The palette blocks name
 * `[data-ds-dark-theme]` for dark on purpose: the host's own dark block weighs
 * the same (0,1,1) as a bare `body[data-dsh-claude-style]`, so whichever sheet
 * the loader appended last would win; naming the attribute lifts these to
 * (0,2,1). The DeepSeek blocks add the brand attribute on top and only state
 * what differs from Claude's. The brand marks' addresses come first: every
 * choice paints with them. The motion tokens are one ungated block beside them:
 * the same durations, curves and distances under every palette and typeface
 * (D65).
 *
 * @param images - brand mark name → its address (data URI or route).
 */
function tokenSheet(doc, gates, images) {
  const dark = '[data-ds-dark-theme]'
  const light = ':not([data-ds-dark-theme])'
  const gate = ({ attribute }, value) => `[${attribute}="${value}"]`
  const claude = `${SCOPE}${gate(gates.palette, gates.palette.claude)}`
  const deepseek = `${claude}${gate(gates.brand, gates.brand.deepseek)}`
  return [
    `/* Generated from packages/client/src/${TOKEN_SHEET} by scripts/css.mjs; edit the JSON. */\n`,
    tokenBlock(SCOPE, Object.entries(images).map(([name, url]) => [`--dsh-claude-image-${name}`, `url("${url}")`])),
    tokenBlock(SCOPE, declarationsOf(doc.motion, (item) => item.value)),
    tokenBlock(`${SCOPE}${gate(gates.typeface, gates.typeface.claude)}`, declarationsOf(doc.typeface, (item) => item.claude)),
    tokenBlock(`${SCOPE}${gate(gates.typeface, gates.typeface.host)}`, declarationsOf(doc.typeface, (item) => item.host)),
    tokenBlock(`${SCOPE}${dark}`, declarationsOf(doc.apex, (item) => item.dark)),
    tokenBlock(`${SCOPE}${light}`, declarationsOf(doc.apex, (item) => item.light)),
    tokenBlock(`${claude}${dark}`, declarationsOf(doc.palette, (item) => item.claude?.dark)),
    tokenBlock(`${claude}${light}`, declarationsOf(doc.palette, (item) => item.claude?.light)),
    tokenBlock(`${deepseek}${light}`, declarationsOf(doc.palette, (item) => item.deepseek?.light)),
    tokenBlock(`${deepseek}${dark}`, declarationsOf(doc.palette, (item) => item.deepseek?.dark)),
    tokenBlock(`${SCOPE}${gate(gates.palette, gates.palette.host)}`, declarationsOf(doc.palette, (item) => item.host)),
  ].filter((block) => block !== '').join('\n')
}

/**
 * The palette as a Markdown table: each token's value in the four brand ×
 * theme cells (a DeepSeek cell shows the Claude value it keeps), its value
 * under the host palette (a host token keeps the host's own) and its use.
 */
function tokenTable(doc) {
  const cell = (value) => (value === undefined ? '—' : '`' + value.replace(/\|/g, '\\|') + '`')
  const rows = doc.palette.map((item) => {
    const claudeLight = item.claude?.light
    const claudeDark = item.claude?.dark
    const host = item.host === undefined && item.token.startsWith('--dsw-') ? "host's own" : cell(item.host)
    return `| \`${item.token}\` | ${cell(claudeLight)} | ${cell(item.deepseek?.light ?? claudeLight)} | ${cell(claudeDark)} | ${cell(item.deepseek?.dark ?? claudeDark)} | ${host} | ${item.use ?? ''} |`
  })
  return [
    '| Token | Claude light | DeepSeek light | Claude dark | DeepSeek dark | Host alias | Use |',
    '|---|---|---|---|---|---|---|',
    ...rows,
  ].join('\n')
}

/**
 * Write the token table into its region of docs/STYLE.md.
 * @returns whether the file changed.
 */
export function writeTokenTable(stylePath, doc) {
  const text = fs.readFileSync(stylePath, 'utf8')
  const begin = text.indexOf(TABLE_BEGIN)
  const end = text.indexOf(TABLE_END)
  if (begin === -1 || end < begin) throw new Error(`build: ${path.basename(stylePath)} lacks the ${TABLE_BEGIN} … ${TABLE_END} region`)
  const next = text.slice(0, begin + TABLE_BEGIN.length) + '\n' + tokenTable(doc) + '\n' + text.slice(end)
  if (next === text) return false
  fs.writeFileSync(stylePath, next)
  return true
}

/** The motion tokens as a Markdown table: the value and the role it plays (D65). */
function motionTable(doc) {
  const rows = doc.motion.map((item) => `| \`${item.token}\` | \`${item.value.replace(/\|/g, '\\|')}\` | ${item.use} |`)
  return [
    '| Token | Value | Use |',
    '|---|---|---|',
    ...rows,
  ].join('\n')
}

/**
 * Write the motion table into its region of docs/STYLE.md (D65).
 * @returns whether the file changed.
 */
export function writeMotionTable(stylePath, doc) {
  const text = fs.readFileSync(stylePath, 'utf8')
  const begin = text.indexOf(MOTION_BEGIN)
  const end = text.indexOf(MOTION_END)
  if (begin === -1 || end < begin) throw new Error(`build: ${path.basename(stylePath)} lacks the ${MOTION_BEGIN} … ${MOTION_END} region`)
  const next = text.slice(0, begin + MOTION_BEGIN.length) + '\n' + motionTable(doc) + '\n' + text.slice(end)
  if (next === text) return false
  fs.writeFileSync(stylePath, next)
  return true
}

/* ---------- the stylesheet ---------- */

/**
 * Hold every motion token to a reader (D65): a token nothing reads is a value
 * the token table claims the skin uses and nothing does. The readers are the
 * stylesheets and the browser half's TypeScript, which reads the same table
 * through packages/client/src/shared/motion.ts.
 *
 * The names the browser half asks for are checked the other way round: a name
 * that is not a motion token throws where it is read, so a misspelt one has to
 * fail here instead of on the page.
 *
 * @param doc - packages/client/src/theme/tokens.json.
 * @param sheetText - the joined stylesheets.
 * @param srcDir - the source directory.
 */
function checkMotionRead(doc, sheetText, srcDir) {
  const files = walkSources(srcDir, /\.tsx?$/)
  const names = new Set(doc.motion.map((item) => item.token))
  const code = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n')
  for (const match of code.matchAll(/motion(?:Value|Ms|Ease)\('([^']+)'\)/g)) {
    if (names.has(match[1])) continue
    throw new Error(`build: a module under packages/client/src/ reads the motion token ${match[1]}, which packages/client/src/${TOKEN_SHEET} does not declare (D65)`)
  }
  for (const item of doc.motion) {
    if (sheetText.includes(item.token) || code.includes(item.token)) continue
    throw new Error(`build: packages/client/src/${TOKEN_SHEET} declares ${item.token}, which no stylesheet or module reads (D65)`)
  }
}

/** Every file under `dir` matching `pattern`, down to `depth` directories below the top. */
function walkSources(dir, pattern, depth = 6) {
  const out = []
  const step = (current, left) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (left > 0) step(full, left - 1)
        continue
      }
      if (pattern.test(entry.name) && !/\.test\.[a-z]+$/.test(entry.name)) out.push(full)
    }
  }
  step(dir, depth)
  return out
}

/**
 * Hold every skin attribute a selector reads to the browser half: its name has
 * to appear in the TypeScript under `srcDir` (a constant's value or a literal),
 * or be one the browser half builds (BUILT_ATTRIBUTES). An attribute renamed
 * in the code, or misspelt in a sheet, leaves a rule that matches nothing.
 *
 * @param read - attribute name → where a selector first reads it.
 */
function checkAttributes(read, srcDir) {
  const code = walkSources(srcDir, /\.tsx?$/).map((file) => fs.readFileSync(file, 'utf8')).join('\n')
  for (const [name, where] of read) {
    if (BUILT_ATTRIBUTES.has(name)) continue
    if (!new RegExp(`${name}(?![a-z0-9-])`).test(code)) throw new Error(`build: ${where} reads [${name}], which nothing under packages/client/src/ writes`)
  }
}

/**
 * Every sheet in cascade order, checked, gated and joined.
 *
 * @param options.sheets - `{ file, rank, gate? }` in cascade order (TOKEN_SHEET generated).
 * @param options.srcDir - the source directory.
 * @param options.tokenDoc - packages/client/src/theme/tokens.json (loadTokens).
 * @param options.gates - `{ composer, palette: { attribute, claude, host }, typeface: { attribute, claude, host }, brand: { attribute, deepseek } }`.
 * @param options.images - brand mark name → its address, for the token sheet.
 * @returns the stylesheet text, minified once every check has read the sheets.
 */
export function buildStylesheet({ sheets, srcDir, tokenDoc, gates, images }) {
  const names = { claude: new Set(), host: new Set() }
  const read = new Map()
  const keyframes = new Map()
  const text = sheets.map((sheet) => {
    const source = sheet.file === TOKEN_SHEET
      ? tokenSheet(tokenDoc, gates, images)
      : fs.readFileSync(path.join(srcDir, sheet.file), 'utf8').replace(/\r\n/g, '\n')
    return processSheet(sheet, source, gates, names, read, keyframes).replace(/\n+$/, '')
  }).join('\n\n')
  for (const name of names.claude) {
    if (!names.host.has(name)) throw new Error(`build: ${name} is defined under the Claude palette or typeface but has no alias under the host's`)
  }
  checkAttributes(read, srcDir)
  checkMotionRead(tokenDoc, text, srcDir)
  return minifyCss(text)
}
