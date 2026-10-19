/**
 * The room the effort button takes beside the model name, as a function of the
 * row it is given: out of the row's slack where there is some, out of the name
 * where there is none, so the row never grows past its own width; and all of it
 * back when the button goes.
 *
 * The row here is any flex row of a fixed width carrying the composer row's
 * mark — the function's contract is about the row it measures, not about the
 * composer's own stylesheet, which the behaviour specs read on the built page.
 *
 * @capability effort-picker
 * @features effort
 * @risk In a window too narrow for the composer's controls, the effort button pushes the row past the card and the conversation grows a horizontal scrollbar, or the model name stays cut after the button has gone.
 */
import { afterEach, expect, test } from 'vitest'
import { releaseEffortRoom, reserveEffortRoom } from '@dsh-claude-style/client/pure'
import { hostElement } from '../../fixtures/host-markup'
import { surfaceSelector } from '../../fixtures/surface'

const cleanups: (() => void)[] = []
afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()!()
})

/** A flex row `width` wide holding a 150px model name and a 50px control after it. */
function mount(width: number) {
  const row = hostElement(surfaceSelector('composer.row'))
  row.style.cssText = `display:flex;width:${width}px`
  const model = document.createElement('button')
  model.style.cssText = 'width:150px;min-width:0;flex:0 0 auto'
  const rest = document.createElement('span')
  rest.style.cssText = 'width:50px;flex:0 0 auto'
  row.append(model, rest)
  document.body.append(row)
  cleanups.push(() => row.remove())
  return { row, model }
}

const overflows = (row: HTMLElement) => row.scrollWidth > row.clientWidth
const widthOf = (element: Element) => element.getBoundingClientRect().width

test('a row with slack keeps the model name whole, the room coming out of the slack', () => {
  const { row, model } = mount(400)
  const box = reserveEffortRoom(model, 30)
  expect(widthOf(model)).toBe(150)
  expect(box.width).toBe(150)
  expect(overflows(row)).toBe(false)
})

test('a row without slack gives the room up out of the model name, and stays its own width', () => {
  const { row, model } = mount(200)
  expect(overflows(row)).toBe(false)
  const box = reserveEffortRoom(model, 30)
  expect(overflows(row)).toBe(false)
  // What the name gave up is exactly the room the button needs.
  expect(widthOf(model)).toBe(120)
  expect(box).toEqual(model.getBoundingClientRect())
})

test('the room comes back whole when the button goes', () => {
  const { row, model } = mount(200)
  reserveEffortRoom(model, 30)
  releaseEffortRoom(model)
  expect(widthOf(model)).toBe(150)
  expect(overflows(row)).toBe(false)
})
