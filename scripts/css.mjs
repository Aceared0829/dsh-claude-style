/**
 * css.mjs — the stylesheet half of the build (D51).
 *
 * Every stylesheet is plain CSS: it is parsed with PostCSS, and the rules the
 * skin's CSS lives by are checked on the syntax tree, selectors through
 * postcss-selector-parser:
 *
 *   scope        every selector holds `body[data-dsh-claude-style]` (outside :not());
 *                a sheet whose manifest entry says `scope: 'surface'` holds
 *                `body[data-dsh-claude-surface]` instead and ships apart (D49)
 *   :has()       only in its selector's last compound, at every nesting level (D9)
 *   token gates  a rule writing a host token carries the Claude palette or
 *                typeface gate, and every private token the Claude choice
 *                defines has an alias under the host's (D30)
 *   composer     the rules below a sheet's `@composer-gate` comment get the
 *                composer gate stamped onto their scope compound (D4)
 *   attributes   every `data-dsh-*` attribute a selector reads is one the
 *                browser half writes, read off its syntax tree (scripts/source-tree.mjs)
 *   motion       a time or an easing curve is written only in the token
 *                stylesheet, no two keyframes say the same thing, and every
 *                motion token is read somewhere (D65)
 *   layers       a z-index above the local orders 0 to 9 is a layer token,
 *                and every layer token is read somewhere (D67)
 *
 * The token stylesheet is generated from packages/client/src/theme/tokens.json, and so are the
 * token, motion and layer tables in docs/STYLE.md; it also declares the brand marks' addresses
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
import { featureSheet } from './feature-sheets.mjs'
import { minifyCss } from './shared/minify-css.cjs'
import { loadModule } from './shared/ts-module.cjs'

/** The selector root every skin rule hangs off. */
const SCOPE_TAG = 'body'
const SCOPE_ATTRIBUTE = 'data-dsh-claude-style'
const SCOPE = `${SCOPE_TAG}[${SCOPE_ATTRIBUTE}]`
/**
 * The scope of the sheets that stay on the page while ds-bot's surface has it
 * (D49): the theme's own scope is gone then, and these rules are the surface
 * switch's whole look.
 */
const SURFACE_SCOPE_ATTRIBUTE = 'data-dsh-claude-surface'
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
const LAYER_BEGIN = '<!-- generated:layers (packages/client/src/theme/tokens.json) -->'
const LAYER_END = '<!-- /generated:layers -->'
/**
 * A z-index a sheet may write as it is: an order among siblings inside one
 * box (D67). Anything that stacks against the host's own surfaces is a layer
 * token instead.
 */
const LOCAL_LAYER = /^(?:auto|-1|[0-9])$/

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
/** The attribute carrying the skin's own names for host elements; the one host anchor a rule reads (D3). */
const PART_ATTRIBUTE = 'data-dsh-claude-part'

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
 * The scope compounds of one selector: each scope attribute
 * (`[data-dsh-claude-style]` unless named) on a `body` compound outside
 * :not(), with the compound around it. A rule that paints the document
 * element reaches the scope through `html:has(…)`.
 */
