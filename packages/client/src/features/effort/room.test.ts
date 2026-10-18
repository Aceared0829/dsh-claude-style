import { afterEach, expect, test } from 'vitest'
import { reserveEffortRoom, releaseEffortRoom } from './room'

/**
 * The room the effort trigger reserves comes out of the row's slack, and out of
 * the model name where the row has none. These tests hold the two answers and
 * the invariant behind them: what the reserve costs the name, the name keeps
 * the row's width, so a card too narrow for its controls never grows a
 * horizontal scrollbar for the trigger's sake.
 */
const STYLE = `
  .effort-row { display: flex; }
  .effort-model { width: 150px; min-width: 0; flex: 0 0 auto; }
  .effort-rest { width: 50px; flex: 0 0 auto; }
`

const cleanups: (() => void)[] = []
afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()!()
})

/** A row holding a 150px model trigger and a 50px control after it. */
function mount(rowWidth: number) {
  const style = document.createElement('style')
  style.textContent = STYLE
  const row = document.createElement('div')
  row.className = 'effort-row'
  row.setAttribute('data-dsh-claude-part', 'row')
  row.style.width = `${rowWidth}px`
  const model = document.createElement('button')
  model.className = 'effort-model'
  const rest = document.createElement('span')
  rest.className = 'effort-rest'
  row.append(model, rest)
  document.body.append(style, row)
  cleanups.push(() => { row.remove(); style.remove() })
  return { row, model }
}

const overflows = (row: HTMLElement) => row.scrollWidth > row.clientWidth

test('a row with slack keeps the model name whole', () => {
  const { row, model } = mount(400)
  const natural = model.getBoundingClientRect().width
  expect(natural).toBe(150)
  reserveEffortRoom(model, 30)
  expect(model.style.marginRight).toBe('30px')
  expect(model.style.maxWidth).toBe('')
  expect(model.getBoundingClientRect().width).toBe(natural)
  expect(overflows(row)).toBe(false)
})

test('a row without slack gives the reserve up out of the model name', () => {
  const { row, model } = mount(200)
  const natural = model.getBoundingClientRect().width
  expect(overflows(row)).toBe(false)
  const box = reserveEffortRoom(model, 30)
  // The margin alone would push the row 30px past its own width.
  expect(overflows(row)).toBe(false)
  expect(model.style.marginRight).toBe('30px')
  expect(model.getBoundingClientRect().width).toBe(natural - 30)
  // What the name gave up is exactly what the reserve added: the row is the
  // width it had, and the trigger stands in the space the name left.
  expect(box.width + 30).toBe(natural)
  expect(box).toEqual(model.getBoundingClientRect())
})

test('the reserved room goes back whole', () => {
  const { model } = mount(200)
  reserveEffortRoom(model, 30)
  releaseEffortRoom(model)
  expect(model.style.marginRight).toBe('')
  expect(model.style.maxWidth).toBe('')
  expect(model.getBoundingClientRect().width).toBe(150)
})
