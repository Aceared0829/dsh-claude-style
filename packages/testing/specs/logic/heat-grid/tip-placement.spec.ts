/**
 * A day's tip on the usage panel's heat grid: the pill appears while the
 * pointer is on the cell, lines up with the grid's edge where the centred pill
 * would hang past it, and hangs under cells in the grid's upper rows. Measured
 * against the stylesheet the panel ships, with a real pointer on the cell.
 *
 * @capability heat-grid
 * @features home
 * @risk Hovering a day near the panel's edge grows a horizontal scrollbar under the grid, or a tip in the top rows covers the stat cells above it.
 */
import { afterEach, expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'
import { HEAT_TIP_EDGE_ATTR, HEAT_TIP_SIDE_ATTR, HEAT_TIP_SIDE_BELOW, HOME_OVERVIEW_SHEET, placeHeatTip } from '@dsh-claude-style/client/pure'
import { surfaceAttribute, surfaceClass } from '../../fixtures/surface'

const ROOT = surfaceAttribute('skin.root')
const TIP = surfaceAttribute('home.heat-tip')
const COLUMNS = 26
const cleanups: (() => void)[] = []
afterEach(async () => {
  await userEvent.unhover(document.body)
  while (cleanups.length > 0) cleanups.pop()!()
})

/** The usage panel's box holding one 26-week grid whose cells all carry the same tip, under the shipped sheet. */
function mount(options: { short?: boolean } = {}) {
  const sheet = document.createElement('style')
  sheet.textContent = HOME_OVERVIEW_SHEET
  const panel = document.createElement('div')
  panel.style.cssText = 'width:480px;padding:12px;overflow:auto;box-sizing:border-box;margin:120px 40px'
  const grid = document.createElement('div')
  grid.className = surfaceClass('home.heat-grid')
  if (options.short === true) grid.style.height = '24px'
  for (let i = 0; i < COLUMNS * 7; i += 1) {
    const cell = document.createElement('span')
    cell.className = surfaceClass('home.heat-cell')
    cell.setAttribute(TIP, '9月29日 — 4.1B Token')
    grid.append(cell)
  }
  panel.append(grid)
  document.head.append(sheet)
  document.body.setAttribute(ROOT, '')
  document.body.append(panel)
  cleanups.push(() => { panel.remove(); sheet.remove(); document.body.removeAttribute(ROOT) })
  return { panel, grid, cells: [...grid.children] as HTMLElement[] }
}

/** The cell in one row of a column, rows counted from the grid's top. */
const cellAt = (cells: HTMLElement[], column: number, row: number) => cells[column * 7 + row]!
const overflows = (panel: HTMLElement) => panel.scrollWidth > panel.clientWidth
/** The pill the hovered cell shows, in the viewport. */
function pillBox(cell: HTMLElement) {
  const style = getComputedStyle(cell, '::after')
  const cellBox = cell.getBoundingClientRect()
  const height = parseFloat(style.height) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
  const top = cellBox.top + parseFloat(style.top)
  return { top, bottom: top + height }
}

/** Put the pointer on a cell, as the reader does, and place its pill as the panel does on that hover. */
async function hover(cell: HTMLElement, grid: HTMLElement) {
  await userEvent.hover(cell)
  return placeHeatTip(cell, grid)
}

test('a cell the centred pill already fits in keeps no alignment', async () => {
  const { grid, cells } = mount()
  expect((await hover(cellAt(cells, 12, 3), grid)).edge).toBe(null)
  expect(cellAt(cells, 12, 3).hasAttribute(HEAT_TIP_EDGE_ATTR)).toBe(false)
})

test('a cell whose pill cannot be read is left centred and above', async () => {
  const { grid, cells } = mount()
  const bare = cellAt(cells, 0, 0)
  bare.removeAttribute(TIP)
  const placement = await hover(bare, grid)
  expect(placement).toEqual({ edge: null, side: null })
  expect(bare.hasAttribute(HEAT_TIP_EDGE_ATTR)).toBe(false)
  expect(bare.hasAttribute(HEAT_TIP_SIDE_ATTR)).toBe(false)
})

test('hovering any day leaves the panel without a horizontal scrollbar', async () => {
  const { panel, grid, cells } = mount()
  const edges: (string | null)[] = []
  let overflowedBefore = 0
  for (let column = 0; column < COLUMNS; column += 1) {
    const cell = cellAt(cells, column, 3)
    await userEvent.hover(cell)
    if (overflows(panel)) overflowedBefore += 1
    edges.push(placeHeatTip(cell, grid).edge)
    expect(overflows(panel)).toBe(false)
  }
  // The centred pill alone would hang past the panel at both ends.
  expect(overflowedBefore).toBeGreaterThan(0)
  expect(edges[0]).toBe('start')
  expect(edges[COLUMNS - 1]).toBe('end')
  expect(edges[12]).toBe(null)
  // The aligned columns run from each end inward without a gap.
  const starts = edges.findIndex((edge) => edge !== 'start')
  expect(edges.slice(0, starts).every((edge) => edge === 'start')).toBe(true)
  expect(edges.slice(starts).includes('start')).toBe(false)
})

test('the pill of a cell in the grid\'s upper rows hangs under it, inside the grid', async () => {
  const { grid, cells } = mount()
  const top = cellAt(cells, 5, 0)
  expect((await hover(top, grid)).side).toBe(HEAT_TIP_SIDE_BELOW)
  expect(top.getAttribute(HEAT_TIP_SIDE_ATTR)).toBe(HEAT_TIP_SIDE_BELOW)
  const gridBox = grid.getBoundingClientRect()
  const pill = pillBox(top)
  expect(pill.top).toBeGreaterThan(gridBox.top)
  expect(pill.bottom).toBeLessThan(gridBox.bottom)
})

test('a cell low enough in the grid keeps its pill above', async () => {
  const { grid, cells } = mount()
  // The fourth row is the middle of the seven: the two sides are equal there.
  for (const row of [3, 6]) {
    const cell = cellAt(cells, 5, row)
    expect((await hover(cell, grid)).side).toBe(null)
    expect(cell.hasAttribute(HEAT_TIP_SIDE_ATTR)).toBe(false)
    expect(pillBox(cell).bottom).toBeLessThanOrEqual(cell.getBoundingClientRect().top)
  }
})

test('a grid too short for the pill on either side keeps it above', async () => {
  const { grid, cells } = mount({ short: true })
  const top = cellAt(cells, 5, 0)
  expect((await hover(top, grid)).side).toBe(null)
  expect(pillBox(top).bottom).toBeLessThanOrEqual(top.getBoundingClientRect().top)
})
