/**
 * At a page zoom the page the skin draws is the window: the body takes the
 * window's own size in the page's pixels, and a box that reaches past it leaves
 * no scroll band under the shell.
 *
 * @capability page-scale
 * @features core
 * @risk At a page zoom the window scrolls past the shell through an empty band, or the shell itself is drawn a factor larger than the window.
 */
import { spec, surface } from '../../fixtures/behaviour.mjs'

const ZOOM = surface.attribute('skin.page-zoom')

/** The window, the body's drawn box and the room the scrollbar takes. */
const read = (t) => t.page.evaluate(() => {
  const body = document.body.getBoundingClientRect()
  return {
    inner: [innerWidth, innerHeight],
    body: [body.width, body.height],
    scrollbar: innerWidth - document.documentElement.clientWidth,
    scrollTop: document.scrollingElement.scrollTop,
  }
})

export default spec({ page: 'desktop' }, ({ test }) => {
  for (const zoom of ['0.8', '1.25', '1.5']) {
    test(`at a page zoom of ${zoom} the body is the window and the document does not scroll`, async (t) => {
      await t.prefs({ pageZoom: zoom })
      t.expectThat.equal(await t.read.attribute('body', ZOOM), zoom, `the page is drawn at ${zoom}`)
      // A box the size of the window, laid over the page the way a layer that
      // measures the window writes itself: `zoom` draws it a factor larger.
      await t.page.evaluate(() => {
        const tall = document.createElement('div')
        tall.id = 'debugWindowBox'
        tall.style.cssText = 'position: absolute; top: 0; left: 0; width: 10px; height: 100vh; background: currentColor;'
        document.body.append(tall)
      })
      const page = await read(t)
      t.expectThat.equal(Math.round(page.body[0]), Math.round(page.inner[0]), 'the body is as wide as the window')
      t.expectThat.equal(Math.round(page.body[1]), Math.round(page.inner[1]), 'the body is as tall as the window')
      t.expectThat.equal(page.scrollbar, 0, 'the document takes no scrollbar')
      await t.page.mouse.wheel(0, 400)
      await t.page.waitForTimeout(300)
      t.expectThat.equal((await read(t)).scrollTop, 0, 'the wheel does not scroll the document')
    })
  }
})
