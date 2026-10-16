import { HDSL_ROUTE, HDSL_SKIN_ROUTE, USERNAME_MAX, USERNAME_ROUTE } from '../constants'
import { CHAT_FLOW_SELECTOR, COMPOSER_CARD_SELECTOR, COMPOSER_INPUT_SELECTOR, COMPOSER_PLACEHOLDER_SELECTOR, COMPOSER_SELECTOR, COMPOSER_STACK_SELECTOR, COMPOSER_STATS_SELECTOR, COMPOSER_STAT_SELECTOR, COMPOSER_VARIANT_ATTRIBUTE, CONVERSATION_SCROLL_SELECTOR, CONVERSATION_SESSION_ATTRIBUTE, CONVERSATION_SESSION_SELECTOR, FOOT_AREA_SELECTOR, MENU_ROLE_SELECTOR, PERMISSION_TRIGGER_SELECTOR, SIDEBAR_BRAND_SELECTOR, SIDEBAR_ROOT_SELECTOR, SIDEBAR_TOGGLE_SELECTOR, WINDOWS_MENU_SELECTOR } from '@dsh-claude-style/contracts/dom'
import type { HostAssistantStep, HostChatSnapshot, HostChatTarget, HostOutlineTurn, HostRunningCall, HostSession, HostSessionsService, HostTurn, HostUiConversationService, HostUiSessionService } from '@dsh-claude-style/contracts/services'
import { readPrefs } from './prefs'
import { observeMatches, subscribeMutations } from './bus'
import { closestFrom } from '../shared/dom'
import { createHostResource } from '../shared/resource'

/**
 * The host's client context (cordis), handed to `apply` and to every feature.
 * Services come by name; their shapes are the host's own and stay untyped
 * here until the contract module types them (D44).
 */
export interface HostContext {
  /** The loader's fiber; its boot entry id names this plugin's settings namespace (D60). */
  readonly fiber?: { entry?: { id?: unknown } }
  /** A service by name, or undefined when the host carries none (D12). */
  get(name: string): HostValue
  /** Listen to a context event (`connection/reset`); the function it returns stops listening. */
  on?(name: string, listener: () => void): () => void
  /** Run `effect` now; the function it returns runs when the context is disposed. */
  effect(effect: () => () => void, label?: string): void
  /** Run `callback` in a scope once every named service exists; a host without it has no late services. */
  inject?(names: string[], callback: (scope: HostContext) => void): HostFiber
}

/**
 * A value read off a host service or snapshot: a session, a catalog group, a
 * chat node. Its shape is the host's own; the contract module types the ones
 * the skin reads by name (D44, `contracts/services.ts`).
 */
export type HostValue = any

/** A host locale namespace's translate seat (`locale.bind(namespace)`): a key and its parameters to text. */
export type { HostText } from '@dsh-claude-style/contracts/services'

/** The scope `inject` opened: disposing it runs the effects registered in it. */
export interface HostFiber {
  dispose(): void
}

/**
 * Whether `element` is still the document's first match: it is connected, it
 * matches itself, and no earlier sibling subtree holds a match. The sibling
 * walk is short for these seats (a header, a card, a footer), which the host
 * mounts once and replaces whole.
 */
function stillFirstMatch(element: Element, selector: string) {
  if (!element.isConnected || !element.matches(selector)) return false
  for (let node: Element | null = element; node !== null; node = node.parentElement) {
    for (let earlier = node.previousElementSibling; earlier !== null; earlier = earlier.previousElementSibling) {
      if (earlier.matches(selector) || earlier.querySelector(selector) !== null) return false
    }
  }
  return true
}

/**
 * The first match of `selector`, resolved once and kept while it stays the
 * first match (D40): a pass re-reads it, and the document is queried again only
 * when the host replaced the element or mounted one before it. The answer is
 * the one a query gives — an earlier match invalidates the kept element.
 *
 * An answer of "nothing matched" is kept for the rest of the batch too. The
 * query walks the whole document, and the seats asked for here are absent on
 * most of the pages a pass runs over — the hero root on a conversation page,
 * the settings nav list away from the dialog — so a query re-issued per pass
 * paid a document walk for an answer that only the host's own mounting can
 * change. A batch that adds or removes nodes asks for the query once more, and
 * this subscription exists whether or not a reader has asked for anything yet,
 * so no answer is kept across a mount.
 *
 * Exported for the seats one feature alone reads (a header, a slot, a meter):
 * the mechanism lives once, the selector stays with its reader.
 */
