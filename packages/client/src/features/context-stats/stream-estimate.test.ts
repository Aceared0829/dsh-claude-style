import { afterEach, expect, test } from 'vitest'
import { createStreamEstimate } from './stream-estimate'

/**
 * The estimate behind the written-back figure: the text a streaming answer has
 * grown by is counted at its rough token share, a settlement restarts it, and a
 * container's text already on the page when the reader first looks is a
 * baseline rather than a fresh count.
 */

/** One streaming container under `parent`, holding `text`. */
function streaming(parent: Node, text = '') {
  const container = document.createElement('div')
  container.setAttribute('data-streaming', '')
  container.textContent = text
  parent.appendChild(container)
  return container
}

/** Let the bus deliver the nodes just added, so the cached host seats are queried again. */
const flushMutations = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  document.body.replaceChildren()
})

test('the text that arrives after the first reading is counted at its token share', () => {
  const container = streaming(document.body, 'hello')
  const estimate = createStreamEstimate()
  expect(estimate.tokens(1000)).toBe(0)
  container.textContent = 'hello world'
  expect(estimate.tokens(2000)).toBeCloseTo(1.5)
})

test('a wide character counts for more than a narrow one', () => {
  const container = streaming(document.body, '')
  const estimate = createStreamEstimate()
  estimate.tokens(1000)
  container.textContent = '你好'
  expect(estimate.tokens(2000)).toBeCloseTo(1.2)
})

test('the page is read again only once the interval has passed', () => {
  const container = streaming(document.body, '')
  const estimate = createStreamEstimate()
  estimate.tokens(1000)
  container.textContent = 'abcd'
  expect(estimate.tokens(1050)).toBe(0)
  expect(estimate.tokens(1100)).toBeCloseTo(1)
})

test('a settlement restarts the estimate, and the text it covers is not counted again', () => {
  const container = streaming(document.body, '')
  const estimate = createStreamEstimate()
  estimate.settle(500)
  estimate.tokens(1000)
  container.textContent = 'abcd'
  expect(estimate.tokens(1100)).toBeCloseTo(1)
  estimate.settle(700)
  expect(estimate.tokens(1200)).toBe(0)
  expect(estimate.tokens(1300)).toBe(0)
  container.textContent = 'abcdef'
  expect(estimate.tokens(1400)).toBeCloseTo(0.5)
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
  expect(estimate.tokens(1100)).toBeCloseTo(0.25)
})

test('a container that left the page stops counting, and one that arrives later starts from its own text', () => {
  const container = streaming(document.body, '')
  const estimate = createStreamEstimate()
  estimate.tokens(1000)
  container.textContent = 'abcd'
  expect(estimate.tokens(1100)).toBeCloseTo(1)
  container.remove()
  expect(estimate.tokens(1200)).toBeCloseTo(1)
  streaming(document.body, 'efgh')
  expect(estimate.tokens(1300)).toBeCloseTo(1)
})

test('only the shown conversation\'s stream is counted', async () => {
  const scroller = document.createElement('div')
  scroller.setAttribute('data-conversation-scroll', '')
  document.body.appendChild(scroller)
  const inside = streaming(scroller, '')
  const outside = streaming(document.body, '')
  await flushMutations()
  const estimate = createStreamEstimate()
  estimate.tokens(1000)
  inside.textContent = 'abcd'
  outside.textContent = 'efgh'
  expect(estimate.tokens(1100)).toBeCloseTo(1)
})

test('a session switch forgets the text of the session before', () => {
  const container = streaming(document.body, '')
  const estimate = createStreamEstimate()
  estimate.settle(500)
  estimate.tokens(1000)
  container.textContent = 'abcd'
  expect(estimate.tokens(1100)).toBeCloseTo(1)
  estimate.reset()
  expect(estimate.tokens(1200)).toBe(0)
  container.textContent = 'abcdef'
  expect(estimate.tokens(1300)).toBeCloseTo(0.5)
})
