/**
 * importance-audit.cjs — which of the skin's `!important` declarations the page needs (D51).
 *
 * The host's own styles carry a handful of `!important` and sit in no cascade
 * layer, so the skin's selectors — every one starting at
 * `body[data-dsh-claude-style]` — already outweigh the host's single-class rules
 * on specificity. A skin `!important` is needed where it beats a host
 * `!important`, an inline style, or another skin rule; everywhere else it only
 * adds weight. Which is which is decided on the real page, never by reading:
 *
 *   1. The page's stylesheet is parsed (PostCSS) and every style rule carries a
 *      marker declaration, so the page's CSSOM rules map back to the parsed ones.
 *   2. In each page state, the declarations not yet decided are tried in source
 *      order: the importance is dropped through the CSSOM and the computed value
 *      of every longhand on every matched element (and pseudo-element) is compared
 *      with the value before. Unchanged — and no transition started — means the
 *      `!important` is not needed here, and it stays dropped while the next one is
 *      tried, so the set grows consistently. Changed means it is needed.
 *   3. Before a state's trial, the set dropped in the earlier states is checked
 *      whole: the stylesheet with the set dropped against the original, every
 *      element's computed value of every property any `!important` names. A
 *      difference sends the declarations behind it back to "needed" — the ones
 *      whose rule reaches the element or an ancestor, or, when a value moved
 *      through the layout with no such rule, the one a halving search finds.
 *
 * Every read happens on a page held still: transitions and finite animations
 * landed, endless ones stopped at their first frame.
 *
 * The same states answer the other half of "every line is necessary": in each
 * state every selector the sheet writes that no state has matched yet is
 * queried against the page, and a selector that never matches an element in any
 * state fails the run. Pseudo-elements and the pseudo-classes of an interaction
 * come out first — the question is whether the element exists — and third-party
 * answers and the skin's own transient marks are excused by contract, as their
 * declarations are above.
 *
 * A declaration that never matched an element is kept: no state showed what it
 * holds. So is one in theme/third-party.css, which answers other plugins' styles
 * the scratch host does not install, one under a transient mark the walk cannot
 * hold (TRANSIENT_SELECTORS), one whose property the rule declares
 * twice, and one whose rule stands under a conditional at-rule the page is not
 * in — dropping its importance cannot change a value the condition already
 * keeps out of the cascade.
 *
 * The states come from the lane's walk beside this file (packages/testing/importance.cjs).
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const postcss = require('postcss')
const selectorParser = require('postcss-selector-parser')
const { minifyCss } = require('../../scripts/shared/minify-css.cjs')

const ROOT = path.resolve(__dirname, '..', '..')
/** The marker declaration carrying each rule's index into the page's CSSOM. */
const MARK = '--dsh-audit-rule'
/** The skin's stylesheet, by the tag it wears (D33). */
const SHEET = 'style[data-plugin-css="dsh-claude-style/client.css"]'
/** Pseudo-elements the page can read a computed style for. */
const READABLE_PSEUDO = new Set(['::before', '::after', '::marker', '::placeholder'])
/**
 * Selectors whose rule only applies while a transient mark is on the page,
 * under a pointer state the walk cannot hold, or in a state the walk carries
 * only now and then: no audited state carries them reliably, so a run that
 * happened to catch the element called the weight removable and the next run,
 * which did not, called it unmatched. Each entry is a contract, not a
 * convenience: the skin's own marks that go on and come off within one
 * animation (`fold-motion.css`'s rolling door, `inline.css`'s active-composer
 * controls, the send flight, the wait badge's leave, the reveal of a panel, the
 * reasoning window whose markdown variant the walk's turn sometimes carries), a
 * state a pointer holds (a dragged effort knob, a file row swapping its
 * operation), and the host's own mark for a theme transition. The hover walk
 * still covers the rules whose own trigger it can point at.
 */
