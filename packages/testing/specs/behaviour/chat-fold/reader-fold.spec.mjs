/**
 * The price written into the shape: a reader's first press on a running group
 * opens the host's own disclosure rather than folding the group, so the group
 * keeps standing and the skin's mark comes off. The second press is the one that
 * folds it, through the state the host has held since the first.
 *
 * The press is the reader's: the skin's document listener records it, the mark
 * leaves in the same task, and the host's own handler flips its state.
 *
 * @capability chat-fold
 * @features chat-fold
 * @risk The press that should fold a running group opens it instead, and a second press is needed before the group closes.
 */
import { spec } from '../../fixtures/behaviour.mjs'
import { frames, mountGroup, pressHeader, readGroup } from '../../fixtures/process-group.mjs'

export default spec({ page: 'chat-fold' }, ({ test }) => {
  test('the first press on a running group opens the host and keeps the group standing; the second one folds it', async (t) => {
    await mountGroup(t.page, { running: true, turn: '41' })
    await frames(t.page, 2)
    await pressHeader(t.page, 0)
    await frames(t.page, 2)
    const first = await readGroup(t.page, 0, 'process.shown')
    t.expectThat.equal(first.expanded, 'true', `the press opened the host's own disclosure: ${JSON.stringify(first)}`)
    t.expectThat.equal(first.shown, true, `the group keeps standing on that press: ${JSON.stringify(first)}`)
    t.expectThat.equal(first.mark, false, `the skin's mark came off with the press: ${JSON.stringify(first)}`)
    await pressHeader(t.page, 0)
    await frames(t.page, 2)
    const second = await readGroup(t.page, 0, 'process.shown')
    t.expectThat.equal(second.expanded, 'false', `the second press closed the host's disclosure: ${JSON.stringify(second)}`)
    t.expectThat.equal(second.shown, false, `the group folds on the second press: ${JSON.stringify(second)}`)
  })
})
