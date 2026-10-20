/**
 * The sodium rewrite's mechanism (D78): a rule is rewritten where it stands and
 * written back exactly; a selector the sheet refuses is an error; the flow
 * marks agree with the host's own structural tests through every change; and
 * the table's rewrite of the host's flow rules selects the same elements as the
 * rules themselves, at the same specificity, as the browser's own cascade
 * judges it.
 *
 * @capability style-rewrite
 * @features engine, sodium
 * @risk With the switch on, a flow item that should collapse keeps its height or its gap, the running line's divider shows at the wrong moment, or a rule loses to one it used to beat, and the conversation's spacing changes under the reader.
 */
import { afterEach, expect, test } from 'vitest'
import { CHAT_FLOW_SLOT_SELECTOR, CHAT_GROUP_KEY_ATTRIBUTE, CHAT_GROUP_PART_ATTRIBUTE, CHAT_GROUP_PART_RESPONSE, CHAT_NODE_SELECTOR, FLOW_KIND_ATTRIBUTE, STEERING_ROW_KIND, TURN_PROCESS_ANSWER_ATTRIBUTE, TURN_PROCESS_ROW_KIND, TURN_TRIGGER_ROW_KIND, USER_ROW_KIND } from '@dsh-claude-style/contracts/dom'
import { keepFlowMarks } from '@dsh-claude-style/engine/flow-items'
import { applyRewrite, planRewrite, restoreRewrite } from '@dsh-claude-style/engine/sheet-rewrite'
import { SODIUM_MEMBERS } from '@dsh-claude-style/client/pure'
import { hostElement } from '../../fixtures/host-markup'

const settle = () => new Promise(resolve => setTimeout(resolve, 0))
const MARKS = { empty: 'data-test-empty', child: 'data-test-child' } as const
/** The host chat module's hashed classes stand in as these. */
const ITEM = 'hx_flowItem'
const COLUMN = 'hx_column'
const OLDER = 'hx_older'
const RUNNING = 'hx_running'
const DIVIDER = 'hx_runningDivider'
/** The host's own test of an empty flow item, as its sheet writes it. */
const EMPTY = `.${ITEM}:is(:empty, :has(> ${CHAT_NODE_SELECTOR}:empty))`

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  document.body.replaceChildren()
})

function sheetOf(text: string) {
  const style = document.createElement('style')
  style.setAttribute('data-test-sheet', '')
  style.textContent = text
  document.head.append(style)
  cleanups.push(() => style.remove())
  return style.sheet!
}

type ItemKind = 'empty' | 'empty-node' | 'node' | 'text'

/** A flow item: empty, holding a chat node (empty or with content), or holding text of its own. */
function item(kind: ItemKind, attributes: Record<string, string> = {}) {
  const element = document.createElement('div')
  element.className = ITEM
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  if (kind === 'text') element.append('words')
  if (kind === 'empty-node' || kind === 'node') {
    const node = hostElement(CHAT_NODE_SELECTOR)
    if (kind === 'node') node.append(document.createElement('p'))
    element.append(node)
  }
  return element
}

/**
 * A chat column after older turns, its flow slot holding every kind of row the
 * host's rules tell apart and ending on the running line, and beside it a
 * process group's own list of items, which none of the flow rules spaces.
 */
function conversation() {
  const column = document.createElement('div')
  column.className = COLUMN
  const older = document.createElement('div')
  older.className = OLDER
  const slot = hostElement(CHAT_FLOW_SLOT_SELECTOR)
  const running = item('text')
  running.classList.add(RUNNING)
  const divider = document.createElement('div')
  divider.className = DIVIDER
  running.append(divider)
  slot.append(
    item('node', { [FLOW_KIND_ATTRIBUTE]: USER_ROW_KIND }),
    item('empty'),
    item('empty-node'),
    item('text', { [CHAT_GROUP_PART_ATTRIBUTE]: CHAT_GROUP_PART_RESPONSE }),
    item('node'),
    item('node', { [FLOW_KIND_ATTRIBUTE]: TURN_PROCESS_ROW_KIND }),
    item('node', { [TURN_PROCESS_ANSWER_ATTRIBUTE]: '' }),
    item('node', { hidden: '' }),
    item('node', { [FLOW_KIND_ATTRIBUTE]: STEERING_ROW_KIND }),
    item('node', { [CHAT_GROUP_KEY_ATTRIBUTE]: 'g' }),
    running,
  )
  column.append(older, slot)
  const process = document.createElement('div')
  process.append(item('node'), item('empty-node'), item('node'), item('empty'))
  document.body.append(column, process)
  return { column, slot, process }
}