const TRANSIENT_SELECTORS = [
  '[data-dsh-claude-rolling]', '[data-dsh-claude-composer-active]',
  '[data-dsh-claude-revealing]', '[data-dsh-claude-page-enter]', '[data-dsh-claude-page-leave]',
  '[data-dsh-claude-search-closing]', '[data-dsh-claude-turn-nav-landed]',
  '[data-dsh-claude-send-ghost]', '[data-dsh-claude-send-flight]', '[data-dsh-claude-send-link]',
  '[data-dsh-claude-stream-glide]', '[data-dsh-claude-follow-tail]', '[data-dsh-claude-follow-hold]',
  '[data-dsh-claude-reader-hold]', '[data-dsh-claude-summary-running]', '[data-dsh-claude-wait-badge-leaving]',
  '[data-dsh-claude-file-merge]', '[data-dsh-claude-chat-reveal]', '[data-dsh-claude-roll]',
  '[data-dsh-claude-dragging]', '[data-dsh-claude-swapping]',
  '[data-dsh-claude-reason-window]',
  '[data-dsh-theme-transitioning]',
]

/**
 * Pseudo-classes that need an interaction or a form state: the sweep asks
 * whether a selector's element exists at all, so these come out before the
 * query. A `:not(...)` keeps its own — an element that is not hovered is the
 * ordinary case there.
 */
const STATE_PSEUDOS = new Set([
  ':hover', ':active', ':focus', ':focus-visible', ':focus-within', ':target',
  ':checked', ':disabled', ':enabled', ':required', ':optional', ':valid', ':invalid',
  ':user-invalid', ':in-range', ':out-of-range', ':placeholder-shown', ':autofill',
  ':indeterminate', ':default', ':read-only', ':read-write', ':open', ':popover-open',
  ':link', ':visited', ':any-link',
])

/** Whether a pseudo-class sits inside a `:not(...)`, where removing it would change the question. */
function insideNot(node) {
  for (let parent = node.parent; parent !== undefined; parent = parent.parent) {
    if (parent.type === 'pseudo' && parent.value.toLowerCase() === ':not') return true
  }
  return false
}

/**
 * A rule's selector list as the sweep reads it: pseudo-elements and the
 * pseudo-classes of a state taken out, one entry per selector of the list.
 */
function sweepParts(selector) {
  const parts = []
  selectorParser((selectors) => {
    selectors.each((selector) => {
      const base = selector.clone()
      base.walkPseudos((node) => {
        const value = node.value.toLowerCase()
        if (value.startsWith('::') || value === ':before' || value === ':after') node.remove()
        else if (STATE_PSEUDOS.has(value) && !insideNot(node)) node.remove()
      })
      parts.push(base.toString().trim())
    })
  }).processSync(selector)
  return parts
}

/**
 * The rules of a stylesheet file, as `selector{declarations}` keys. The file
 * goes through the build's minifier first, so its keys spell the way the
 * page's rules do.
 */
function ruleKeys(file) {
  const keys = new Set()
  postcss.parse(minifyCss(fs.readFileSync(file, 'utf8'))).walkRules((rule) => { keys.add(ruleKey(rule)) })
  return keys
}

/** One rule as text that survives the build: its selector and its declarations. */
function ruleKey(rule) {
  return `${rule.selector.replace(/\s+/g, ' ')}{${rule.nodes.filter((node) => node.type === 'decl').map((node) => `${node.prop}:${node.value}${node.important ? '!' : ''}`).join(';')}}`
}

/**
 * The page's stylesheet, marked, and every rule holding an `!important`.
 *
 * @param text - the stylesheet the page runs.
 * @returns `{ annotated, rules, selectors }`; a rule is `{ id, selector, parts, props, keep }`,
 *     `parts` its selector list split into `{ base, pseudo }`, `keep` why its
 *     declarations are kept untried (or null); `selectors` the dead-selector
 *     sweep's inventory, each selector of the sheet mapped to why no state can
 *     be asked about it (or null).
 */
