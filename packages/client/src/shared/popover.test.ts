import { expect, test, vi } from 'vitest'
import { createHoverIntent, setMenuPopoverOpen } from './popover'

/**
 * The one write that opens or closes a menu card: the card's own state and the
 * state its trigger reports are one act, and a trigger left saying "collapsed"
 * while the card is up is what makes a reader press it twice
 */

test('returning to a trigger cancels the pending close', () => {
  vi.useFakeTimers()
  const calls: string[] = []
  const intent = createHoverIntent(() => calls.push('open'), () => calls.push('close'), 100, 100)
  try {
    intent.scheduleOpen()
    vi.advanceTimersByTime(100)
    intent.scheduleClose()
    vi.advanceTimersByTime(50)
    intent.scheduleOpen()
    vi.advanceTimersByTime(100)
    expect(calls).toEqual(['open', 'open'])
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    intent.cancel()
    vi.useRealTimers()
  }
})

test('leaving a trigger cancels its pending open and closes after the grace', () => {
  vi.useFakeTimers()
  const calls: string[] = []
  const intent = createHoverIntent(() => calls.push('open'), () => calls.push('close'), 100, 100)
  try {
    intent.scheduleOpen()
    vi.advanceTimersByTime(50)
    intent.scheduleClose()
    vi.advanceTimersByTime(99)
    expect(calls).toEqual([])
    vi.advanceTimersByTime(1)
    expect(calls).toEqual(['close'])
  } finally {
    intent.cancel()
    vi.useRealTimers()
  }
})

test('entering the panel cancels pending hover work', () => {
  vi.useFakeTimers()
  const calls: string[] = []
  const intent = createHoverIntent(() => calls.push('open'), () => calls.push('close'), 100, 100)
  try {
    intent.scheduleClose()
    intent.cancel()
    vi.advanceTimersByTime(100)
    expect(calls).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    intent.cancel()
    vi.useRealTimers()
  }
})

function card() {
  const element = document.createElement('div')
  element.className = 'dsh-claude-popover-card'
  document.body.append(element)
  return element
}

function trigger() {
  const element = document.createElement('button')
  element.setAttribute('aria-haspopup', 'menu')
  document.body.append(element)
  return element
}

test('opening writes the card state, its role and the trigger\'s state together', () => {
  const popover = card()
  const button = trigger()
  setMenuPopoverOpen(popover, true, button)
  expect(popover.getAttribute('data-open')).toBe('true')
  expect(popover.getAttribute('role')).toBe('menu')
  expect(button.getAttribute('aria-expanded')).toBe('true')
  popover.remove()
  button.remove()
})

test('closing takes the role off and tells the trigger the same', () => {
  const popover = card()
  const button = trigger()
  setMenuPopoverOpen(popover, true, button)
  setMenuPopoverOpen(popover, false, button)
  expect(popover.getAttribute('data-open')).toBe('false')
  expect(popover.getAttribute('role')).toBeNull()
  expect(button.getAttribute('aria-expanded')).toBe('false')
  popover.remove()
  button.remove()
})

test('a card toggled without a trigger writes nothing but its own state', () => {
  const popover = card()
  setMenuPopoverOpen(popover, true)
  expect(popover.getAttribute('data-open')).toBe('true')
  expect(popover.getAttribute('role')).toBe('menu')
  popover.remove()
})
