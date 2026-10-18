import { afterEach, expect, test, vi } from 'vitest'
import { createStreamEstimate } from './stream-estimate'

/**
 * The estimate behind the written-back figure: the text a streaming answer has
 * grown by is counted at its rough token share, a settlement restarts it, and a
 * container's text already on the page when the reader first looks is a
 * baseline rather than a fresh count. A tool call's arguments never reach the
 * page, so each call row of the step counts a constant instead.
 */

/** One streaming container under `parent`, holding `text`. */
function streaming(parent: Node, text = '') {
  const container = document.createElement('div')
  container.setAttribute('data-streaming', '')
  container.textContent = text
  parent.appendChild(container)
  return container
}

/** One tool call row under `parent`. */
function callRow(parent: Node) {
  const row = document.createElement('div')
  row.setAttribute('data-chat-call-id', `call_${Math.random()}`)
  parent.appendChild(row)
  return row
}

/** A watcher on the structure, the way the estimate's owner keeps one. */
function watching() {
  const estimate = createStreamEstimate()
  estimate.watch()
  return estimate
}

/** Let the bus hear the nodes just added, and the watcher take them. */
async function giveTheBusATurn() {
  // Vitest's clock stand-in leaves the observer's delivery on its own timer.
  await vi.waitFor(() => {}, { timeout: 100 })
}

afterEach(() => {
  document.body.replaceChildren()
})

test('the text that arrives after the first reading is counted at its token share', () => {
  const container = streaming(document.body, 'hello')
  const estimate = createStreamEstimate()
  expect(estimate.tokens(1000)).toBe(0)
  container.textContent = 'hello world'
  expect(estimate.tokens(2000)).toBeCloseTo(1.8)
})

test('a wide character counts for more than a narrow one', () => {
  const container = streaming(document.body, '')
  const estimate = createStreamEstimate()
  estimate.tokens(1000)
  container.textContent = '你好'
  expect(estimate.tokens(2000)).toBeCloseTo(2)
})

test('the page is read again only once the interval has passed', () => {
  const container = streaming(document.body, '')
  const estimate = createStreamEstimate()
  estimate.tokens(1000)
  container.textContent = 'abcd'
  expect(estimate.tokens(1050)).toBe(0)
  expect(estimate.tokens(1100)).toBeCloseTo(1.2)
})

test('a settlement restarts the estimate, and the text it covers is not counted again', () => {
  const container = streaming(document.body, '')
  const estimate = createStreamEstimate()
  estimate.settle(500)
  estimate.tokens(1000)
  container.textContent = 'abcd'
  expect(estimate.tokens(1100)).toBeCloseTo(1.2)
  estimate.settle(700)
  expect(estimate.tokens(1200)).toBe(0)
  expect(estimate.tokens(1300)).toBe(0)
  container.textContent = 'abcdef'
  expect(estimate.tokens(1400)).toBeCloseTo(0.6)
})

test('a reasoning body inside a streaming answer is counted once with its container', () => {
  const outer = streaming(document.body, 'abc')
  const inner = document.createElement('div')
  inner.setAttribute('data-streaming', '')
  inner.textContent = 'def'
  outer.appendChild(inner)
  const estimate = createStreamEstimate()
  estimate.tokens(1000)
  inner.append('g')
  expect(estimate.tokens(1100)).toBeCloseTo(0.3)
})

test('a container that left the page stops counting, and one that arrives later starts from its own text', () => {
  const container = streaming(document.body, '')
  const estimate = createStreamEstimate()
  estimate.tokens(1000)
  container.textContent = 'abcd'
  expect(estimate.tokens(1100)).toBeCloseTo(1.2)
  container.remove()
  expect(estimate.tokens(1200)).toBeCloseTo(1.2)
  streaming(document.body, 'efgh')
  expect(estimate.tokens(1300)).toBeCloseTo(1.2)
})

test('only the shown conversation\'s stream is counted', async () => {
  const scroller = document.createElement('div')
  scroller.setAttribute('data-conversation-scroll', '')
  document.body.appendChild(scroller)
  const inside = streaming(scroller, '')
  const outside = streaming(document.body, '')
  await giveTheBusATurn()
  const estimate = createStreamEstimate()
  estimate.tokens(1000)
  inside.textContent = 'abcd'
  outside.textContent = 'efgh'
  expect(estimate.tokens(1100)).toBeCloseTo(1.2)
})

test('a session switch forgets the text of the session before', () => {
  const container = streaming(document.body, '')
  const estimate = createStreamEstimate()
  estimate.settle(500)
  estimate.tokens(1000)
  container.textContent = 'abcd'
  expect(estimate.tokens(1100)).toBeCloseTo(1.2)
  estimate.reset()
  expect(estimate.tokens(1200)).toBe(0)
  container.textContent = 'abcdef'
  expect(estimate.tokens(1300)).toBeCloseTo(0.6)
})

test('a call row arriving while the text streams counts one call constant', async () => {
  const container = streaming(document.body, '')
  const estimate = watching()
  estimate.tokens(1000)
  container.textContent = 'abcd'
  expect(estimate.tokens(1100)).toBeCloseTo(1.2)
  callRow(document.body)
  await giveTheBusATurn()
  expect(estimate.tokens(1101)).toBeCloseTo(171.2)
  estimate.reset()
})

test('a call row counted once is not counted again when the host re-renders the step', async () => {
  const container = streaming(document.body, '')
  const estimate = watching()
  estimate.tokens(1000)
  container.textContent = 'abcd'
  expect(estimate.tokens(1100)).toBeCloseTo(1.2)
  const row = callRow(document.body)
  await giveTheBusATurn()
  expect(estimate.tokens(1101)).toBeCloseTo(171.2)
  // The step is re-rendered: the same row leaves and comes back.
  row.remove()
  document.body.appendChild(row)
  await giveTheBusATurn()
  expect(estimate.tokens(1200)).toBeCloseTo(171.2)
  estimate.reset()
})

test('the calls a settlement ends in are not counted as the next step\'s', async () => {
  const estimate = watching()
  const row = callRow(document.body)
  await giveTheBusATurn()
  estimate.tokens(1000)
  // The step ends in that call; the settlement's number holds its arguments.
  estimate.settle(400)
  expect(estimate.tokens(1100)).toBe(0)
  // That call is behind, so a call made while the next step runs counts.
  const next = callRow(document.body)
  await giveTheBusATurn()
  expect(estimate.tokens(1200)).toBe(170)
  estimate.settle(500)
  expect(estimate.tokens(1300)).toBe(0)
  row.remove()
  next.remove()
  estimate.reset()
})

test('the history a session is shown with is no call of the step now running', async () => {
  const estimate = watching()
  const row = callRow(document.body)
  await giveTheBusATurn()
  estimate.settle(200)
  expect(estimate.tokens(1000)).toBe(0)
  // The session is switched: the estimate forgets the session before, and the
  // conversation comes into the page with its history in it.
  estimate.reset()
  const scroller = document.createElement('div')
  scroller.setAttribute('data-conversation-scroll', '')
  callRow(scroller)
  document.body.appendChild(scroller)
  await giveTheBusATurn()
  expect(estimate.tokens(1100)).toBe(0)
  // The new session's settled total arrives with its first reading, and a call
  // made while its step runs counts on its own.
  estimate.settle(300)
  callRow(scroller)
  await giveTheBusATurn()
  expect(estimate.tokens(1200)).toBe(170)
  row.remove()
  estimate.reset()
})
