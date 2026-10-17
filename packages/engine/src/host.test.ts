import { afterEach, expect, test } from 'vitest'
import { cacheFirstMatch } from './host'

/** A batch of mutations is delivered on the microtask queue. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

afterEach(() => {
  document.body.replaceChildren()
})

/** Count the whole-document queries the code under test makes. */
function countQueries() {
  const seen: string[] = []
  const original = Document.prototype.querySelector
  Document.prototype.querySelector = function patched(selector: string) {
    seen.push(selector)
    return original.call(this, selector)
  }
  return () => { Document.prototype.querySelector = original; return seen }
}

test('a seat the page does not carry is queried once, not once per read', async () => {
  const stop = countQueries()
  const find = cacheFirstMatch<HTMLElement>('[data-test-absent]')
  expect(find()).toBe(null)
  expect(find()).toBe(null)
  expect(find()).toBe(null)
  await settle()
  expect(find()).toBe(null)
  expect(stop().length).toBe(1)
})

test('a seat the page carries is queried once and then kept', () => {
  const card = document.createElement('div')
  card.setAttribute('data-test-card', '')
  document.body.appendChild(card)
  const stop = countQueries()
  const find = cacheFirstMatch<HTMLElement>('[data-test-card]')
  expect(find()).toBe(card)
  expect(find()).toBe(card)
  expect(stop().length).toBe(1)
})

test('a kept match is re-queried once an earlier match arrives', () => {
  const later = document.createElement('div')
  later.setAttribute('data-test-early', '')
  document.body.appendChild(later)
  const stop = countQueries()
  const find = cacheFirstMatch<HTMLElement>('[data-test-early]')
  expect(find()).toBe(later)
  const earlier = document.createElement('div')
  earlier.setAttribute('data-test-early', '')
  document.body.insertBefore(earlier, later)
  expect(find()).toBe(earlier)
  expect(stop().length).toBe(2)
})

test('a kept match is re-queried once the host replaces it', () => {
  const first = document.createElement('div')
  first.setAttribute('data-test-replaced', '')
  document.body.appendChild(first)
  const stop = countQueries()
  const find = cacheFirstMatch<HTMLElement>('[data-test-replaced]')
  expect(find()).toBe(first)
  const second = document.createElement('div')
  second.setAttribute('data-test-replaced', '')
  first.replaceWith(second)
  expect(find()).toBe(second)
  expect(stop().length).toBe(2)
})

test('a seat that mounts later is found after the batch that added it', async () => {
  const find = cacheFirstMatch<HTMLElement>('[data-test-late]')
  expect(find()).toBe(null)
  const seat = document.createElement('div')
  seat.setAttribute('data-test-late', '')
  document.body.appendChild(seat)
  await settle()
  expect(find()).toBe(seat)
})
