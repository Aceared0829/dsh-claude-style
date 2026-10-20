/**
 * What one session has cost so far, from the durable settlement records.
 *
 * The fold is the same one `usage-fold.ts` makes for days, carried one step
 * further: every `assistant/message` or `assistant/attempt` that reports usage
 * is priced at its own `time` and its own route, and a retry replaces the
 * sample it re-reports. The price table supplies both currencies, so one fold
 * answers either setting.
 *
 * The totals are kept per session in memory and advanced from `session/event`
 * as the host commits, which is what makes the route O(1) after the first read.
 * A session first asked about is folded from its stored log; a host restart
 * loses the memory and refolds on the next ask, so the figure survives it. A
 * replaced price table clears every total: the next ask re-prices the log
 * against the table in force, the way the plugins that keep a ledger do not.
 */
import { PACKAGE_NAME } from '@dsh-claude-style/contracts/package'
import { costMicro, priceFor, priceTierAt } from '@dsh-claude-style/contracts/prices'
import type { PriceDocument, PriceUsage, SessionCostAnswer } from '@dsh-claude-style/contracts/prices'
import type { DshContext } from '@dsh-claude-style/engine/node/dsh'
import { readEvents } from '@dsh-claude-style/engine/node/session-events'
import { modelOf, usageOf } from './usage-fold.js'
import type { UsageEvent } from './usage-fold.js'
import type { PriceStore } from './prices.js'

/** The sessions whose totals are kept before the oldest is forgotten. */
const KEPT_SESSIONS = 128

/** One priced settlement, kept so a retry can take it back out. */
interface Settlement {
  turn?: number
  step?: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  cny: number
  usd: number
}

/** One session's running totals. */
interface CostState {
  cny: number
  usd: number
  partial: boolean
  /** The settlement a re-report on the same turn/step replaces. */
  last: Settlement | null
  /** The route the session last named, for a settlement that names none. */
  model: string | null
}