function expectMarksAgree() {
  for (const element of document.getElementsByClassName(ITEM)) expect(element.hasAttribute(MARKS.empty)).toBe(element.matches(EMPTY))
  for (const container of document.querySelectorAll(`.${COLUMN}, ${CHAT_FLOW_SLOT_SELECTOR}`)) {
    for (const child of container.children) expect(child.hasAttribute(MARKS.child)).toBe(true)
  }
}

test('a rewritten rule keeps its place, and writing it back restores the sheet as it was', () => {
  const sheet = sheetOf('.a { color: red } @media (min-width: 1px) { .b:hover { color: blue } } .c { color: green }')
  const before = [...sheet.cssRules].map(rule => rule.cssText)
  const shape = { rewrite: (selector: string) => selector === '.b:hover' ? { selector: '.b.x', captured: { name: 'b' } } : null }
  const planned = planRewrite(sheet, shape)
  expect(planned.map(entry => [entry.original, entry.rewritten, entry.captured])).toEqual([['.b:hover', '.b.x', { name: 'b' }]])
  const rewritten = applyRewrite(planned)
  expect([...sheet.cssRules].map(rule => rule.cssText)).toEqual([before[0], '@media (min-width: 1px) {\n  .b.x { color: blue; }\n}', before[2]])
  expect(planRewrite(sheet, shape, new Set(rewritten.map(entry => entry.rule)))).toEqual([])
  restoreRewrite(rewritten)
  expect([...sheet.cssRules].map(rule => rule.cssText)).toEqual(before)
})

test('a selector the sheet refuses is an error', () => {
  const sheet = sheetOf('.a { color: red }')
  expect(() => applyRewrite(planRewrite(sheet, { rewrite: () => ({ selector: '.a[[', captured: {} }) }))).toThrow()
})

test('the flow marks agree with the host tests through every change', async () => {
  const { slot, process } = conversation()
  cleanups.push(keepFlowMarks({ items: [ITEM], columns: [COLUMN] }, MARKS.empty, MARKS.child))
  expectMarksAgree()
  const [, empty, emptyNode, , full] = [...slot.children]
  empty.append('arrived')
  emptyNode.firstElementChild!.append('streamed')
  full.firstElementChild!.replaceChildren()
  process.lastElementChild!.append(hostElement(CHAT_NODE_SELECTOR))
  slot.prepend(item('empty'))
  await settle()
  expectMarksAgree()
  emptyNode.firstElementChild!.remove()
  const later = document.createElement('section')
  const column = document.createElement('div')
  column.className = COLUMN
  column.append(item('empty'), item('node'))
  later.append(column)
  document.body.append(later)
  await settle()
  expectMarksAgree()
  expect(process.querySelectorAll(`[${MARKS.child}]`).length).toBe(0)
})

test('stopping the keeper takes both marks off', () => {
  conversation()
  const stop = keepFlowMarks({ items: [ITEM], columns: [COLUMN] }, MARKS.empty, MARKS.child)
  expect(document.querySelectorAll(`[${MARKS.empty}]`).length).toBeGreaterThan(0)
  expect(document.querySelectorAll(`[${MARKS.child}]`).length).toBeGreaterThan(0)
  stop()
  expect(document.querySelectorAll(`[${MARKS.empty}], [${MARKS.child}]`).length).toBe(0)
})

