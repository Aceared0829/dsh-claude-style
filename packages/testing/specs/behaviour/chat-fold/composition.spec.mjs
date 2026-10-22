/**
 * A process group changing phase while the reader is part-way through an
 * input-method composition leaves the composer alone: the editor keeps the
 * focus and the caret keeps the place it had.
 *
 * Nothing in the fold presses a control any more, so nothing takes the focus
 * off the composer; this reads that the shape holds on the page — the answer
 * arriving under an uncommitted composition moves neither.
 *
 * @capability chat-fold
 * @features chat-fold
 * @risk A phase change under an input-method composition moves the focus or the selection, and the browser drops the letters the reader has typed but not committed.
 */
import { spec, host } from '../../fixtures/behaviour.mjs'
import { answerTurn, endProcess, frames, mountGroup } from '../../fixtures/process-group.mjs'

const COMPOSER = host('composer.input')

export default spec({ page: 'chat-fold' }, ({ test }) => {
  test('a group ending under a composition leaves the composer focus and caret where they were', async (t) => {
    await mountGroup(t.page, { running: true, turn: '51' })
    await frames(t.page, 2)
    const before = await t.page.evaluate(({ composer }) => {
      const editor = document.querySelector(composer)
      editor.focus()
      const range = document.createRange()
      range.setStart(editor.firstChild, 2)
      range.collapse(true)
      const selection = document.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
      const caret = () => {
        const current = document.getSelection()
        return {
          editor: document.activeElement === editor,
          node: current.anchorNode === editor.firstChild,
          offset: current.anchorOffset,
        }
      }
      return caret()
    }, { composer: COMPOSER })
    t.expectThat.equal(before, { editor: true, node: true, offset: 2 }, `the composition starts on the reader's caret: ${JSON.stringify(before)}`)
    await endProcess(t.page, 0)
    await answerTurn(t.page, '51')
    await frames(t.page, 4)
    const after = await t.page.evaluate(({ composer }) => {
      const editor = document.querySelector(composer)
      const current = document.getSelection()
      return {
        editor: document.activeElement === editor,
        node: current.anchorNode === editor.firstChild,
        offset: current.anchorOffset,
      }
    }, { composer: COMPOSER })
    t.expectThat.equal(after, { editor: true, node: true, offset: 2 }, `the focus and the caret stand where the composition began: ${JSON.stringify(after)}`)
  })
})