function count(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function usageOfSample(event: UsageEvent): PriceUsage | null {
  const sample = usageOf(event)
  if (sample === undefined) return null
  return {
    input: count(sample.inputTokens),
    output: count(sample.outputTokens),
    cacheRead: count(sample.cacheReadTokens),
    cacheWrite: count(sample.cacheWriteTokens),
  }
}

function sameUsage(settlement: Settlement, usage: PriceUsage) {
  return settlement.input === usage.input && settlement.output === usage.output
    && settlement.cacheRead === usage.cacheRead && settlement.cacheWrite === usage.cacheWrite
}

/**
 * One committed event folded into a session's totals.
 *
 * @returns a new state, or the same reference when the event moves no figure.
 */
export function applyCostEvent(state: CostState, event: UsageEvent, document: PriceDocument): CostState {
  const type = event?.type
  if (type === 'llm/retry-started') {
    const turn = event.data?.turn
    const step = event.data?.step
    if (state.last !== null && state.last.turn === turn && state.last.step === step) {
      return { ...state, last: null }
    }
    return state
  }
  if (type !== 'assistant/message' && type !== 'assistant/attempt') return state
  const usage = usageOfSample(event)
  if (usage === null) {
    // An attempt that reports no usage may still name the route for a later
    // settlement that does not.
    const named = modelOf(event)
    return named === null || named === state.model ? state : { ...state, model: named }
  }
  const time = event.time
  const model = modelOf(event) ?? state.model
  if (typeof time !== 'number' || !Number.isFinite(time)) return state
  let cny = 0
  let usd = 0
  let partial = state.partial
  const priced = (currency: 'CNY' | 'USD') => {
    const price = model === null ? undefined : priceFor(document, model, currency)
    if (price === undefined) return null
    return costMicro(usage, priceTierAt(price, time, document.schedule))
  }
  const cnyCost = priced('CNY')
  const usdCost = priced('USD')
  if (cnyCost === null || usdCost === null) partial = true
  cny = cnyCost ?? 0
  usd = usdCost ?? 0
  const turn = event.data?.turn
  const step = event.data?.step
  const previous = state.last
  const replacing = previous !== null && previous.turn === turn && previous.step === step
  if (replacing && previous !== null && sameUsage(previous, usage)) return state
  const takeBack = replacing && previous !== null ? previous : null
  return {
    cny: Math.max(0, state.cny - (takeBack?.cny ?? 0) + cny),
    usd: Math.max(0, state.usd - (takeBack?.usd ?? 0) + usd),
    partial,
    last: {
      ...(turn === undefined ? {} : { turn }),
      ...(step === undefined ? {} : { step }),
      ...usage,
      cny,
      usd,
    },
    model: modelOf(event) ?? state.model,
  }
}

/** A whole log's totals, for a session first asked about after a restart. */
export function foldSessionCost(events: readonly UsageEvent[], document: PriceDocument): CostState {
  let state: CostState = { cny: 0, usd: 0, partial: false, last: null, model: null }
  for (let i = 0; i < events.length; i++) state = applyCostEvent(state, events[i], document)
  return state
}

/** What the store answers for one session, or null while the log cannot be read. */
export interface SessionCostStore {
  ensure(): void
  get(sessionId: string): Promise<SessionCostAnswer | null>
  dispose(): void
}

/** How long a total is trusted without a new event before it is folded again. */
const STALE_MS = 10_000

export function createSessionCost(ctx: DshContext, prices: PriceStore): SessionCostStore {
  const states = new Map<string, CostState>()
  /** When each total was last advanced, by a live event or by a fold. */
  const touchedAt = new Map<string, number>()
  const pending = new Map<string, Promise<SessionCostAnswer | null>>()
  const offPriceChange = prices.onChange(() => {
    // The next ask re-prices the log against the table now in force.
    states.clear()
    touchedAt.clear()
  })

  function trim() {
    while (states.size > KEPT_SESSIONS) {
      const oldest = states.keys().next().value
      if (oldest === undefined || oldest === '') break
      states.delete(oldest)
      touchedAt.delete(oldest)
    }
  }

  function answer(state: CostState): SessionCostAnswer {
    return { cny: state.cny, usd: state.usd, partial: state.partial, model: state.model }
  }

  /** Price one committed event into a session already folded. */
  function observe(sessionId: string, event: UsageEvent) {
    const state = states.get(sessionId)
    if (state === undefined) return
    const document = prices.document()
    if (document === null) return
    const next = applyCostEvent(state, event, document)
    if (next !== state) states.set(sessionId, next)
    touchedAt.set(sessionId, Date.now())
  }

  function ensure() {
    if (typeof ctx.on !== 'function') return
    ctx.on('session/event', (session: { id?: unknown } | null, event: UsageEvent) => {
      const id = typeof session?.id === 'string' ? session.id : ''
      if (id !== '') observe(id, event)
    })
  }

  async function get(sessionId: string): Promise<SessionCostAnswer | null> {
    prices.ensure()
    const held = states.get(sessionId)
    const touched = touchedAt.get(sessionId)
    // A total a live event has not advanced for a while is folded again: a
    // host whose event subscription never answered still gets a current figure,
    // at the cost of one log read per session per interval.
    if (held !== undefined && touched !== undefined && Date.now() - touched < STALE_MS) return answer(held)
    const running = pending.get(sessionId)
    if (running !== undefined) return running
    const document = prices.document()
    if (document === null) return null
    const work = readEvents<UsageEvent>(ctx, PACKAGE_NAME, sessionId, 'the session cost')
      .then((events) => {
        pending.delete(sessionId)
        if (events === null) return null
        const state = foldSessionCost(events, document)
        states.set(sessionId, state)
        touchedAt.set(sessionId, Date.now())
        trim()
        return answer(state)
      }, (error: unknown) => {
        pending.delete(sessionId)
        throw error
      })
    pending.set(sessionId, work)
    return work
  }

  return {
    ensure,
    get,
    dispose() {
      offPriceChange()
      states.clear()
      touchedAt.clear()
      pending.clear()
    },
  }
}
