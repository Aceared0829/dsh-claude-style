import { expect, test, vi } from 'vitest'
import { createSlidingPill } from './sliding-pill'

/**
 * The segmented controls' sliding highlight (shared/sliding-pill.ts): a reading
 * belongs to the pass that took it, and a press that moves the active item
 * before the next pass must not place the pill from it. The search palette
 * places its pill from its own render, between two passes.
 */

function control() {
  const bar = document.createElement('div')
  bar.style.cssText = 'display: flex; gap: 4px; width: 200px; height: 20px'
  for (const width of [40, 80]) {
    const item = document.createElement('button')
    item.style.cssText = `width: ${width}px; height: 20px; padding: 0; border: 0`
    item.setAttribute('aria-checked', String(width === 40))
    bar.append(item)
  }
  document.body.append(bar)
  return bar
}

/** The pill's written placement, and the box the item it should sit under has. */
function written(bar: HTMLElement) {
  return {
    x: parseFloat(bar.style.getPropertyValue('--dsh-claude-pill-x')),
    w: parseFloat(bar.style.getPropertyValue('--dsh-claude-pill-w')),
  }
}

function placement(bar: HTMLElement, item: Element) {
  const barBox = bar.getBoundingClientRect()
  const itemBox = item.getBoundingClientRect()
  return {
    x: Math.round((itemBox.left - barBox.left - bar.clientLeft) * 100) / 100,
    w: Math.round(itemBox.width * 100) / 100,
  }
}

test('a pass\'s reading places the pill in that pass, without reading the page again', () => {
  const bar = control()
  const pill = createSlidingPill('[aria-checked="true"]')
  try {
    pill.sync(bar)
    const read = vi.spyOn(bar, 'getBoundingClientRect')
    pill.measure(bar)
    expect(read).toHaveBeenCalledTimes(1)
    pill.sync(bar)
    expect(read).toHaveBeenCalledTimes(1)
  } finally {
    pill.release()
    bar.remove()
  }
})

test('a press that moves the active item before the next pass places the pill under the item it selected', () => {
  const bar = control()
  const pill = createSlidingPill('[aria-checked="true"]')
  try {
    const [first, second] = bar.children
    pill.sync(bar)
    expect(written(bar)).toEqual(placement(bar, first))
    // The press moves the active item and the control is placed from its own
    // render, before the next pass's read phase: the reading standing is the
    // one taken while the first item was still the active one.
    first.setAttribute('aria-checked', 'false')
    second.setAttribute('aria-checked', 'true')
    pill.sync(bar)
    expect(written(bar)).toEqual(placement(bar, second))
  } finally {
    pill.release()
    bar.remove()
  }
})

test('a press the pass already read places the pill without reading the page again', () => {
  const bar = control()
  const pill = createSlidingPill('[aria-checked="true"]')
  try {
    pill.sync(bar)
    pill.measure(bar)
    const read = vi.spyOn(bar, 'getBoundingClientRect')
    pill.sync(bar)
    expect(read).not.toHaveBeenCalled()
  } finally {
    pill.release()
    bar.remove()
  }
})