export function cacheFirstMatch<T extends Element>(selector: string) {
  let kept: T | null = null
  let answered = false
  // The subscription outlives the reader on purpose: a generation whose
  // teardown a client reload dropped would otherwise keep an answer with
  // nothing left to clear it.
  subscribeMutations(document.body, { subtree: true, childList: true }, () => {
    kept = null
    answered = false
  })
  return () => {
    if (kept !== null && stillFirstMatch(kept, selector)) return kept
    if (kept === null && answered) return null
    kept = document.querySelector<T>(selector)
    answered = true
    return kept
  }
}

function cacheFirst<T extends Element>(selector: string) {
  return cacheFirstMatch<T>(selector)
}

/**
 * The host's access-mode trigger: the button its permission slot renders.
 * Every slot render site carries a `[data-slot="<key>"]` wrapper (D19), and
 * the skin inserts its own buttons inside that wrapper, so those are skipped.
 */
export const findAccessTrigger = cacheFirst<HTMLButtonElement>(PERMISSION_TRIGGER_SELECTOR)

/** The sidebar footer, where the account row and the plugin footer entries live. */
export const findFootArea = cacheFirst<HTMLElement>(FOOT_AREA_SELECTOR)

/**
 * The sidebar's own column. The skin's sidebar-side nodes live inside it, so a
 * sweep for its own strays is scoped here instead of the whole document; the
 * host mounts this column once and replaces it whole.
 */
export const findSidebarRoot = cacheFirst<HTMLElement>(SIDEBAR_ROOT_SELECTOR)

/**
 * The sidebar's brand row and its collapse toggle, and the desktop window's own
 * menu button beside them: the seats the surface switch and the header band are
 * placed against (features/surface, features/header-band). Each is absent on
 * most pages — no desktop window in a browser, no toggle in the collapsed rail —
 * so the answer is kept rather than queried per pass.
 */
export const findSidebarBrand = cacheFirst<HTMLElement>(SIDEBAR_BRAND_SELECTOR)
export const findSidebarToggle = cacheFirst<HTMLElement>(SIDEBAR_TOGGLE_SELECTOR)
export const findWindowsMenu = cacheFirst<HTMLElement>(WINDOWS_MENU_SELECTOR)

/**
 * The open host menu card: the host portals its menus to `<body>`, and every
 * card the skin builds itself carries a `dsh-claude-` class (D3). The account
 * row and the hero menu ask this same question on every pass, so it is read
 * once here and kept until the page's structure changes — a menu opening or
 * closing is a node arriving or leaving (D40).
 */
export const findHostMenu = cacheFirst<HTMLElement>(`${MENU_ROLE_SELECTOR}:not([class*="dsh-claude-"])`)

/**
 * The host's composer card — the element the skin's composer rules hang on —
 * and the placeholder its editor draws. The card's variant is the skin's own
 * marking (D9); every reader goes through these, so the selectors live once.
 */
const COMPOSER_CARD = COMPOSER_CARD_SELECTOR
const COMPOSER_PLACEHOLDER = COMPOSER_PLACEHOLDER_SELECTOR

/** The composer cards, kept current by the bus instead of queried every pass (D40). */
export function observeComposerCards() {
  return observeMatches<HTMLElement>(COMPOSER_CARD)
}

/** The composer placeholders, kept current by the bus (D40); the skin's synthetic one is a match too. */
export function observeComposerPlaceholders() {
  return observeMatches<HTMLElement>(COMPOSER_PLACEHOLDER)
}

export const findComposerCard = cacheFirst<HTMLElement>(COMPOSER_CARD)