/** The host chat module's flow rules as its sheet writes them, with the stand-in classes. */
const VISIBLE = `:not([hidden]):not(${EMPTY})`
const SCOPE = `:is(.${COLUMN}, ${CHAT_FLOW_SLOT_SELECTOR})`
const HOST_RULES = [
  `${SCOPE} > ${VISIBLE} ~ ${VISIBLE}, .${COLUMN}:has(> .${OLDER}) > ${CHAT_FLOW_SLOT_SELECTOR} > ${VISIBLE} { margin-top: var(--gap, 6px) }`,
  `.${ITEM}[${CHAT_GROUP_PART_ATTRIBUTE}="${CHAT_GROUP_PART_RESPONSE}"], ${SCOPE} > [${CHAT_GROUP_PART_ATTRIBUTE}="${CHAT_GROUP_PART_RESPONSE}"]:not([hidden]):not(:empty) + ${VISIBLE}:not(.${RUNNING}) { --gap: 12px }`,
  `.${ITEM}[${FLOW_KIND_ATTRIBUTE}="${TURN_PROCESS_ROW_KIND}"], .${ITEM}[${TURN_PROCESS_ANSWER_ATTRIBUTE}], ${SCOPE} > [${FLOW_KIND_ATTRIBUTE}="${TURN_PROCESS_ROW_KIND}"] + ${VISIBLE}:not(.${RUNNING}) { --gap: 16px }`,
  `${EMPTY} { height: 0px }`,
  `${SCOPE} > :nth-last-child(2 of ${VISIBLE}):is(.${ITEM}:not([${FLOW_KIND_ATTRIBUTE}="${USER_ROW_KIND}"]):not([${FLOW_KIND_ATTRIBUTE}="${STEERING_ROW_KIND}"]):not([${FLOW_KIND_ATTRIBUTE}="${TURN_TRIGGER_ROW_KIND}"]), [${CHAT_GROUP_KEY_ATTRIBUTE}]) ~ .${RUNNING} > .${DIVIDER} { display: block }`,
]

/** The table's chat flow entry, rewriting and keeping the marks on a sheet holding the host rules. */
function rewriteHostRules() {
  const adapter = SODIUM_MEMBERS.flatMap(member => member.adapters).find(entry => entry.id === 'chat-flow')!
  const sheet = sheetOf(HOST_RULES.join('\n'))
  const planned = planRewrite(sheet, adapter)
  const roles = new Map<string, string[]>()
  for (const entry of planned) for (const [role, name] of Object.entries(entry.captured)) roles.set(role, [name])
  cleanups.push(adapter.maintain(roles))
  return applyRewrite(planned)
}

test('the table rewrites every host flow rule to select the same elements', () => {
  conversation()
  const selected = HOST_RULES.map(rule => [...document.querySelectorAll(rule.slice(0, rule.lastIndexOf(' {')))])
  const rewritten = rewriteHostRules()
  expect(rewritten.length).toBe(HOST_RULES.length)
  rewritten.forEach((entry, at) => {
    expect(selected[at].length).toBeGreaterThan(0)
    expect(entry.rewritten).not.toContain(`:has(> ${CHAT_NODE_SELECTOR}`)
    expect([...document.querySelectorAll(entry.rewritten)]).toEqual(selected[at])
  })
})

test('every rewritten flow rule weighs what the host rule weighs', () => {
  conversation()
  const verdicts = rewriteHostRules().flatMap((entry) => [...document.querySelectorAll(entry.rewritten)].map((target) => {
    // Equal specificity: whichever of the two stands later wins, in either order.
    const first = sheetOf(`${entry.original} { --weigh: original } ${entry.rewritten} { --weigh: rewritten }`)
    const rewrittenLater = getComputedStyle(target).getPropertyValue('--weigh')
    first.ownerNode!.remove()
    const second = sheetOf(`${entry.rewritten} { --weigh: rewritten } ${entry.original} { --weigh: original }`)
    const originalLater = getComputedStyle(target).getPropertyValue('--weigh')
    second.ownerNode!.remove()
    return { rule: entry.original.slice(0, 60), target: target.outerHTML.slice(0, 80), rewrittenLater, originalLater }
  }))
  expect(verdicts.filter(verdict => verdict.rewrittenLater !== 'rewritten' || verdict.originalLater !== 'original')).toEqual([])
})
