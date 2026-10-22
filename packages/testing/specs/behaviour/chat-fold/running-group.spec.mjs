/**
 * A running process group stands open because the skin marks it, not because
 * the host's control was pressed open: the body the host folds with the
 * searchable hidden state draws a box, its header goes on saying folded, and
 * the control receives no click at all.
 *
 * The cost the shape accepts is the header's own word: aria-expanded stays
 * false while the body stands, because the host writes it from the state the
 * skin does not touch.
 *
 * @capability chat-fold
 * @features chat-fold
 * @risk A running group is shown by pressing the host's control: the press moves the reader's focus, selection and scroll position for a group nobody asked it about, and ties the skin's display to a state it does not own.
 */
import { spec, host } from '../../fixtures/behaviour.mjs'
import { frames, mountGroup, readGroup } from '../../fixtures/process-group.mjs'

export default spec({ page: 'chat-fold' }, ({ test }) => {
  test('a running group shows its body while its header still says folded, and the control is never pressed', async (t) => {
    await mountGroup(t.page, { running: true, turn: '11' })
    await frames(t.page, 3)
    const group = await readGroup(t.page, 0, 'process.shown')
    t.expectThat.equal(group.shown, true, `the running group's body draws a box: ${JSON.stringify(group)}`)
    t.expectThat.equal(group.contentVisibility, 'visible', `the body is laid out rather than skipped: ${JSON.stringify(group)}`)
    t.expectThat.equal(group.expanded, 'false', `the header still says folded, the accepted cost: ${JSON.stringify(group)}`)
    t.expectThat.equal(group.mark, true, `the skin marks the group it shows: ${JSON.stringify(group)}`)
    t.expectThat.equal(group.presses, 0, `the control was never pressed: ${JSON.stringify(group)}`)
    // A press inside the body opens a card or follows a link: it is not the
    // reader deciding the group, so the body keeps standing.
    await t.page.evaluate((content) => { document.querySelector(content).click() }, host('process.content'))
    await frames(t.page, 2)
    const afterBodyPress = await readGroup(t.page, 0, 'process.shown')
    t.expectThat.equal(afterBodyPress.shown, true, `a press inside the body leaves the group standing: ${JSON.stringify(afterBodyPress)}`)
    t.expectThat.equal(afterBodyPress.mark, true, `the mark stands after a press inside the body: ${JSON.stringify(afterBodyPress)}`)
  })
})
