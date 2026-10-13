import { afterEach, expect, test } from 'vitest'
import { foreignRunningLineOwns } from './running-owner'

const WORDS_ATTRIBUTE = 'data-dsh-claude-wait-words'
const cleanups: (() => void)[] = []
afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()!()
})

function attach() {
  const style = document.createElement('style')
  style.textContent = `[${WORDS_ATTRIBUTE}], .external-running-words { display: none }`
  const content = document.createElement('span')
  const words = document.createElement('span')
  words.textContent = 'Host status'
  const ownLine = document.createElement('span')
  ownLine.textContent = 'Theme status'
  const replacement = document.createElement('div')
  replacement.textContent = 'External status'
  content.append(words, ownLine, replacement)
  document.head.append(style)
  document.body.append(content)
  cleanups.push(() => { content.remove(); style.remove() })
  return { words, ownLine, replacement }
}

test('a visible sibling alone does not take over our own hiding of the host words', () => {
  const { words, ownLine } = attach()
  words.setAttribute(WORDS_ATTRIBUTE, '')
  expect(foreignRunningLineOwns(words, ownLine, WORDS_ATTRIBUTE)).toBe(false)
  expect(words.hasAttribute(WORDS_ATTRIBUTE)).toBe(true)
  expect(words.checkVisibility()).toBe(false)
})

test('an inline replacement takes over before or after our line mounts', () => {
  const { words, ownLine } = attach()
  words.style.display = 'none'
  ownLine.remove()
  expect(foreignRunningLineOwns(words, undefined, WORDS_ATTRIBUTE)).toBe(true)
  words.after(ownLine)
  words.setAttribute(WORDS_ATTRIBUTE, '')
  expect(foreignRunningLineOwns(words, ownLine, WORDS_ATTRIBUTE)).toBe(true)
  expect(words.hasAttribute(WORDS_ATTRIBUTE)).toBe(true)
})

test('external CSS still hides the words while our own marker is excluded', () => {
  const { words, ownLine } = attach()
  words.className = 'external-running-words'
  words.setAttribute(WORDS_ATTRIBUTE, '')
  expect(foreignRunningLineOwns(words, ownLine, WORDS_ATTRIBUTE)).toBe(true)
  words.className = ''
  expect(foreignRunningLineOwns(words, ownLine, WORDS_ATTRIBUTE)).toBe(false)
})

test.each(['display:none', 'visibility:hidden', 'opacity:0'])('a replacement hidden by %s does not take over', style => {
  const { words, ownLine, replacement } = attach()
  words.style.display = 'none'
  replacement.style.cssText = style
  expect(foreignRunningLineOwns(words, ownLine, WORDS_ATTRIBUTE)).toBe(false)
})

test('decoration and empty or hidden text do not take over', () => {
  const { words, ownLine, replacement } = attach()
  words.style.display = 'none'
  replacement.setAttribute('aria-hidden', 'true')
  expect(foreignRunningLineOwns(words, ownLine, WORDS_ATTRIBUTE)).toBe(false)
  replacement.removeAttribute('aria-hidden')
  replacement.textContent = ' '
  expect(foreignRunningLineOwns(words, ownLine, WORDS_ATTRIBUTE)).toBe(false)
  const hiddenText = document.createElement('span')
  hiddenText.hidden = true
  hiddenText.textContent = 'Hidden status'
  replacement.append(hiddenText)
  expect(foreignRunningLineOwns(words, ownLine, WORDS_ATTRIBUTE)).toBe(false)
})

test('removing the external line or restoring the host words releases ownership', () => {
  const { words, ownLine, replacement } = attach()
  words.style.display = 'none'
  expect(foreignRunningLineOwns(words, ownLine, WORDS_ATTRIBUTE)).toBe(true)
  replacement.hidden = true
  expect(foreignRunningLineOwns(words, ownLine, WORDS_ATTRIBUTE)).toBe(false)
  replacement.hidden = false
  words.style.removeProperty('display')
  expect(foreignRunningLineOwns(words, ownLine, WORDS_ATTRIBUTE)).toBe(false)
  words.style.display = 'none'
  replacement.remove()
  expect(foreignRunningLineOwns(words, ownLine, WORDS_ATTRIBUTE)).toBe(false)
})
