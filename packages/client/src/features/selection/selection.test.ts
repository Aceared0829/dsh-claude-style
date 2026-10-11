import { afterEach, expect, test } from 'vitest'
import { WINDOW_BLUR_ATTR } from '../../constants'
import { install } from './selection'

/**
 * The one stateful thing about the selection: CSS cannot tell a focused window
 * from an unfocused one, so the focus state is mirrored onto `<body>` and the
 * stylesheet switches on it. What a test can hold is the mirror and the
 * teardown — the attribute reflects the page's own answer while the feature is
 * installed, and neither the attribute nor the listeners outlive it.
 */
const cleanups: (() => void)[] = []
afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()!()
  document.body.removeAttribute(WINDOW_BLUR_ATTR)
})

test('the flag mirrors the page\'s own focus answer while installed', () => {
  const stop = install()
  cleanups.push(stop)
  expect(document.body.hasAttribute(WINDOW_BLUR_ATTR)).toBe(!document.hasFocus())
})

test('the teardown takes the flag and the listeners with it', () => {
  const stop = install()
  stop()
  expect(document.body.hasAttribute(WINDOW_BLUR_ATTR)).toBe(false)
  // Neither event may bring the flag back once the feature is gone.
  window.dispatchEvent(new Event('blur'))
  window.dispatchEvent(new Event('focus'))
  expect(document.body.hasAttribute(WINDOW_BLUR_ATTR)).toBe(false)
})
