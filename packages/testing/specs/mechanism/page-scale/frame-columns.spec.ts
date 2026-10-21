/**
 * The host frame's three columns in a page drawn at a scale (D43, D81). The host
 * measures the frame in the window's pixels and writes the columns in the page's,
 * so the grid is drawn at the scale again: the columns add up to a factor past
 * the window, the last column stands outside the frame, and a sidebar dragged to
 * a width is drawn that factor wider. A column narrowed to nothing is the one the
 * skin cannot divide, so that write is left to the host.
 *
 * @capability page-scale
 * @features shared
 * @risk At a page scale other than 100% the frame's three columns add up to a factor more than the window, the right column is pushed out of the frame, and a sidebar dragged to a width is drawn that factor wider.
 */
import { afterEach, expect, test } from 'vitest'
import { inPageColumns, installFrameColumns } from '@dsh-claude-style/client/pure'
import { surfaceAttribute } from '../../fixtures/surface'
import { after, drawnAt, drawnScale, resetPage, settle } from './drawn-page'

/** The frame's part mark: the attribute a skin writes its parts under, resolved by the skin. */
const FRAME_PART = surfaceAttribute('skin.part')

afterEach(resetPage)

/** The host's frame: the one element the part marks, with its columns written inline. */
function hostFrame(columns: string) {
  const frame = document.createElement('div')
  frame.setAttribute(FRAME_PART, 'layout-frame')
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

test('a page at its own scale, a keyword track, and a collapsed column keep the host\'s own write', () => {
  expect(inPageColumns('280px 900.8px 0px', 1)).toBe(null)
  expect(inPageColumns('280px 500px 400px', 0)).toBe(null)
  expect(inPageColumns('', 1.25)).toBe(null)
  expect(inPageColumns('fit-content(200px) 1fr min-content', 1.25)).toBe(null)
  // A track standing at nothing is the one the division cannot carry: it reads
  // as zero in both spaces, and dividing the rest would leave the columns a
  // factor past the window.
  expect(inPageColumns('280px minmax(0px, 1fr) minmax(0px, 0px)', 1.25)).toBe(null)
  expect(inPageColumns('0px minmax(0px, 1fr) minmax(0px, 0px)', 1.25)).toBe(null)
})

test('the frame\'s columns are laid out in the page\'s own pixels', async () => {
  drawnAt(1.25)
  const frame = hostFrame('280px 500px 400px')
  installed()
  await settle()
  expect(columnsOf(frame)).toBe('224px 400px 320px')
})

test('a frame the host collapsed to its first column is left as the host wrote it', async () => {
  drawnAt(1.25)
  const frame = hostFrame('280px minmax(0px, 1fr) minmax(0px, 0px)')
  installed()
  await settle()
  expect(columnsOf(frame)).toBe('280px minmax(0px, 1fr) minmax(0px, 0px)')
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

test('the teardown hands the frame back as the host left it', async () => {
  drawnAt(1.25)
  const frame = hostFrame('280px 500px 400px')
  const rule = installFrameColumns({ scale: drawnScale })
  await settle()
  expect(columnsOf(frame)).toBe('224px 400px 320px')
  rule.stop()
  await settle()
  expect(columnsOf(frame)).toBe('')
})