/** The composer card `node` sits in, or null; `variant` narrows it to one variant. */
export function closestComposerCard(node: EventTarget | null | undefined, variant?: string) {
  if (variant === undefined) return closestFrom(node, COMPOSER_CARD)
  return closestFrom(node, `${COMPOSER_CARD}[${COMPOSER_VARIANT_ATTRIBUTE}="${variant}"]`)
}

export function findComposerPlaceholder(card: Element) {
  return card.querySelector<HTMLElement>(COMPOSER_PLACEHOLDER)
}

/**
 * The host's statistics in the composer stack: the container an older client
 * marked around them, else the element the marked figures share. Null when the
 * host draws none, which every reader tolerates.
 */
export function findComposerStats() {
  const bar = document.querySelector<HTMLElement>(COMPOSER_STATS_SELECTOR)
  if (bar !== null) return bar
  const figure = document.querySelector<HTMLElement>(COMPOSER_STAT_SELECTOR)
  return figure === null ? null : figure.parentElement
}

/** The editable draft inside `scope`: the element the caret and the send flight read. */
export function findComposerInput(scope: ParentNode = document) {
  return scope.querySelector<HTMLElement>(COMPOSER_INPUT_SELECTOR)
}

/**
 * The composer seat around `scope`: a pointer or key inside it is the reader
 * typing, which the scroll owner reads as intent that is not a scroll (D41).
 */
export function findComposerSeat(scope: ParentNode = document) {
  return scope.querySelector<HTMLElement>(COMPOSER_SELECTOR)
}

/** The session scroller: the element the host hangs its own follow off (D41). */
export const findConversationScroller = cacheFirst<HTMLElement>(CONVERSATION_SCROLL_SELECTOR)

/** The chat columns on the page: the root every chat-area behaviour scopes to. */
export function findChatFlows() {
  return document.querySelectorAll<HTMLElement>(CHAT_FLOW_SELECTOR)
}

/** The shown conversation: the element carrying its session id, and the id itself. */
const CONVERSATION_SESSION_ATTR = CONVERSATION_SESSION_ATTRIBUTE
const CONVERSATION_SESSION = `[${CONVERSATION_SESSION_ATTR}]`

/**
 * The shown conversation, kept while it stays the document's first match: a
 * session switch mounts the next one, and an earlier match invalidates the
 * kept element as a fresh query would answer with it.
 */
export const findConversationSession = cacheFirst<HTMLElement>(CONVERSATION_SESSION_SELECTOR)

export function closestConversationSession(node: EventTarget | null | undefined) {
  return closestFrom(node, CONVERSATION_SESSION)
}

/** The session id `host` carries, or null when it carries none. */
export function conversationSessionId(host: Element | null | undefined) {
  if (host === null || host === undefined) return null
  const id = host.getAttribute(CONVERSATION_SESSION_ATTR)
  return typeof id === 'string' ? id : null
}

/**
 * The host's composer stack (ui-conversation's `.composerStack`): the composer
 * card with the cards stacked above it, and on the new-session page the hero
 * around them.
 */
export const COMPOSER_STACK = COMPOSER_STACK_SELECTOR

/**
 * The selected session id. dsh 0.2 moved it off the list snapshot onto the
 * `uiSession` service; the legacy `list.current` is read as a fallback so
 * older hosts keep working.
 */
export function currentSessionId(ctx: HostContext, sessions: HostSessionsService): string | null | undefined {
  const uiSession = ctx.get('uiSession') as HostUiSessionService | undefined
  const value = uiSession?.current?.value
  if (typeof value?.key === 'string') return value.key
  return sessions.list.getSnapshot().current
}

export function currentSession(ctx: HostContext): HostSession | null {
  const sessions = ctx.get('sessions') as HostSessionsService | undefined
  if (sessions === undefined || sessions === null) return null
  const id = currentSessionId(ctx, sessions)
  if (id === undefined || id === null) return null
  const binding = sessions.binding(id)
  if (binding === undefined || binding === null) return null
  return binding.session === undefined ? null : binding.session
}

