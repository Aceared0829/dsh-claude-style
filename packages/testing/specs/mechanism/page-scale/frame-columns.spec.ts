/**
 * The host frame's three columns in a page drawn at a scale (D43, D81). The host
 * measures the frame in the window's pixels and writes the columns in the page's,
 * so the grid is drawn at the scale again: the columns add up to a factor past
 * the window, the last column stands outside the frame, and a sidebar dragged to
 * a width is drawn that factor wider. A column narrowed to nothing is carried
 * like any other — it stands at zero in both spaces, and the `1fr` beside it
 * takes the rest of the page's own width.
 *
 * @capability page-scale
 * @features shared
 * @risk At a page scale other than 100% the frame's three columns add up to a factor more than the window, the sidebar is drawn a factor wider and shows cut off, and a second copy of the rule on the page divides the first one's numbers again.
 */
import { afterEach, expect, test } from 'vitest'
import { inPageColumns, installFrameColumns } from '@dsh-claude-style/client/pure'
import { surfaceAttribute } from '../../fixtures/surface'
import { after, drawnAt, drawnScale, resetPage, settle } from './drawn-page'

/** The frame's part mark: the attribute a skin writes its parts under, and the name the frame answers to. */
const PART_ATTRIBUTE = surfaceAttribute('skin.part')
const FRAME_PART = 'layout-frame'
/** The record this rule keeps on a frame it carried, read from the surface table. */
const CARRY_ATTRIBUTE = surfaceAttribute('skin.frame-columns')

afterEach(resetPage)

/** The host's frame: the one element the part marks, with its columns written inline. */
function hostFrame(columns: string) {
  const frame = document.createElement('div')
  frame.setAttribute(PART_ATTRIBUTE, FRAME_PART)
  frame.style.cssText = `display:grid;grid-template-columns:${columns}`
  document.body.append(frame)
  return frame
}

/** Install the rule and register its teardown. */
function installed() {
  const rule = installFrameColumns({ scale: drawnScale })
  after(rule.stop)
  return rule
}

const columnsOf = (frame: HTMLElement) => frame.style.getPropertyValue('grid-template-columns')

test('every column the host wrote is divided by the page\'s scale', () => {
  expect(inPageColumns('280px minmax(200px, 1fr) minmax(300px, 400px)', 1.25)).toBe('224px minmax(160px, 1fr) minmax(240px, 320px)')
  expect(inPageColumns('280px 500px 400px', 1.25)).toBe('224px 400px 320px')
  expect(inPageColumns('280px 500px 400px', 0.8)).toBe('350px 625px 500px')
})

test('a page at its own scale and a keyword track keep the host\'s own write', () => {
  expect(inPageColumns('280px 900.8px 0px', 1)).toBe(null)
  expect(inPageColumns('280px 500px 400px', 0)).toBe(null)
  expect(inPageColumns('', 1.25)).toBe(null)
  expect(inPageColumns('fit-content(200px) 1fr min-content', 1.25)).toBe(null)
})

test('a column narrowed to nothing is carried like any other', () => {
  // The host writes this list whenever the right column is closed, and its first
  // column is still a length the page draws a factor wide.
  expect(inPageColumns('280px minmax(0px, 1fr) minmax(0px, 0px)', 1.25)).toBe('224px minmax(0px, 1fr) minmax(0px, 0px)')
  expect(inPageColumns('0px minmax(0px, 1fr) minmax(0px, 0px)', 1.25)).toBe('0px minmax(0px, 1fr) minmax(0px, 0px)')
})

test('the frame\'s columns are laid out in the page\'s own pixels', async () => {
  drawnAt(1.25)
  const frame = hostFrame('280px 500px 400px')
  installed()
  await settle()
  expect(columnsOf(frame)).toBe('224px 400px 320px')
})

test('a frame whose right column is closed carries its sidebar the same way', async () => {
  drawnAt(1.25)
  const frame = hostFrame('280px minmax(0px, 1fr) minmax(0px, 0px)')
  installed()
  await settle()
  expect(columnsOf(frame)).toBe('224px minmax(0px, 1fr) minmax(0px, 0px)')
})

test('the record stands on the frame, so a second copy of the rule reads it too', async () => {
  drawnAt(1.25)
  const frame = hostFrame('280px 500px 400px')
  installed()
  await settle()
  expect(columnsOf(frame)).toBe('224px 400px 320px')
  // A hot reload mounts the new module before the old one is torn down: the
  // second copy reads the same frame, and must not divide what the first wrote.
  const second = installFrameColumns({ scale: drawnScale })
  after(second.stop)
  second.settle()
  await settle()
  expect(columnsOf(frame)).toBe('224px 400px 320px')
  expect(frame.hasAttribute(CARRY_ATTRIBUTE)).toBe(true)
})

test('the scale changing under a carried frame reads the host\'s own numbers again', async () => {
  drawnAt(1.25)
  const frame = hostFrame('280px minmax(0px, 1fr) minmax(0px, 0px)')
  const rule = installed()
  await settle()
  expect(columnsOf(frame)).toBe('224px minmax(0px, 1fr) minmax(0px, 0px)')
  drawnAt(0.8)
  rule.settle()
  await settle()
  expect(columnsOf(frame)).toBe('350px minmax(0px, 1fr) minmax(0px, 0px)')
  drawnAt(1)
  rule.settle()
  await settle()
  expect(columnsOf(frame)).toBe('280px minmax(0px, 1fr) minmax(0px, 0px)')
  expect(frame.hasAttribute(CARRY_ATTRIBUTE)).toBe(false)
})

test('the host writing its columns again is followed, without compounding', async () => {
  drawnAt(1.25)
  const frame = hostFrame('280px 500px 400px')
  installed()
  await settle()
  frame.style.setProperty('grid-template-columns', '320px 500px 400px')
  await settle()
  expect(columnsOf(frame)).toBe('256px 400px 320px')
  await settle()
  expect(columnsOf(frame)).toBe('256px 400px 320px')
})

test('a frame mounted after the rule runs is found and converted', async () => {
  drawnAt(1.25)
  installed()
  await settle()
  const frame = hostFrame('280px 500px 400px')
  await settle()
  expect(columnsOf(frame)).toBe('224px 400px 320px')
})

test('the teardown hands the host its own numbers back', async () => {
  drawnAt(1.25)
  const frame = hostFrame('280px 500px 400px')
  const rule = installFrameColumns({ scale: drawnScale })
  await settle()
  expect(columnsOf(frame)).toBe('224px 400px 320px')
  rule.stop()
  await settle()
  expect(columnsOf(frame)).toBe('280px 500px 400px')
  expect(frame.hasAttribute(CARRY_ATTRIBUTE)).toBe(false)
})
