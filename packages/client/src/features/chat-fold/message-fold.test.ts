import { expect, test } from 'vitest'
import { MESSAGE_FOLD_ATTR } from '../../constants'
import { MESSAGE_FOLD_TOGGLE_CLASS, createMessageFold } from './message-fold'

/**
 * One user message as the host renders it: a flow row holding a bubble that
 * paints a fill (which is how the module finds it), with the two lengths the
 * skin's stylesheet would carry set on the bubble itself — a unit test mounts no
 * sheet.
 */
function mountMessage(height: number, options: { echo?: boolean } = {}) {
  const column = document.createElement('div')
  column.setAttribute('data-chat-flow', '')
  const row = document.createElement('div')
  row.setAttribute('data-chat-flow-kind', 'user')
  if (options.echo === true) row.setAttribute('data-submission-echo', '')
  const bubble = document.createElement('div')
  bubble.style.background = 'rgb(20, 20, 19)'
  bubble.style.setProperty('--dsh-claude-message-fold-cap', '100px')
  bubble.style.setProperty('--dsh-claude-message-fold-fade', '10px')
  const words = document.createElement('div')
  words.style.height = `${height}px`
  bubble.append(words)
  row.append(bubble)
  column.append(row)
  document.body.append(column)
  return { bubble, column, row, words }
}

/** A frame and the bus's own delivery, so a size callback has been heard. */
const settled = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))

const toggleIn = (row: Element) => row.querySelector<HTMLElement>('.' + MESSAGE_FOLD_TOGGLE_CLASS)
const foldOf = () => createMessageFold(() => {})

test('a message taller than the cap folds, and the skin\'s own control hands it back', () => {
  const { bubble, column, row } = mountMessage(240)
  const fold = foldOf()
  fold.measure()
  fold.sync()
  expect(bubble.getAttribute(MESSAGE_FOLD_ATTR)).toBe('collapsed')
  const toggle = toggleIn(row)
  expect(toggle?.textContent).toBe('Show the whole message')

  toggle?.click()
  expect(bubble.hasAttribute(MESSAGE_FOLD_ATTR)).toBe(false)
  expect(toggle?.textContent).toBe('Show less')

  // The reader's own choice stands through later passes.
  fold.sync()
  expect(bubble.hasAttribute(MESSAGE_FOLD_ATTR)).toBe(false)

  toggle?.click()
  expect(bubble.getAttribute(MESSAGE_FOLD_ATTR)).toBe('collapsed')
  fold.stop()
  expect(bubble.hasAttribute(MESSAGE_FOLD_ATTR)).toBe(false)
  expect(toggleIn(row)).toBeNull()
  column.remove()
})

test('a message that fits under the cap is left whole, with no control', () => {
  const { bubble, column, row } = mountMessage(60)
  const fold = foldOf()
  fold.measure()
  fold.sync()
  expect(bubble.hasAttribute(MESSAGE_FOLD_ATTR)).toBe(false)
  expect(toggleIn(row)).toBeNull()
  fold.stop()
  column.remove()
})

test('the echo the reader has just sent is folded as it mounts, before any pass reads it', async () => {
  const fold = foldOf()
  const { bubble, column, row } = mountMessage(240, { echo: true })
  // The bus delivers the mount after the batch, and the send flight measures the
  // bubble in the same batch: the fold has to be on it before any pass runs.
  await settled()
  expect(bubble.getAttribute(MESSAGE_FOLD_ATTR)).toBe('collapsed')
  expect(toggleIn(row)?.textContent).toBe('Show the whole message')
  fold.stop()
  column.remove()
})

test('a bubble read before its words arrived is read again once its box moves', async () => {
  const { bubble, column, words } = mountMessage(60)
  const fold = foldOf()
  fold.measure()
  fold.sync()
  expect(bubble.hasAttribute(MESSAGE_FOLD_ATTR)).toBe(false)

  // The row stood before the words were painted; the box moves when they land.
  words.style.height = '240px'
  await settled()
  fold.measure()
  fold.sync()
  expect(bubble.getAttribute(MESSAGE_FOLD_ATTR)).toBe('collapsed')
  fold.stop()
  column.remove()
})

test('a scroll at the reading width asks for nothing; a column of another width reads again', async () => {
  const { bubble, column } = mountMessage(240)
  let passes = 0
  const fold = createMessageFold(() => { passes += 1 })
  fold.measure()
  fold.sync()
  expect(bubble.getAttribute(MESSAGE_FOLD_ATTR)).toBe('collapsed')

  // The first call says which width the readings in hand were taken at.
  fold.reposition()
  expect(passes).toBe(0)
  // The scheduler dispatches this on every scroll: the same width reads nothing.
  fold.reposition()
  fold.sync()
  expect(passes).toBe(0)
  expect(bubble.getAttribute(MESSAGE_FOLD_ATTR)).toBe('collapsed')

  column.style.width = '120px'
  await settled()
  fold.reposition()
  expect(passes).toBeGreaterThan(0)
  fold.stop()
  column.remove()
})
