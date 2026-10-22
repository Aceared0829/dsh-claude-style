/**
 * A group the reader opened himself while its process ran belongs to him: when
 * the answer arrives the group stays open, shown by the host's own disclosure
 * rather than by the skin's mark.
 *
 * The press is the host's own — the header flips its own aria-expanded and the
 * body's hidden attribute — and the skin's document listener records it as the
 * reader's decision for that phase.
 *
 * @capability chat-fold
 * @features chat-fold
 * @risk A group the reader opened in the running phase folds under him when the turn answers, so the work he was reading disappears.
 */
import { spec } from '../../fixtures/behaviour.mjs'
import { answerTurn, endProcess, frames, mountGroup, pressHeader, readGroup } from '../../fixtures/process-group.mjs'

export default spec({ page: 'chat-fold' }, ({ test }) => {
  test('a group the reader opened while it ran stays open once the answer arrives', async (t) => {
    await mountGroup(t.page, { running: true, turn: '31' })
    await frames(t.page, 2)
    await pressHeader(t.page, 0)
    await frames(t.page, 2)
    const opened = await readGroup(t.page, 0, 'process.shown')
    t.expectThat.equal(opened.expanded, 'true', `the press opened the host's own disclosure: ${JSON.stringify(opened)}`)
    await endProcess(t.page, 0)
    await answerTurn(t.page, '31')
    await frames(t.page, 3)
    const answered = await readGroup(t.page, 0, 'process.shown')
    t.expectThat.equal(answered.shown, true, `the group the reader opened keeps standing: ${JSON.stringify(answered)}`)
    t.expectThat.equal(answered.expanded, 'true', `the host still holds it open: ${JSON.stringify(answered)}`)
    t.expectThat.equal(answered.mark, false, `the host's own state shows it, not the skin's mark: ${JSON.stringify(answered)}`)
  })
})
