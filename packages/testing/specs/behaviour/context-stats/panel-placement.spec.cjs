/**
 * The context popover opens over the meter and stays inside the window at the
 * page's own scale and under the reader's page zoom alike. The host places it
 * from the anchor's own box, which comes back in the window's pixels while the
 * page's zoom scales what the host writes into the inline style again.
 *
 * @capability context-stats
 * @features context-stats
 * @risk Under a page zoom the context popover opens a factor of its anchor's distance too low and runs past the window's bottom edge, so its last rows — model time, tool time, the first token's average, output speed — cannot be read.
 */
'use strict'
const { spec } = require('../../fixtures/behaviour.cjs')

/**
 * The stand-in's composer rides the document flow; the host keeps it at the
 * window's bottom, which is the only place the popover's own placement means
 * anything — the popover opens upward from a trigger standing there. The
 * stack holding the card and its dock is pinned the way the host pins it.
 */
async function seatComposer(t) {
  await t.page.evaluate((card) => {
    const stack = document.querySelector(card).parentElement
    Object.assign(stack.style, { position: 'fixed', left: '8px', right: '8px', bottom: '8px' })
  }, t.host('composer.card'))
  await t.page.waitForTimeout(500)
}

/**
 * The popover's own box, the meter's box and the window's, once the skin has
 * marked the panel as placed.
 */
async function readPlacement(t, panel) {
  return t.page.evaluate(([selector, meterSelector, placedMark]) => {
    const element = document.querySelector(selector)
    const meter = document.querySelector(meterSelector)
    if (element === null || meter === null) return null
    const box = element.getBoundingClientRect()
    const anchor = meter.getBoundingClientRect()
    return {
      placed: element.hasAttribute(placedMark),
      panel: { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height },
      meter: { top: anchor.top, left: anchor.left, right: anchor.right },
      window: { width: innerWidth, height: innerHeight },
      zoom: Number.parseFloat(getComputedStyle(document.body).zoom) || 1,
    }
  }, [panel, `[${t.surface.attribute('stats.context-meter')}]`, t.surface.attribute('stats.context-panel-placed')])
}

/** Open the popover through the host's meter and wait for the skin's placement. */
async function openPanel(t) {
  const panel = `[${t.surface.attribute('stats.context-panel')}]`
  const meterButton = `[${t.surface.attribute('stats.context-meter')}] button`
  await t.page.locator(meterButton).click()
  await t.page.locator(panel).waitFor({ state: 'visible' })
  await t.page.waitForFunction(([selector, mark]) => document.querySelector(selector)?.hasAttribute(mark) === true,
    [panel, t.surface.attribute('stats.context-panel-placed')], { timeout: 10000 })
  // The panel's entrance is an animation: its box settles a moment after it opens.
  await t.page.waitForTimeout(400)
  return panel
}

/** The panel stands above the meter, by the host's own gap, and inside the window. */
function judgeThePlacement(t, reading, label) {
  t.expectThat.visible(reading === null ? null : reading.panel, `the context popover is drawn (${label})`)
  if (reading === null) return
  t.expectThat.equal(reading.placed, true, `the skin has placed the popover (${label})`)
  // The host's gap is measured in the page's own pixels, so the window shows it
  // at the page's scale.
  const gap = (reading.meter.top - reading.panel.bottom) / reading.zoom
  t.expectThat.equal(gap >= 7 && gap <= 9, true, `the popover opens over the meter by the host's own gap, ${gap.toFixed(1)}px above it (${label})`)
  t.expectThat.boxWithin(reading.panel,
    { left: 0, top: 0, right: reading.window.width, bottom: reading.window.height, width: reading.window.width, height: reading.window.height },
    `the popover stays inside the window (${label})`, 1)
}

module.exports = spec({ page: 'context-stats' }, ({ test }) => {
  test('the context popover opens over the meter, inside the window', async (t) => {
    await seatComposer(t)
    const panel = await openPanel(t)
    judgeThePlacement(t, await readPlacement(t, panel), 'at the page\'s own scale')
  })

  test('under page zoom the context popover still opens over the meter, inside the window', async (t) => {
    await seatComposer(t)
    await t.prefs({ pageZoom: '1.25' })
    // The zoom is what this reading is about, so it is judged too: a preference
    // that never reached the page would leave the placement at 100% and the
    // comparison would pass over a state nothing exercised.
    t.expectThat.equal(await t.read.attribute('body', t.surface.attribute('skin.page-zoom')), '1.25', 'the page zoom reaches the document')
    t.expectThat.equal(await t.read.computed('body', 'zoom'), '1.25', 'the page is drawn at 125%')
    const panel = await openPanel(t)
    judgeThePlacement(t, await readPlacement(t, panel), 'at 125%')
  })
})