/**
 * One session's chat target (ui-chat's `chat` target of uiConversation): the
 * loaded window's nodes, turns and turn navigation, as the host's own chat
 * view reads them. The host builds the target only for a subscriber or while
 * the shell shows that session's chat view, so a bare read on the trajectory
 * view sees nothing.
 */
export function findChatTarget(ctx: HostContext, sessionId: string): HostChatTarget | null {
  const conversation = ctx.get('uiConversation') as HostUiConversationService | undefined
  const sessions = ctx.get('sessions') as HostSessionsService | undefined
  if (!conversation || !sessions?.binding(sessionId)) return null
  return conversation.binding(sessionId).target('chat') ?? null
}

/**
 * What an open turn is doing, read off the host's chat snapshot: its newest
 * step's assistant output while that streams (`newest` is the kind of its
 * newest block, null before the first), else `{ kind: 'tools', call }` with the
 * call the host reports in flight — its block carries the tool's name and the
 * arguments it has received — else null: the turn waits on the model.
 */
export function readTurnActivity(snapshot: HostChatSnapshot, turn: HostTurn): TurnActivity | null {
  const step = turn.steps.length === 0 ? undefined : turn.steps[turn.steps.length - 1]
  const assistant = step === undefined ? undefined : step.data.get('assistant-step')
  if (assistant !== undefined && assistant.status === 'running') {
    const blocks = assistant.blocks
    return { kind: 'assistant', assistant, newest: blocks.length === 0 ? null : blocks[blocks.length - 1].kind }
  }
  // The host orders the calls in flight by where they stand in the turn, so the
  // last of this turn's is the one the model is on now.
  const calls = snapshot.legacy?.runningCalls ?? []
  let running: HostRunningCall | undefined
  for (let i = 0; i < calls.length; i++) {
    if (calls[i].turn === turn.turn) running = calls[i]
  }
  return running === undefined ? null : { kind: 'tools', call: running }
}

/** What an open turn is doing (readTurnActivity). */
export type TurnActivity = { kind: 'assistant', assistant: HostAssistantStep, newest: string | null } | { kind: 'tools', call: HostRunningCall }

export function currentPreset(session: HostSession): string | null {
  const snapshot = session.projections?.faceOf('permissions').getSnapshot()
  if (snapshot === undefined || snapshot === null) return null
  // dsh 0.2+ projection faces hand back the bare value; older hosts wrapped it.
  if (typeof snapshot === 'object' && 'currentValue' in snapshot) return (snapshot as { currentValue: string }).currentValue
  return typeof snapshot === 'string' ? snapshot : null
}

/**
 * One session's whole-log turn outline (the host's `turnOutline` projection):
 * `{ turn, seq, prompt, response }` per started turn, or undefined where the
 * assembly does not mount that projection. `seq` is the turn's `turn/start`
 * event, which is what the host's own jump pages history through (D34).
 */
export function sessionOutline(ctx: HostContext, sessionId: string): HostOutlineTurn[] | undefined {
  const face = ctx.get('sessions')?.binding(sessionId)?.session?.projections?.faceOf('turnOutline')
  return typeof face?.getSnapshot === 'function' ? face.getSnapshot() : undefined
}

/**
 * The turn holding one event seq: the latest outline entry at or before it. An
 * outline that does not reach that far answers null, and the caller leaves the
 * reading position where it is.
 */
export function turnForSeq(outline: HostOutlineTurn[] | undefined, seq: number): number | null {
  if (!Array.isArray(outline)) return null
  let found: number | null = null
  for (const entry of outline) {
    if (entry === null || typeof entry !== 'object') continue
    if (!Number.isSafeInteger(entry.turn) || !Number.isSafeInteger(entry.seq)) continue
    if (entry.seq > seq) continue
    if (found === null || entry.turn > found) found = entry.turn
  }
  return found
}

/**
 * The event seq a turn started at, off the same whole-log outline: what the
 * host's own jump pages history through when that turn is outside the loaded
 * window. An outline that does not hold the turn answers null.
 */
