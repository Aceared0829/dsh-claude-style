import { CHAT_FLOW_SLOT_SELECTOR, CHAT_GROUP_KEY_ATTRIBUTE, CHAT_GROUP_PART_ATTRIBUTE, CHAT_GROUP_PART_RESPONSE, CHAT_NODE_SELECTOR, FLOW_KIND_ATTRIBUTE, STEERING_ROW_KIND, TURN_PROCESS_ANSWER_ATTRIBUTE, TURN_PROCESS_ROW_KIND, TURN_TRIGGER_ROW_KIND, USER_ROW_KIND } from '@dsh-claude-style/contracts/dom'
import { keepFlowMarks } from '@dsh-claude-style/engine/flow-items'
import type { SelectorRewrite } from '@dsh-claude-style/engine/sheet-rewrite'
import { firstShape, selectorShape } from './selector-shape'

/**
 * The sodium table (D78): who ships the costly rules, from which release the
 * shapes below were checked, and how each is rewritten.
 *
 * The host itself is a member like any plugin: its interface is the built-in
 * plugins, which ship with the host and share its release. A member whose
 * release cannot be read takes no part.
 */
export interface SodiumMember {
  /** The name the settings tooltip shows the member under: the host's, or the package's. */
  readonly id: string
  /** Where the member's release is read: the host's boot graph, or the profile's bundle list for a plugin. */
  readonly release: 'host' | 'bundle'
  /** The lowest release the shapes were checked on; every later one is included. */
  readonly since: string
  readonly adapters: readonly SodiumAdapter[]
}

/** The rules of one sheet the table rewrites, and what keeps their replacements true. */
export interface SodiumAdapter extends SelectorRewrite {
  /** Stable name, for the specs. */
  readonly id: string
  /** The sheet as the loader tags it: the owning package, and the sheet's path in it. */
  readonly owner: string
  readonly sheet: string
  /**
   * Keep the attributes the rewritten rules read true, for the owner's classes
   * their selectors named, by role.
   * @returns stop: the attributes come off the page.
   */
  maintain(captured: ReadonlyMap<string, readonly string[]>): () => void
}

/** The marks the rewritten flow rules read (engine/src/flow-items.ts). */
const EMPTY_ITEM_ATTR = 'data-dsh-claude-empty-item'
const FLOW_CHILD_ATTR = 'data-dsh-claude-flow-child'

/*
 * The host chat module's flow rules, as the browser serializes them. Each asks
 * of a flow item whether it is empty — no children, or an empty chat node — and
 * most end in "a visible item that is not empty", a compound nearly every
 * element on the page matches, so every change has the browser try the whole
 * page against them. The replacements read two marks instead, and weigh the
 * same: the empty test's `:is()` counts a class and the heavier of `:empty` and
 * `:has(> [slot]:empty)`, which two attribute tests match; a visible item keeps
 * one of them and takes the flow-child mark for the other. Every compound the
 * flow-child mark enters stands on a child of the column or the flow slot, so
 * the mark changes nothing it selects.
 */
const FLOW = CHAT_FLOW_SLOT_SELECTOR
const EMPTY = `.{item}:is(:empty, :has(> ${CHAT_NODE_SELECTOR}:empty))`
const VISIBLE = `:not([hidden]):not(${EMPTY})`
const SCOPE = `:is(.{column}, ${FLOW})`
const EMPTY_NOW = `.{item}[${EMPTY_ITEM_ATTR}][${EMPTY_ITEM_ATTR}]`
const VISIBLE_NOW = `:not([hidden]):not(.{item}[${EMPTY_ITEM_ATTR}])[${FLOW_CHILD_ATTR}]`

/** One flow rule, rewritten by swapping its two costly compounds for the marks. */
function flowRule(template: string) {
  return selectorShape(template, template.split(VISIBLE).join(VISIBLE_NOW).split(EMPTY).join(EMPTY_NOW))
}

/** An empty item takes no height. */
const COLLAPSE = flowRule(EMPTY)
/** The gap above every visible item after the first, and above the first one after older turns. */
const GAP = flowRule(`${SCOPE} > ${VISIBLE} ~ ${VISIBLE}, .{column}:has(> .{older}) > ${FLOW} > ${VISIBLE}`)
/** The wider gap after a step's output. */
const GAP_AFTER_RESPONSE = flowRule(`.{item}[${CHAT_GROUP_PART_ATTRIBUTE}="${CHAT_GROUP_PART_RESPONSE}"], ${SCOPE} > [${CHAT_GROUP_PART_ATTRIBUTE}="${CHAT_GROUP_PART_RESPONSE}"]:not([hidden]):not(:empty) + ${VISIBLE}:not(.{running})`)
/** The widest gap, after a turn's process group. */
const GAP_AFTER_PROCESS = flowRule(`.{item}[${FLOW_KIND_ATTRIBUTE}="${TURN_PROCESS_ROW_KIND}"], .{item}[${TURN_PROCESS_ANSWER_ATTRIBUTE}], ${SCOPE} > [${FLOW_KIND_ATTRIBUTE}="${TURN_PROCESS_ROW_KIND}"] + ${VISIBLE}:not(.{running})`)
/** The running line's divider, shown when the item before it is an answer. */
const RUNNING_DIVIDER = flowRule(`${SCOPE} > :nth-last-child(2 of ${VISIBLE}):is(.{item}:not([${FLOW_KIND_ATTRIBUTE}="${USER_ROW_KIND}"]):not([${FLOW_KIND_ATTRIBUTE}="${STEERING_ROW_KIND}"]):not([${FLOW_KIND_ATTRIBUTE}="${TURN_TRIGGER_ROW_KIND}"]), [${CHAT_GROUP_KEY_ATTRIBUTE}]) ~ .{running} > .{divider}`)

const CHAT_FLOW: SodiumAdapter = {
  id: 'chat-flow',
  owner: '@deepseek-ai/dsh-client-ui-chat',
  sheet: '@deepseek-ai/dsh-client-ui-chat/ChatView.module.css',
  rewrite: firstShape([GAP, GAP_AFTER_RESPONSE, GAP_AFTER_PROCESS, COLLAPSE, RUNNING_DIVIDER]),
  maintain: (captured) => keepFlowMarks(
    { items: captured.get('item') ?? [], columns: captured.get('column') ?? [] },
    EMPTY_ITEM_ATTR,
    FLOW_CHILD_ATTR,
  ),
}

export const SODIUM_MEMBERS: readonly SodiumMember[] = [
  { id: 'DeepSeek Harness', release: 'host', since: '0.2.1-rc.2', adapters: [CHAT_FLOW] },
]