function scopeCompounds(selector, scopeAttribute = SCOPE_ATTRIBUTE) {
  const found = []
  selector.walkAttributes((attribute) => {
    if (attribute.attribute !== scopeAttribute || negated(attribute)) return
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
function checkTokenGates(label, rule, selectors, gates, names) {
  const every = (gate, value) => selectors.every((selector) => carries(selector, gate.attribute, value))
  for (const node of rule.nodes) {
    if (node.type !== 'decl' || !node.prop.startsWith('--')) continue
    const name = node.prop
    const where = `${label}:${node.source.start.line}`
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
function checkMotionLiterals(sheet, label, rule) {
  if (sheet.file === TOKEN_SHEET) return
  for (const node of rule.nodes) {
    if (node.type !== 'decl' || !motionProperty(node.prop)) continue
    const time = [...node.value.matchAll(TIME_PATTERN)].map((match) => match[0]).filter((value) => Number.parseFloat(value) !== 0)
    const easing = node.value.match(EASE_PATTERN)
    if (time.length === 0 && easing === null) continue
    const found = [...time, ...easing === null ? [] : [easing]].join(', ')
    throw new Error(`build: ${label}:${node.source.start.line} writes ${found} in ${node.prop}; read the token table in packages/client/src/${TOKEN_SHEET} (D65)`)
  }
}

/**
 * Hold every z-index in a stylesheet to the layer tokens (D67): a sheet orders
 * siblings inside its own box with a literal from -1 to 9, and anything that has
 * to clear what the host draws reads `var(--dsh-claude-layer-…)`, so the
 * levels the skin stacks on are one table.
 */
function checkLayerLiterals(sheet, label, rule) {
  if (sheet.file === TOKEN_SHEET) return
  for (const node of rule.nodes) {
    if (node.type !== 'decl' || node.prop !== 'z-index') continue
    const value = node.value.trim()
    if (LOCAL_LAYER.test(value) || /^var\(--dsh-claude-layer-[a-z0-9-]+\)$/.test(value)) continue
    throw new Error(`build: ${label}:${node.source.start.line} writes z-index: ${value}; above the local orders -1 to 9, read a layer from packages/client/src/${TOKEN_SHEET} (D67)`)
  }
}

/**
 * Record one sheet's keyframes, refusing a second body that says the same thing
 * as an earlier one: the same effect twice is what the shared presets are for
 * (D65).
 *
 * @param seen - signature → `name (file:line)`, across the sheets in cascade order.
 */
function collectKeyframes(label, root, seen) {
  root.walkAtRules(/keyframes$/i, (at) => {
    const body = at.nodes.map((rule) => `${rule.selector}{${rule.nodes.filter((node) => node.type === 'decl').map((node) => `${node.prop}:${node.value.replace(/\s+/g, ' ')}`).join(';')}}`).join(' ')
    const where = `${at.params} (${label}:${at.source.start.line})`
    const first = seen.get(body)
    if (first !== undefined) throw new Error(`build: ${where} repeats the keyframes of ${first}; use the shared preset (D65)`)
    seen.set(body, where)
  })
}

/** Where a sheet's rules are reported: its file, or the generator that wrote it (scripts/feature-sheets.mjs). */
function sheetLabel(sheet) {
  return sheet.generated === undefined ? `packages/client/src/${sheet.file}` : `scripts/feature-sheets.mjs (${sheet.generated})`
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
function processSheet(sheet, text, gates, names, read, parts, keyframes) {
  const label = sheetLabel(sheet)
  const root = postcss.parse(text, { from: label })
  const surface = sheet.scope === 'surface'
  const scopeAttribute = surface ? SURFACE_SCOPE_ATTRIBUTE : SCOPE_ATTRIBUTE
  // The composer gate is an attribute of the theme's own scope, which a surface sheet outlives.
  if (surface && sheet.gate === true) throw new Error(`build: ${label} is a surface sheet and cannot be composer-gated`)
  let markerEnd = null
  if (sheet.gate === true) {
    const marker = root.nodes.find((node) => node.type === 'comment' && node.text === COMPOSER_GATE_MARKER)
    if (marker === undefined) throw new Error(`build: ${label} is missing the /* ${COMPOSER_GATE_MARKER} */ marker`)
    markerEnd = marker.source.end.offset
  }
  let stamped = 0
  root.walkRules((rule) => {
    if (rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return
    const where = `${label}:${rule.source.start.line}`
    const selectors = selectorParser().astSync(rule.selector)
    selectors.walkAttributes((attribute) => {
      if (attribute.attribute.startsWith(SKIN_ATTRIBUTE_PREFIX) && !read.has(attribute.attribute)) read.set(attribute.attribute, where)
      if (attribute.attribute !== PART_ATTRIBUTE || attribute.operator !== '~=') return
      if (typeof attribute.value === 'string' && !parts.has(attribute.value)) parts.set(attribute.value, where)
    })
    const stamp = markerEnd !== null && rule.source.start.offset > markerEnd
    for (const selector of selectors.nodes) {
      const scopes = scopeCompounds(selector, scopeAttribute)
      if (scopes.length === 0) throw new Error(`build: ${where} selector "${selector.toString().trim()}" is not under ${SCOPE_TAG}[${scopeAttribute}]`)
      checkHasPlacement(where, selector)
      if (!stamp) continue
      for (const { attribute } of scopes) attribute.parent.insertAfter(attribute, selectorParser.attribute({ attribute: gates.composer }))
    }
    checkTokenGates(label, rule, selectors.nodes, gates, names)
    checkMotionLiterals(sheet, label, rule)
    checkLayerLiterals(sheet, label, rule)
    if (!stamp) return
    rule.selector = selectors.toString()
    stamped += 1
  })
  collectKeyframes(label, root, keyframes)
  if (markerEnd !== null && stamped === 0) throw new Error(`build: ${label} has no rules below /* ${COMPOSER_GATE_MARKER} */`)
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
  for (const group of ['typeface', 'apex', 'palette', 'motion', 'layer']) {
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
 * choice paints with them. The motion and layer tokens are ungated blocks
 * beside them: the same durations, curves, distances and stacking levels under
 * every palette and typeface (D65, D67).
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
    tokenBlock(SCOPE, declarationsOf(doc.layer, (item) => item.value)),
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
 * A token value as a Markdown table cell: a code span, with the backslash
 * escaped before the pipe, since a value's own `\` would otherwise escape the
 * `\|` that keeps the cell from ending at a pipe inside the value.
 */
function tableCell(value) {
  return '`' + value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|') + '`'
}

/**
 * The palette as a Markdown table: each token's value in the four brand ×
 * theme cells (a DeepSeek cell shows the Claude value it keeps), its value
 * under the host palette (a host token keeps the host's own) and its use.
 */
function tokenTable(doc) {
  const cell = (value) => (value === undefined ? '—' : tableCell(value))
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
 * Write `table` into the region of docs/STYLE.md between `begin` and `end`.
 * @returns whether the file changed.
 */
function writeRegion(stylePath, begin, end, table) {
  const text = fs.readFileSync(stylePath, 'utf8')
  const from = text.indexOf(begin)
  const to = text.indexOf(end)
  if (from === -1 || to < from) throw new Error(`build: ${path.basename(stylePath)} lacks the ${begin} … ${end} region`)
  const next = text.slice(0, from + begin.length) + '\n' + table + '\n' + text.slice(to)
  if (next === text) return false
  fs.writeFileSync(stylePath, next)
  return true
}

/**
 * Write the token table into its region of docs/STYLE.md.
 * @returns whether the file changed.
 */
export function writeTokenTable(stylePath, doc) {
  return writeRegion(stylePath, TABLE_BEGIN, TABLE_END, tokenTable(doc))
}

/** A group of one-value tokens as a Markdown table: the value and the role it plays. */
function valueTable(items) {
  const rows = items.map((item) => `| \`${item.token}\` | ${tableCell(item.value)} | ${item.use} |`)
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
  return writeRegion(stylePath, MOTION_BEGIN, MOTION_END, valueTable(doc.motion))
}

/**
 * Write the layer table into its region of docs/STYLE.md (D67).
 * @returns whether the file changed.
 */
export function writeLayerTable(stylePath, doc) {
  return writeRegion(stylePath, LAYER_BEGIN, LAYER_END, valueTable(doc.layer))
}

/* ---------- the stylesheet ---------- */

/**
 * Hold every motion and layer token to a reader (D65, D67): a token nothing
 * reads is a value the token table claims the skin uses and nothing does. The
 * readers are the stylesheets and, for motion, the browser half's TypeScript,
 * which reads the same table through packages/client/src/shared/motion.ts.
 *
 * The names the browser half asks for are checked the other way round: a name
 * that is not a motion token throws where it is read, so a misspelt one has to
 * fail here instead of on the page.
 *
 * @param doc - packages/client/src/theme/tokens.json.
 * @param sheetText - every stylesheet but the token sheet, and the tokens' own values.
 * @param sources - the browser half on its syntax tree (scripts/source-tree.mjs).
 */
function checkTokensRead(doc, sheetText, sources) {
  const names = new Set(doc.motion.map((item) => item.token))
  for (const [name, where] of sources.motion) {
    if (names.has(name)) continue
    throw new Error(`build: ${where} reads the motion token ${name}, which packages/client/src/${TOKEN_SHEET} does not declare (D65)`)
  }
  const named = (token) => [...sources.strings].some((text) => text.includes(token))
  for (const item of doc.motion) {
    if (sheetText.includes(item.token) || named(item.token)) continue
    throw new Error(`build: packages/client/src/${TOKEN_SHEET} declares ${item.token}, which no stylesheet or module reads (D65)`)
  }
  // A layer is read by the sheets alone: the browser half stacks nothing by
  // hand, it marks the element and the sheet places it (D67).
  for (const item of doc.layer) {
    if (sheetText.includes(item.token)) continue
    throw new Error(`build: packages/client/src/${TOKEN_SHEET} declares ${item.token}, which no stylesheet reads (D67)`)
  }
}

/**
 * Hold every skin attribute a selector reads to the browser half: some code
 * has to write it (scripts/source-tree.mjs follows the name into the DOM call
 * or the React props that write it). An attribute renamed in the code, written
 * nowhere any more, or misspelt in a sheet leaves a rule that matches nothing.
 *
 * @param read - attribute name → where a selector first reads it.
 * @param sources - the browser half on its syntax tree.
 */
function checkAttributes(read, sources) {
  for (const [name, where] of read) {
    if (!sources.attributes.has(name)) throw new Error(`build: ${where} reads [${name}], which nothing under packages/client/src/ writes`)
  }
}

/**
 * Hold every part name a selector reads to the table that defines it (D3).
 *
 * `[data-dsh-claude-part~="x"]` is the whole of a host anchor now, so a
 * misspelt or retired name leaves a rule that matches nothing — the failure the
 * substring selectors hid, made loud. The table is data
 * (packages/client/src/core/parts-table.ts), so the build reads the same list the
 * browser half walks.
 *
 * @param parts - part name → where a selector first reads it.
 */
function checkParts(parts) {
  const { PART_NAMES } = loadModule('packages/client/src/core/parts-table.ts')
  if (!Array.isArray(PART_NAMES) || PART_NAMES.length === 0) {
    throw new Error('build: packages/client/src/core/parts-table.ts exports no PART_NAMES')
  }
  const known = new Set(PART_NAMES)
  for (const [name, where] of parts) {
    if (!known.has(name)) throw new Error(`build: ${where} reads the part "${name}", which packages/client/src/core/parts-table.ts does not define`)
  }
}

/**
 * Every sheet in cascade order, checked, gated and joined.
 *
 * @param options.sheets - `{ file, rank, gate?, scope? }` or `{ generated, rank }` in cascade order (TOKEN_SHEET generated).
 * @param options.srcDir - the source directory.
 * @param options.sources - the browser half on its syntax tree (scripts/source-tree.mjs).
 * @param options.tokenDoc - packages/client/src/theme/tokens.json (loadTokens).
 * @param options.gates - `{ composer, palette: { attribute, claude, host }, typeface: { attribute, claude, host }, brand: { attribute, deepseek } }`.
 * @param options.images - brand mark name → its address, for the token sheet.
 * @param options.featureConstants - what the generated feature sheets are written from (scripts/feature-sheets.mjs).
 * @returns `{ main, surface }`: the theme's sheet and the surface sheets (D49),
 *     each minified once every check has read every sheet.
 */
export function buildStylesheet({ sheets, srcDir, sources, tokenDoc, gates, images, featureConstants }) {
  const names = { claude: new Set(), host: new Set() }
  const read = new Map()
  const parts = new Map()
  const keyframes = new Map()
  const processed = sheets.map((sheet) => {
    const source = sheet.file === TOKEN_SHEET
      ? tokenSheet(tokenDoc, gates, images)
      : sheet.generated !== undefined
        ? featureSheet(sheet.generated, featureConstants)
        : fs.readFileSync(path.join(srcDir, sheet.file), 'utf8').replace(/\r\n/g, '\n')
    return { sheet, text: processSheet(sheet, source, gates, names, read, parts, keyframes).replace(/\n+$/, '') }
  })
  const joined = (surface) => processed.filter((item) => (item.sheet.scope === 'surface') === surface).map((item) => item.text).join('\n\n')
  for (const name of names.claude) {
    if (!names.host.has(name)) throw new Error(`build: ${name} is defined under the Claude palette or typeface but has no alias under the host's`)
  }
  checkAttributes(read, sources)
  checkParts(parts)
  // The token sheet declares every token, so it is no reader of any: what reads
  // a token is another sheet, or another token's value (a shorthand).
  const readers = [
    ...processed.filter((item) => item.sheet.file !== TOKEN_SHEET).map((item) => item.text),
    ...tokenDoc.motion.map((item) => item.value),
  ].join('\n')
  checkTokensRead(tokenDoc, readers, sources)
  return { main: minifyCss(joined(false)), surface: minifyCss(joined(true)) }
}
