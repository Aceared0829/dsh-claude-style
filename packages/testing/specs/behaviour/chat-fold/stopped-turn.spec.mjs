/**
 * When a turn's process folds, and when it stays: the group folds once an answer
 * row takes its place in the flow, a stopped turn never gets one and keeps its
 * work standing, and a stopped turn whose answer does arrive later folds like any
 * other.
 *
 * The three groups share one flow, so the answer rows are the only difference
 * between them: the fold reads the turn from the row's own attribute.
 *
 * @capability chat-fold
 * @features chat-fold
 * @risk A stopped turn's process folds away and the page goes blank below the stop, or an answered turn keeps a finished process standing below its answer.
 */
import { spec } from '../../fixtures/behaviour.mjs'
import { answerTurn, endProcess, frames, mountGroup, readGroup } from '../../fixtures/process-group.mjs'

export default spec({ page: 'chat-fold' }, ({ test }) => {
  test('an answered turn folds, a stopped turn stands, and an answer arriving after the stop folds it', async (t) => {
    await mountGroup(t.page, { running: true, turn: '21' })
    await mountGroup(t.page, { running: true, turn: '22' })
    await mountGroup(t.page, { running: true, turn: '23' })
    await frames(t.page, 2)
    // The work ends on all three: the answer for the first and, after a while,
    // the third; the second turn was stopped and gets none.
    await endProcess(t.page, 0)
    await endProcess(t.page, 1)
    await endProcess(t.page, 2)
    await frames(t.page, 2)
    await answerTurn(t.page, '21')
    await frames(t.page, 3)
    const stopped = await readGroup(t.page, 1, 'process.shown')
    t.expectThat.equal(stopped.shown, true, `a stopped turn's work stays on the page: ${JSON.stringify(stopped)}`)
    const answered = await readGroup(t.page, 0, 'process.shown')
    t.expectThat.equal(answered.shown, false, `a turn whose answer arrived folds its work away: ${JSON.stringify(answered)}`)
    // The stopped turn's answer arrives later, as a restored transcript does:
    // the group it belongs to folds like any answered one.
    await answerTurn(t.page, '23')
    await frames(t.page, 3)
    const late = await readGroup(t.page, 2, 'process.shown')
    t.expectThat.equal(late.shown, false, `the answer that arrived after the stop folds the group: ${JSON.stringify(late)}`)
    const stillStopped = await readGroup(t.page, 1, 'process.shown')
    t.expectThat.equal(stillStopped.shown, true, `the turn with no answer keeps its work: ${JSON.stringify(stillStopped)}`)
  })
})
