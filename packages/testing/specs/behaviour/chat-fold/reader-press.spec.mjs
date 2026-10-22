/**
 * A press on a folding control is the host's. The skin draws the chat area's
 * folding and leaves the click itself alone: the host's own handler hears it in
 * the same task, with nothing prevented, so the host decides what the row and
 * the process group do with it and how they close.
 *
 * The stand-in page carries a DisclosureRow in the chat flow; the test mounts a
 * running process group beside it, whose header names its body the way the host's
 * ProcessGroupHeader does. A listener that runs on the click's way back up is
 * what the host's own handler is: the reading is taken in the same task the
 * click was dispatched in, so a press held back or replayed later is not seen.
 *
 * @capability chat-fold
 * @features chat-fold
 * @risk A reader's press on a folding row never reaches the host, or arrives late: the row does not fold, folds twice, or folds after the reader has moved on.
 */
import { spec, host } from '../../fixtures/behaviour.mjs'

const FLOW = host('chat.flow')
const GROUP_ATTR = host('process.group').slice(1, -1)
const BODY_ATTR = host('process.body').slice(1, -1)

/** The DisclosureRow the stand-in page already draws inside its chat flow. */
const ROW = '#debugDisclosure'
/** The process group the test mounts: its header, and the body it names. */
const HEADER = '#debugPressHeader'
const GROUP_BODY = '#debugPressBody'

/** Put a running process group beside the row: the host's aria-controls from header to body. */
function mountGroup(t) {
  return t.page.evaluate(({ flow, group, body, header, bodyId }) => {
    const root = document.querySelector(flow)
    const groupRoot = document.createElement('div')
    groupRoot.setAttribute(group, '')
    groupRoot.id = 'debugPressGroup'
    const control = document.createElement('button')
    control.type = 'button'
    control.id = header.slice(1)
    control.setAttribute('aria-expanded', 'true')
    control.setAttribute('aria-controls', bodyId.slice(1))
    const content = document.createElement('div')
    content.id = bodyId.slice(1)
    content.setAttribute(body, '')
    content.style.height = '120px'
    groupRoot.append(control, content)
    root.append(groupRoot)
  }, { flow: FLOW, group: GROUP_ATTR, body: BODY_ATTR, header: HEADER, bodyId: GROUP_BODY })
}

/**
 * Press each control once and read what the click did on its way back up, in the
 * same task: the listeners on the row itself and on the document's bubble phase,
 * and whether anything cancelled the event.
 */
function pressBoth(t) {
  return t.page.evaluate(({ row, header }) => {
    const press = (selector) => {
      const control = document.querySelector(selector)
      const seen = []
      const onControl = () => { seen.push('control') }
      const onDocument = () => { seen.push('document') }
      control.addEventListener('click', onControl)
      document.addEventListener('click', onDocument)
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, composed: true })
      control.dispatchEvent(event)
      document.removeEventListener('click', onDocument)
      control.removeEventListener('click', onControl)
      return { seen, prevented: event.defaultPrevented }
    }
    return { row: press(row), header: press(header) }
  }, { row: ROW, header: HEADER })
}

export default spec({ page: 'chat-fold' }, ({ test }) => {
  test('a press on a DisclosureRow and on a process group\'s header reaches the host itself, in the same task', async (t) => {
    await mountGroup(t)
    const pressed = await pressBoth(t)
    for (const name of ['row', 'header']) {
      const reading = pressed[name]
      // The control's own listener runs at the target and the document's on the
      // way back up: both mean the press travelled the whole path.
      t.expectThat.equal(reading.seen, ['control', 'document'], `the ${name}'s press reaching the host`)
      t.expectThat.equal(reading.prevented, false, `the ${name}'s press left unhandled by the skin`)
    }
    await t.page.evaluate(() => document.getElementById('debugPressGroup')?.remove())
  })
})
