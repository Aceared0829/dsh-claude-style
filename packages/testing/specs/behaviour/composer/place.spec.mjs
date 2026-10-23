/**
 * The composer's place in the page belongs to the transcript, not to the host's
 * phase mark. The host grants the seat's pin, the bar behind the card and the
 * view area's content-sized height from `data-phase="active"` alone; a phase
 * mark landing on `hero` or `settling` with a message column already mounted
 * drops all three, and the composer comes to rest in the middle of the rows,
 * which paint on below it. The skin marks the conversation root while a column
 * is mounted and holds the same place from that mark.
 *
 * @capability composer
 * @features composer
 * @risk Once a conversation is showing, the composer stops following the window's bottom edge and stands in the middle of the transcript, with the rows running past it.
 */
import { spec, host, surface } from '../../fixtures/behaviour.mjs'

const SEAT = host('composer.seat')
const COLUMN = host('chat.flow')
const SCROLLER = host('chat.scroller')
const PHASE = host('shell.phase')
const MARK = surface.attribute('composer.transcript')
const PART = surface.attribute('skin.part')

/** The canvas the seat paints its bar with, in the Claude palette. */
const CANVAS = 'rgb(255, 255, 255)'

/**
 * The host's shape around a composer: a phase root, its scroll body, the view
 * area holding the message column, and the seat after them. The view area is
 * marked as the part it plays for the length of one reading — the walk would
 * take the mark back on its next pass — so the contract holds without the spec
 * spelling the host's own class. The reading of the place is kept with the
 * fixture, so both tests read it the same way.
 */
function mount(t, phase) {
  return t.page.evaluate(([seat, column, scroller, phaseAttribute, part, mark, value]) => {
    const name = (selector) => selector.slice(1, -1)
    const root = document.createElement('div')
    root.setAttribute(phaseAttribute, value)
    root.style.cssText = 'display:flex;flex-direction:column;height:200px;width:360px'
    const body = document.createElement('div')
    body.setAttribute(name(scroller), '')
    body.style.cssText = 'flex:1;min-height:0;overflow-y:auto'
    const view = document.createElement('div')
    const flow = document.createElement('div')
    flow.setAttribute(name(column), '')
    flow.style.height = '600px'
    const seatBox = document.createElement('div')
    seatBox.setAttribute(name(seat), '')
    seatBox.style.height = '40px'
    view.append(flow)
    body.append(view, seatBox)
    root.append(body)
    document.body.append(root)
    window.__debugPlace = {
      root,
      seat: seatBox,
      view,
      mark,
      phaseAttribute,
      read() {
        const paint = getComputedStyle(seatBox)
        const band = getComputedStyle(seatBox, '::before')
        // The view area's contract is read in the one frame it carries the part
        // mark: the rule is the stylesheet's, and the mark is the walk's.
        view.setAttribute(part, 'view-area')
        const flex = getComputedStyle(view).flex
        view.removeAttribute(part)
        return {
          phase: root.getAttribute(phaseAttribute),
          mark: root.hasAttribute(mark),
          position: paint.position,
          bottom: paint.bottom,
          bar: paint.backgroundColor,
          band: band.content === 'none' ? null : band.height,
          flex,
        }
      },
    }
  }, [SEAT, COLUMN, SCROLLER, PHASE, PART, MARK, phase])
}

/** Where the seat and the view area stand, read off the page. */
function readPlace(t) {
  return t.page.evaluate(() => window.__debugPlace.read())
}

/** Move the root's phase mark and read the place in the same frame. */
function readUnder(t, phase) {
  return t.page.evaluate((value) => {
    const { root, phaseAttribute } = window.__debugPlace
    const current = root.getAttribute(phaseAttribute)
    root.setAttribute(phaseAttribute, value)
    const state = window.__debugPlace.read()
    root.setAttribute(phaseAttribute, current)
    return state
  }, phase)
}

/** The mark the composer pass writes, waited for. */
function waitForMark(t, present) {
  return t.page.waitForFunction((wanted) => window.__debugPlace !== undefined &&
    window.__debugPlace.root.hasAttribute(window.__debugPlace.mark) === wanted, present, { timeout: 8000 })
}

export default spec({ page: 'composer' }, ({ test }) => {
  test('a mounted transcript holds the composer on the scrollport\'s bottom under every phase mark', async (t) => {
    await mount(t, 'active')
    await waitForMark(t, true)
    const active = await readPlace(t)
    t.expectThat.equal(active.mark, true, 'the root marked while a message column is mounted')
    t.expectThat.equal([active.position, active.bottom, active.flex], ['sticky', '0px', '1 0 auto'], 'the seat pinned and the view area content-sized under the active phase')
    t.expectThat.equal([active.bar, active.band], [CANVAS, '40px'], 'the bar and its fade band behind the card')
    // The host's other marks for a conversation: moving the mark alone must not
    // move the composer.
    for (const phase of ['hero', 'settling']) {
      t.expectThat.equal(await readUnder(t, phase), { ...active, phase }, `the composer's place under the ${phase} mark`)
    }
    await t.page.evaluate(() => { window.__debugPlace.root.remove(); delete window.__debugPlace })
  })

  test('the mark leaves with the transcript, and the place is the host\'s again', async (t) => {
    await mount(t, 'active')
    await waitForMark(t, true)
    await t.page.evaluate((column) => window.__debugPlace.root.querySelector(column).remove(), COLUMN)
    await waitForMark(t, false)
    const gone = await readPlace(t)
    t.expectThat.equal(gone.mark, false, 'the root unmarked once the column is gone')
    t.expectThat.equal([gone.position, gone.flex], ['static', '0 1 auto'], 'the seat and the view area handed back to the host')
    await t.page.evaluate(() => { window.__debugPlace.root.remove(); delete window.__debugPlace })
  })
})
