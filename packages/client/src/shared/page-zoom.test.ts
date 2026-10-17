import { expect, test } from 'vitest'
import { PAGE_ZOOM_ATTR } from '../constants'
import { inPageBox, inPagePixels, pageViewport, pageZoomFactor } from './page-zoom'

/**
 * The page's own scale (settings › General): the stylesheet draws the page at
 * the factor the preference mirror puts on the document, and every geometry
 * that turns a measured box into a written length divides by it. At the
 * default nothing moves, which is what keeps the whole skin unchanged while
 * the reader follows the system.
 */

function zoomedTo(value: string) {
  document.body.setAttribute(PAGE_ZOOM_ATTR, value)
  try {
    return pageZoomFactor()
  } finally {
    document.body.removeAttribute(PAGE_ZOOM_ATTR)
  }
}

test('a page following the system measures in the viewport\'s own pixels', () => {
  document.body.removeAttribute(PAGE_ZOOM_ATTR)
  expect(pageZoomFactor()).toBe(1)
  expect(inPagePixels(120)).toBe(120)
  const box = inPageBox(new DOMRect(10, 20, 30, 40))
  expect([box.left, box.top, box.width, box.height]).toEqual([10, 20, 30, 40])
})

test('a zoomed page divides everything measured into its own pixels', () => {
  expect(zoomedTo('1.5')).toBe(1.5)
  document.body.setAttribute(PAGE_ZOOM_ATTR, '1.5')
  try {
    expect(inPagePixels(120)).toBe(80)
    expect(pageViewport()).toEqual({ width: window.innerWidth / 1.5, height: window.innerHeight / 1.5 })
    const box = inPageBox(new DOMRect(30, 60, 90, 120))
    expect([box.left, box.top, box.width, box.height]).toEqual([20, 40, 60, 80])
  } finally {
    document.body.removeAttribute(PAGE_ZOOM_ATTR)
  }
})

test('a value the sheet draws nothing at, or none at all, reads as no zoom', () => {
  expect(zoomedTo('0.8')).toBe(0.8)
  expect(zoomedTo('0')).toBe(1)
  expect(zoomedTo('fast')).toBe(1)
})
