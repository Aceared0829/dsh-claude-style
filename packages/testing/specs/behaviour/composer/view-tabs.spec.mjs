/**
 * The composer stands down only while the conversation shows a view other than
 * the chat, as the conversation's own view tabs say. A tablist another plugin
 * draws inside the composer — a popover in its toolbar, say — switches no view:
 * on the home page it is the only tablist there is, and selecting its second
 * tab leaves the composer where it was.
 *
 * @capability composer
 * @features composer
 * @risk Picking a tab in another plugin's menu inside the composer on the home page makes the whole input area vanish, leaving only the sidebar.
 */
import { spec, host, surface } from '../../fixtures/behaviour.mjs'

const SEAT = host('composer.seat')
const PHASE = host('shell.phase')
const VIEW_TABS = host('header.conversation-tabs')
const HIDDEN = surface.attribute('composer.chat-hidden')

/** A tablist of two tabs, the second selected, as markup. */
const tablist = (attribute) => `<div role="tablist"${attribute === null ? '' : ` ${attribute}=""`}>` +
  '<button type="button" role="tab" aria-selected="false">first</button>' +
  '<button type="button" role="tab" aria-selected="true">second</button></div>'

/**
 * The home page's root: a phase root holding the composer's seat, with another
 * plugin's menu in it whose tablist has its second tab selected.
 */
function mountHome(t) {
  return t.page.evaluate(([seat, phase, menu]) => {
    const root = document.createElement('div')
    root.setAttribute(phase, 'hero')
    const seatBox = document.createElement('div')
    seatBox.setAttribute(seat.slice(1, -1), '')
    seatBox.style.height = '40px'
    seatBox.innerHTML = `<div role="menu">${menu}</div>`
    root.append(seatBox)
    document.body.append(root)
    window.__debugHome = { root, seat: seatBox }
  }, [SEAT, PHASE, tablist(null)])
}

/** Whether the root is marked as showing another view, and whether the seat is drawn. */
function readHome(t) {
  return t.page.evaluate((hidden) => {
    const { root, seat } = window.__debugHome
    return { marked: root.hasAttribute(hidden), drawn: getComputedStyle(seat).display !== 'none' }
  }, HIDDEN)
}

export default spec({ page: 'composer' }, ({ test }) => {
  test('another plugin\'s tablist in the composer on the home page leaves the composer up', async (t) => {
    await mountHome(t)
    // The composer's pass runs on the page's next change: give it a frame or two.
    await t.page.waitForTimeout(150)
    t.expectThat.equal(await readHome(t), { marked: false, drawn: true }, 'the composer stays up with the plugin\'s second tab selected')
    await t.page.evaluate(() => { window.__debugHome.root.remove(); delete window.__debugHome })
  })

  test('the conversation\'s own view tabs on another view stand the composer down', async (t) => {
    await mountHome(t)
    await t.page.evaluate((tabs) => {
      const header = document.createElement('header')
      header.innerHTML = tabs
      window.__debugHome.root.prepend(header)
    }, tablist(VIEW_TABS.slice(1, -1)))
    await t.page.waitForFunction((hidden) => window.__debugHome.root.hasAttribute(hidden), HIDDEN, { timeout: 8000 })
    t.expectThat.equal(await readHome(t), { marked: true, drawn: false }, 'the composer stands down while the view tabs show another view')
    await t.page.evaluate(() => { window.__debugHome.root.remove(); delete window.__debugHome })
  })
})
