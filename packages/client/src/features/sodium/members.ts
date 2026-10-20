import { CHAT_FLOW_SLOT_SELECTOR, CHAT_GROUP_PART_ATTRIBUTE, CHAT_GROUP_PART_RESPONSE, CHAT_NODE_SELECTOR, CHAT_RUNNING_SELECTOR, FLOW_BLOCK_SELECTOR, FLOW_KIND_ATTRIBUTE, PENDING_STEERING_SELECTOR, SUBMISSION_ECHO_SELECTOR, TURN_PROCESS_ANSWER_ATTRIBUTE, TURN_PROCESS_ROW_KIND } from '@dsh-claude-style/contracts/dom'
import { keepFlowChildMark } from '@dsh-claude-style/engine/flow-items'
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

/** The mark the rewritten flow rules read (engine/src/flow-items.ts). */
const FLOW_CHILD_ATTR = 'data-dsh-claude-flow-child'

/*
 * The host chat module's gap rules, as the browser serializes them. Their
 * subject is "a visible item that is not empty", a compound with no class, tag
 * or attribute for the browser to bucket the rule under, so every change has
 * the browser try the whole page against them. The replacement spreads that
 * subject over the flow's children by what the host puts on each one when it
 * creates it — a flow block, the running line, a submission's echo, a steering
 * bubble, the flow slot — so only those are tried, and a child is tried from
 * the moment it exists: the host inserts one and reads the layout in the same
 * task (D78). The flow-child mark the keeper writes catches a child of any
 * other kind, from its observer on.
 *
 * Each branch weighs what the subject weighed: `[hidden]` joins the empty test
 * in one `:not()`, which counts only the heavier of the two, and the key takes
 * the place that frees. Every key stands on a child of the column or the flow
 * slot, so the branches together select what the subject selected there.
 */
const FLOW = CHAT_FLOW_SLOT_SELECTOR
const EMPTY = `.{item}:is(:empty, :has(> ${CHAT_NODE_SELECTOR}:empty))`
const VISIBLE = `:not([hidden]):not(${EMPTY})`
const NOT_RUNNING = ':not(.{running})'
const SCOPE = `:is(.{column}, ${FLOW})`
const SUBJECT_KEYS = [FLOW_BLOCK_SELECTOR, CHAT_RUNNING_SELECTOR, SUBMISSION_ECHO_SELECTOR, PENDING_STEERING_SELECTOR, FLOW, `[${FLOW_CHILD_ATTR}]`]

/**
 * One gap rule, given as its complex selectors: each that ends in the visible
 * subject is spread over the subject keys, the rest stand as written.
 */
function gapRule(complexes: readonly string[]) {
  const spread = complexes.flatMap((complex) => {
    for (const suffix of ['', NOT_RUNNING]) {
      const subject = VISIBLE + suffix
      if (complex.endsWith(subject)) return SUBJECT_KEYS.map((key) => `${complex.slice(0, -subject.length)}${key}:not([hidden], ${EMPTY})${suffix}`)
    }
    return [complex]
  })
  return selectorShape(complexes.join(', '), spread.join(', '))
}

/** The gap above every visible item after the first, and above the first one after older turns. */
const GAP = gapRule([`${SCOPE} > ${VISIBLE} ~ ${VISIBLE}`, `.{column}:has(> .{older}) > ${FLOW} > ${VISIBLE}`])
/** The wider gap after a step's output. */
const GAP_AFTER_RESPONSE = gapRule([`.{item}[${CHAT_GROUP_PART_ATTRIBUTE}="${CHAT_GROUP_PART_RESPONSE}"]`, `${SCOPE} > [${CHAT_GROUP_PART_ATTRIBUTE}="${CHAT_GROUP_PART_RESPONSE}"]:not([hidden]):not(:empty) + ${VISIBLE}${NOT_RUNNING}`])
/** The widest gap, after a turn's process group. */
const GAP_AFTER_PROCESS = gapRule([`.{item}[${FLOW_KIND_ATTRIBUTE}="${TURN_PROCESS_ROW_KIND}"]`, `.{item}[${TURN_PROCESS_ANSWER_ATTRIBUTE}]`, `${SCOPE} > [${FLOW_KIND_ATTRIBUTE}="${TURN_PROCESS_ROW_KIND}"] + ${VISIBLE}${NOT_RUNNING}`])

const CHAT_FLOW: SodiumAdapter = {
  id: 'chat-flow',
  owner: '@deepseek-ai/dsh-client-ui-chat',
  sheet: '@deepseek-ai/dsh-client-ui-chat/ChatView.module.css',
  rewrite: firstShape([GAP, GAP_AFTER_RESPONSE, GAP_AFTER_PROCESS]),
  maintain: (captured) => keepFlowChildMark(captured.get('column') ?? [], FLOW_CHILD_ATTR),
}

export const SODIUM_MEMBERS: readonly SodiumMember[] = [
  { id: 'DeepSeek Harness', release: 'host', since: '0.2.1-rc.2', adapters: [CHAT_FLOW] },
]
