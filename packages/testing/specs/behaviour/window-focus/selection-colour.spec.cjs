/**
 * Selected text in the conversation paints in the active colour while the
 * window has focus and in the inactive grey once another window takes it, the
 * way a native editor marks a selection that is not the one keys go to.
 *
 * @capability window-focus
 * @features composer
 * @risk With two windows side by side, the reader cannot tell which one their keystrokes go to: the selection in the background window still paints in the active blue.
 */
'use strict'
const { spec } = require('../../fixtures/behaviour.cjs')

/** A paragraph in the conversation's message column, and the colour its selection paints. */
async function selectionColour(t) {
  return t.page.evaluate((flow) => {
    let paragraph = document.querySelector(`${flow} p[data-test-selection]`)
    if (paragraph === null) {
      paragraph = document.createElement('p')
      paragraph.setAttribute('data-test-selection', '')
      paragraph.textContent = 'A sentence the reader selected.'
      document.querySelector(flow).append(paragraph)
    }
    return getComputedStyle(paragraph, '::selection').backgroundColor
  }, t.host('chat.flow'))
}

/**
 * The operating system moves the focus: a headless browser has no other window
 * to raise, so the page's own focus answer and the event the system sends with
 * it stand in for that move, at the browser's boundary.
 */
async function moveFocus(t, focused) {
  await t.page.evaluate((now) => {
    Object.defineProperty(document, 'hasFocus', { value: () => now, configurable: true })
    window.dispatchEvent(new Event(now ? 'focus' : 'blur'))
  }, focused)
  await t.settle()
}

module.exports = spec({ page: 'chat-fold' }, ({ test }) => {
  test('a selection paints in the inactive colour while another window has focus, and in the active one again once it comes back', async (t) => {
    await moveFocus(t, true)
    const focused = await selectionColour(t)
    await moveFocus(t, false)
    const blurred = await selectionColour(t)
    t.expectThat.equal(blurred !== focused, true, 'the selection colour changes when the window loses focus')
    await moveFocus(t, true)
    t.expectThat.equal(await selectionColour(t), focused, 'the selection colour comes back with the focus')
  })
})