function planImportance(text) {
  const thirdParty = ruleKeys(path.join(ROOT, 'packages', 'client', 'src', 'theme', 'third-party.css'))
  const root = postcss.parse(text)
  const rules = []
  const selectors = new Map()
  let next = 0
  root.walkRules((rule) => {
    if (rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return
    const id = next++
    // What the rule waits on besides its selector: a rule under a conditional
    // at-rule the page is not in changes no computed value when its importance
    // is dropped, so the page decides the condition before the rule is tried.
    const conditions = []
    for (let node = rule.parent; node !== undefined && node.type === 'atrule'; node = node.parent) {
      if (!/keyframes$/i.test(node.name)) conditions.unshift({ name: node.name.toLowerCase(), params: node.params })
    }
    const important = rule.nodes.filter((node) => node.type === 'decl' && node.important).map((node) => node.prop.toLowerCase())
    const key = ruleKey(rule)
    // Every rule feeds the sweep, `!important` or not: a selector no page state
    // ever matches is weight whether or not its declarations carry any.
    const sweepKeep = thirdParty.has(key) ? 'third-party' : TRANSIENT_SELECTORS.some((needle) => rule.selector.includes(needle)) ? 'transient state' : rule.parent.type === 'rule' ? 'nested' : null
    for (const part of sweepParts(rule.selector)) if (!selectors.has(part)) selectors.set(part, sweepKeep)
    rule.prepend({ prop: MARK, value: String(id) })
    if (important.length === 0) return
    const parts = []
    selectorParser((selectors) => {
      selectors.each((selector) => {
        let pseudo = null
        const base = selector.clone()
        base.walkPseudos((node) => {
          const value = node.value.toLowerCase()
          if (value.startsWith('::') || [':before', ':after'].includes(value)) {
            pseudo = value.startsWith('::') ? value : `:${value}`
            node.remove()
          }
        })
        parts.push({ base: base.toString().trim(), pseudo })
      })
    }).processSync(rule.selector)
    const props = [...new Set(important)]
    let keep = null
    if (thirdParty.has(key)) keep = 'third-party'
    // A rule that only holds while a transient, self-inflicted mark is on the
    // page (the fold's rolling door) is judged by nothing the scenario can walk:
    // no state carries the mark, the declarations match no element there, and
    // whether the weight is needed is what the rule's own contract says. It
    // stays untried, like a third-party answer.
    else if (TRANSIENT_SELECTORS.some((needle) => rule.selector.includes(needle))) keep = 'transient state'
    else if (rule.parent.type === 'rule') keep = 'nested'
    else if (props.length !== important.length) keep = 'declared twice'
    else if (parts.every((part) => part.pseudo !== null && !READABLE_PSEUDO.has(part.pseudo))) keep = 'unreadable pseudo-element'
    rules.push({ id, selector: rule.selector, parts: parts.filter((part) => part.pseudo === null || READABLE_PSEUDO.has(part.pseudo)), props, keep, conditions })
  })
  return { annotated: root.toString(), rules, selectors }
}

/**
 * The stylesheet with the given declarations' `!important` dropped.
 *
 * @param text - the annotated stylesheet (planImportance).
 * @param dropped - `"<rule id>:<property>"` keys.
 */
function dropImportance(text, dropped) {
  const root = postcss.parse(text)
  root.walkRules((rule) => {
    const mark = rule.nodes.find((node) => node.type === 'decl' && node.prop === MARK)
    if (mark === undefined) return
    for (const node of rule.nodes) {
      if (node.type !== 'decl' || !node.important || !dropped.has(`${mark.value}:${node.prop.toLowerCase()}`)) continue
      node.important = false
      delete node.raws.important
    }
  })
  return root.toString()
}

/* ---------- in the page ---------- */

/**
 * Hold the page still: every transition and every finite animation brought to
 * its end, every endless one stopped at its first frame — a stylesheet swap
 * restarts the animations it declares, and a value read mid-flight is the
 * clock's, not the cascade's. The style pass comes first: a transition the
 * last change asks for exists only once styles are computed. Landing one can
 * start the next — a child inheriting the value runs a transition of its own —
 * so it repeats until nothing moves.
 */
const SETTLE = `function settleTransitions() {
  for (let round = 0; round < 40; round++) {
    void document.documentElement.offsetHeight
    // An element out of the layout tree (display: none) has its style computed
    // only when asked, so one read of each brings it up to date before anyone compares.
    for (const element of document.querySelectorAll('*')) {
      for (const pseudo of [null, '::before', '::after']) void getComputedStyle(element, pseudo).color
    }
    // Scroll-driven ones follow the scroll position, which holds still on its own.
    const moving = document.getAnimations().filter((animation) => animation.timeline === document.timeline).filter((animation) => animation.playState === 'running' || (animation.playState === 'paused' && animation.currentTime !== 0 && !Number.isFinite(animation.effect?.getComputedTiming().endTime)))
    if (moving.length === 0) return
    for (const animation of moving) {
      if (Number.isFinite(animation.effect?.getComputedTiming().endTime)) animation.finish()
      else {
        animation.pause()
        animation.currentTime = 0
      }
    }
  }
  throw new Error('importance: animations keep starting after forty rounds of landing them')
}`

/**
 * Try the undecided declarations of this page state, in source order (step 2
 * above). Runs inside the page; everything it needs comes in `input`.
 *
 * @returns `{ removable, needed, matched }` key lists.
 */
function tryInPage({ sheet, mark, rules, skip }) {
  const style = document.querySelector(sheet)
  const byId = new Map()
  const walk = (list) => {
    for (const rule of list) {
      if (rule.type === CSSRule.KEYFRAMES_RULE) continue
      if (rule.type === CSSRule.STYLE_RULE) {
        const id = rule.style.getPropertyValue(mark).trim()
        if (id !== '') byId.set(Number(id), rule)
      }
      if (rule.cssRules !== undefined) walk(rule.cssRules)
    }
  }
  walk(style.sheet.cssRules)
  // Land what the last state change set moving, so each trial starts from settled values.
  settleTransitions()
  const longhandsOf = new Map()
  const longhands = (prop) => {
    if (prop.startsWith('--')) return [prop]
    if (!longhandsOf.has(prop)) {
      const probe = document.createElement('div').style
      probe.setProperty(prop, 'initial')
      const names = [...Array(probe.length)].map((_, at) => probe.item(at))
      longhandsOf.set(prop, names.length === 0 ? [prop] : names)
    }
    return longhandsOf.get(prop)
  }
  const transitions = () => new Set(document.getAnimations().filter((animation) => animation instanceof CSSTransition))
  /** Every matched element and pseudo-element's value of each longhand, in one string per target. */
  const read = (targets, names) => targets.map(([element, pseudo]) => {
    const computed = getComputedStyle(element, pseudo)
    return names.map((name) => computed.getPropertyValue(name)).join('\u0001')
  })
  /** Drop the importance of `props` in a CSSOM rule; false when a value cannot be read back. */
  const drop = (rule, props) => {
    for (const prop of props) {
      const value = rule.style.getPropertyValue(prop)
      if (value === '') return false
      rule.style.setProperty(prop, value, '')
    }
    return true
  }
  /** Whether dropping `props` in `rule` leaves every target as it was; the drop stays when it does. */
  const attempt = (rule, targets, props) => {
    const names = [...new Set(props.flatMap(longhands))]
    const saved = rule.style.cssText
    const before = read(targets, names)
    const running = transitions()
    let same = drop(rule, props)
    if (same) {
      const after = read(targets, names)
      same = after.every((value, at) => value === before[at])
      const started = [...transitions()].filter((animation) => !running.has(animation))
      if (started.length > 0) same = false
      for (const animation of started) animation.cancel()
    }
    if (!same) {
      const restoring = transitions()
      rule.style.cssText = saved
      for (const animation of transitions()) if (!restoring.has(animation)) animation.cancel()
    }
    return same
  }
  const removable = []
  const needed = []
  const matched = []
  /** Whether the conditions a rule stands under hold right now; a rule whose condition does not is left for another state. */
  const conditionHolds = (conditions) => conditions.every((condition) => {
    if (condition.name === 'media') return matchMedia(condition.params).matches
    if (condition.name === 'supports') return CSS.supports(condition.params)
    return false
  })
  for (const plan of rules) {
    if (!conditionHolds(plan.conditions)) continue
    const rule = byId.get(plan.id)
    if (rule === undefined) continue
    const props = plan.props.filter((prop) => !skip.includes(`${plan.id}:${prop}`))
    if (props.length === 0) continue
    const targets = []
    for (const part of plan.parts) {
      let elements = []
      try { elements = [...document.querySelectorAll(part.base)] } catch { continue }
      for (const element of elements) targets.push([element, part.pseudo])
    }
    if (targets.length === 0) continue
    for (const prop of props) matched.push(`${plan.id}:${prop}`)
    // The whole rule first: most rules need none of their importance, and one
    // style pass then decides all of their declarations.
    if (props.length > 1 && attempt(rule, targets, props)) {
      for (const prop of props) removable.push(`${plan.id}:${prop}`)
      continue
    }
    for (const prop of props) (attempt(rule, targets, [prop]) ? removable : needed).push(`${plan.id}:${prop}`)
  }
  return { removable, needed, matched }
}

/**
 * Compare the page under two stylesheets (step 3 above): every element's and
 * its ::before / ::after's computed value of each named property. Transitions
 * the swap starts are finished, so the values read are where each one lands.
 *
 * @returns the differences as `{ element, pseudo, prop }`, element as an index into `*`.
 */
function diffInPage({ sheet, original, candidate, props }) {
  const style = document.querySelector(sheet)
  const elements = [...document.querySelectorAll('*')]
  const settle = () => settleTransitions()
  const snapshot = () => {
    settle()
    return elements.map((element) => [null, '::before', '::after'].map((pseudo) => {
      const computed = getComputedStyle(element, pseudo)
      return props.map((prop) => computed.getPropertyValue(prop))
    }))
  }
  style.textContent = original
  const before = snapshot()
  style.textContent = candidate
  const after = snapshot()
  style.textContent = original
  settle()
  const differences = []
  elements.forEach((element, at) => {
    ;[null, '::before', '::after'].forEach((pseudo, slot) => {
      props.forEach((prop, index) => {
        if (before[at][slot][index] !== after[at][slot][index]) differences.push({ element: at, pseudo, prop, before: before[at][slot][index], after: after[at][slot][index] })
      })
    })
  })
  return differences
}

/**
 * The dropped declarations behind each difference: those whose rule matches the
 * element (with its pseudo-element) or one of its ancestors — a value is
 * inherited — and whose property governs the one that moved, or is a custom
 * property the moved one may read through `var()`.
 */
function culpritsInPage({ rules, dropped, differences }) {
  const elements = [...document.querySelectorAll('*')]
  const droppedSet = new Set(dropped)
  const suspects = rules.filter((plan) => plan.props.some((prop) => droppedSet.has(`${plan.id}:${prop}`)))
  const longhandsOf = new Map()
  const covers = (prop, longhand) => {
    if (prop === longhand || prop.startsWith('--')) return true
    if (!longhandsOf.has(prop)) {
      const probe = document.createElement('div').style
      probe.setProperty(prop, 'initial')
      longhandsOf.set(prop, new Set([...Array(probe.length)].map((_, at) => probe.item(at))))
    }
    return longhandsOf.get(prop).has(longhand)
  }
  const matches = (element, base) => { try { return element.matches(base) } catch { return false } }
  /** For one element and pseudo-element: the suspect rules that reach it. */
  const reaching = new Map()
  const reach = (index, pseudo) => {
    const id = `${index}${pseudo ?? ''}`
    if (reaching.has(id)) return reaching.get(id)
    const element = elements[index]
    const chain = []
    for (let node = element; node !== null; node = node.parentElement) chain.push(node)
    const found = suspects.filter((plan) => plan.parts.some((part) => (part.pseudo === pseudo && matches(element, part.base))
      || (part.pseudo === null && chain.some((node) => (node !== element || pseudo !== null) && matches(node, part.base)))))
    reaching.set(id, found)
    return found
  }
  const culprits = new Set()
  for (const difference of differences) {
    for (const plan of reach(difference.element, difference.pseudo)) {
      for (const prop of plan.props) {
        const key = `${plan.id}:${prop}`
        if (droppedSet.has(key) && covers(prop, difference.prop)) culprits.add(key)
      }
    }
  }
  return [...culprits]
}

/**
 * The dead-selector sweep's one question, asked of the page as it stands: which
 * of these selectors match an element here. A selector the page cannot parse is
 * reported apart — the sweep never calls it dead, and a selector list of its
 * own is what a reader has to look at.
 */
function sweepInPage(selectors) {
  const matched = []
  const unparsed = []
  for (const selector of selectors) {
    let found = false
    try { found = document.querySelector(selector) !== null } catch { unparsed.push(selector); continue }
    if (found) matched.push(selector)
  }
  return { matched, unparsed }
}

/* ---------- one audit over several page states ---------- */

/**
 * An audit of one page: call `state(name)` once per page state, in order, then
 * `result()`.
 *
 * @param page - a Playwright page with the skin running.
 * @param reference - an earlier stylesheet the page's own must paint exactly
 *     like, state by state: a change that only takes `!important` away (or
 *     any other refactor) shows here as zero drift.
 */
async function createImportanceAudit(page, reference) {
  const original = await page.evaluate((sheet) => document.querySelector(sheet).textContent, SHEET)
  // The page functions below share one helper, defined on the page's window.
  await page.evaluate(`(() => { ${SETTLE}\nwindow.settleTransitions = settleTransitions })()`)
  const { annotated, rules, selectors } = planImportance(original)
  const tried = rules.filter((rule) => rule.keep === null)
  const props = [...new Set(rules.flatMap((rule) => rule.props))]
  // The drift check compares every property either sheet holds an `!important` on.
  const driftProps = reference === undefined ? [] : [...new Set([...props, ...planImportance(reference).rules.flatMap((rule) => rule.props)])]
  const drift = []
  const dropped = new Set()
  const needed = new Set()
  const matched = new Set()
  /** Selectors of the sheet a state matched an element with, and the ones the page could not parse. */
  const swept = new Set()
  const unparsed = new Set()
  const states = []
  const install = (text) => page.evaluate(([sheet, value]) => { document.querySelector(sheet).textContent = value }, [SHEET, text])
  /** The computed values that move when these declarations lose their importance. */
  const differencesWith = (keys) => page.evaluate(diffInPage, { sheet: SHEET, original: annotated, candidate: dropImportance(annotated, new Set(keys)), props })

  /**
   * The first dropped declaration, in the order they were dropped, whose drop
   * brings back one of these differences: the shortest prefix of the dropped
   * set that still shows one ends with it.
   */
  async function bisectCulprit(differences) {
    const order = [...dropped]
    const wanted = new Set(differences.map((item) => `${item.element}|${item.pseudo}|${item.prop}`))
    const shows = async (count) => (await differencesWith(order.slice(0, count))).some((item) => wanted.has(`${item.element}|${item.pseudo}|${item.prop}`))
    let low = 0
    let high = order.length
    while (high - low > 1) {
      const middle = (low + high) >> 1
      if (await shows(middle)) high = middle
      else low = middle
    }
    return order[high - 1]
  }

  /**
   * Audit the page as it stands now, under the given name.
   * @param only - rule ids to try in this state; every rule when absent.
   */
  async function state(name, only) {
    // The skin can mount its sheet anew between states; the audit's own text goes back in.
    const current = await page.evaluate((sheet) => document.querySelector(sheet).textContent, SHEET)
    if (current !== annotated && current !== original) throw new Error(`importance: the skin's stylesheet changed during the audit (state ${name})`)
    if (reference !== undefined) {
      const moved = await page.evaluate(diffInPage, { sheet: SHEET, original: reference, candidate: original, props: driftProps })
      if (moved.length > 0) drift.push({ state: name, count: moved.length, first: moved.slice(0, 3) })
      await install(original)
    }
    let sentBack = 0
    for (let pass = 0; pass < 40 && dropped.size > 0; pass++) {
      const differences = await differencesWith([...dropped])
      if (differences.length === 0) break
      let culprits = await page.evaluate(culpritsInPage, { rules: tried, dropped: [...dropped], differences })
      // A value can also move through the layout — a container query, a size the
      // rule never names — with no matching rule to point at; the dropped set is
      // then halved until the one declaration that brings the difference is found.
      if (culprits.length === 0) culprits = [await bisectCulprit(differences)]
      for (const key of culprits) { dropped.delete(key); needed.add(key) }
      sentBack += culprits.length
    }
    await install(dropImportance(annotated, dropped))
    const rulesHere = only === undefined ? tried : tried.filter((rule) => only.includes(rule.id))
    const verdict = await page.evaluate(tryInPage, { sheet: SHEET, mark: MARK, rules: rulesHere, skip: [...dropped, ...needed] })
    await install(original)
    for (const key of verdict.matched) matched.add(key)
    for (const key of verdict.removable) dropped.add(key)
    for (const key of verdict.needed) needed.add(key)
    // The dead-selector sweep: ask this state about every selector no state has
    // matched yet, so a selector that never matches one costs one pass per state.
    const pending = [...selectors.keys()].filter((selector) => selectors.get(selector) === null && !swept.has(selector) && !unparsed.has(selector))
    if (pending.length > 0) {
      const found = await page.evaluate(sweepInPage, pending)
      for (const selector of found.matched) swept.add(selector)
      for (const selector of found.unparsed) unparsed.add(selector)
    }
    states.push({ name, removable: verdict.removable.length, needed: verdict.needed.length, sentBack })
  }

  /**
   * The rules that wait on a hovered element: each with its selectors as they
   * read with `:hover` taken out, which find the element to put the pointer on.
   * Hovering it hovers its ancestors too, so `A:hover B` is reached through B.
   * Without a reference these are the rules still undecided; with one, every
   * hover rule that held an `!important` in the reference, so each of those
   * states is compared too.
   */
  function hoverTargets() {
    const open = (rule) => rule.props.some((prop) => !dropped.has(`${rule.id}:${prop}`) && !needed.has(`${rule.id}:${prop}`))
    const unhover = (base) => selectorParser((selectors) => {
      selectors.walkPseudos((node) => { if (node.value.toLowerCase() === ':hover') node.remove() })
    }).processSync(base)
    const target = (rule) => ({ id: rule.id, selectors: rule.parts.filter((part) => /:hover/i.test(part.base)).map((part) => unhover(part.base)) })
    if (reference !== undefined) {
      const tryHere = new Set(tried.filter(open).map((rule) => rule.selector))
      return planImportance(reference).rules.filter((rule) => rule.keep === null && /:hover/i.test(rule.selector))
        .map((rule) => ({ ...target(rule), only: tried.filter((own) => own.selector === rule.selector && tryHere.has(own.selector)).map((own) => own.id) }))
    }
    return tried.filter((rule) => open(rule) && /:hover/i.test(rule.selector)).map((rule) => ({ ...target(rule), only: [rule.id] }))
  }

  /**
   * What the states decided: every `!important`, and why each kept one stays;
   * and the sweep's tally — the selectors some state matched an element with,
   * the ones none did, the ones the page could not parse, and the ones the
   * inventory already excused.
   */
  function result() {
    const declarations = rules.flatMap((rule) => rule.props.map((prop) => {
      const key = `${rule.id}:${prop}`
      const verdict = rule.keep !== null ? rule.keep : dropped.has(key) ? 'removable' : needed.has(key) ? 'needed' : matched.has(key) ? 'needed' : 'unmatched'
      return { key, selector: rule.selector, prop, verdict }
    }))
    const excused = [...selectors].filter(([, keep]) => keep !== null)
    const dead = [...selectors].filter(([selector, keep]) => keep === null && !swept.has(selector) && !unparsed.has(selector)).map(([selector]) => selector)
    const sweep = {
      total: selectors.size,
      matched: swept.size,
      dead,
      unparsed: [...unparsed],
      excused: Object.fromEntries([...new Set(excused.map(([, keep]) => keep))].map((keep) => [keep, excused.filter(([, own]) => own === keep).length])),
    }
    return { states, declarations, drift, sheet: original, sweep }
  }

  return { state, hoverTargets, result }
}

module.exports = { createImportanceAudit, planImportance, dropImportance, ROOT }