export function outlineSeq(outline: HostOutlineTurn[] | undefined, turn: number): number | null {
  if (!Array.isArray(outline)) return null
  for (const entry of outline) {
    if (entry === null || typeof entry !== 'object') continue
    if (entry.turn !== turn || !Number.isSafeInteger(entry.seq)) continue
    return entry.seq
  }
  return null
}

/**
 * Who the skin shows. Nickname: the custom nickname, the signed-in account's
 * name, the HDSL launcher's account name, the cached OS-user probe, the fresh
 * probe. Picture: the signed-in account's avatar, the HDSL launcher's avatar,
 * then nothing, which lets the brand mark show (D15).
 */
export let accountName = ''
export let accountAvatar = ''

/** The account profile's contribution; called when its read answers. */
export function setAccountIdentity(name: unknown, avatar: unknown) {
  accountName = typeof name === 'string' ? name.trim() : ''
  accountAvatar = typeof avatar === 'string' ? avatar : ''
}

/**
 * The host half owns the OS user (`os.userInfo().username`); this side fetches
 * it once, caches it and mirrors the answer into local storage so a reload
 * shows the name from the first frame. No workspace parsing, no polling.
 */
let usernameFromHost = ''

/** Last OS-user probe this browser saw; the cache that outlives the page. */
const PROBED_USERNAME_KEY = 'dsh-claude-style.probed-username'
let probedUsername = readStoredProbeUsername()

function readStoredProbeUsername() {
  return localStorage.getItem(PROBED_USERNAME_KEY) || ''
}

function storeProbeUsername(value: string) {
  if (value) localStorage.setItem(PROBED_USERNAME_KEY, value)
}

/** The host half's OS user; an answer the contract does not carry is not adopted. */
const usernameResource = createHostResource(USERNAME_ROUTE, (data) => {
  if (!data || data.ok !== true || typeof data.username !== 'string') return undefined
  usernameFromHost = data.username.trim().slice(0, USERNAME_MAX)
  if (usernameFromHost) {
    probedUsername = usernameFromHost
    storeProbeUsername(usernameFromHost)
  }
  return usernameFromHost
})

export function onUsernameLoaded(listener: (username: string) => void) {
  return usernameResource.onLoaded(listener)
}

export function loadUsername() {
  usernameResource.load()
}

let hdslContract = false
let hdslName = ''
let hdslAvatar = false

/**
 * The HDSL launcher's account contract, when this instance was launched by it.
 * An answer that is no contract is not adopted, so the chain skips the
 * launcher (D15).
 */
const hdslResource = createHostResource(HDSL_ROUTE, (data) => {
  if (!data || data.ok !== true || data.contract !== true) return undefined
  hdslContract = true
  hdslName = typeof data.name === 'string' ? data.name.trim().slice(0, USERNAME_MAX) : ''
  hdslAvatar = data.hasSkinImage === true
  return true
})

export function onHdslLoaded(listener: (adopted: true) => void) {
  return hdslResource.onLoaded(listener)
}

export function loadHdsl() {
  hdslResource.load()
}

/** The nickname every skin surface shows, or '' when nothing resolved. */
export function resolveDisplayName() {
  const custom = readPrefs().username
  if (custom) return custom
  if (accountName) return accountName
  if (hdslName) return hdslName
  if (probedUsername) return probedUsername
  return usernameFromHost
}

export function getUsername() {
  return resolveDisplayName() || 'User'
}

/** The picture every skin surface shows, or '' to let the brand mark show. */
export function resolveAvatarUrl() {
  if (accountAvatar) return accountAvatar
  if (hdslContract && hdslAvatar) return HDSL_SKIN_ROUTE
  return ''
}

/** Host context reference for services that read host state outside apply(ctx)'s call stack. */
export let hostCtx: HostContext | null = null
export function setHostContext(ctx: HostContext | null) {
  hostCtx = ctx
  // A new host context means a new OS user and a new launcher, so the next
  // apply resolves again. The probe cache survives on purpose: same machine.
  usernameResource.reset()
  usernameFromHost = ''
  hdslResource.reset()
  hdslContract = false
  hdslName = ''
  hdslAvatar = false
  accountName = ''
  accountAvatar = ''
}
