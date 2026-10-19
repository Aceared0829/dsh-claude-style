import { afterEach, expect, test } from 'vitest'
import { HEAT_TIP_EDGE_ATTR, HEAT_TIP_SIDE_ATTR, HEAT_TIP_SIDE_BELOW, placeHeatTip } from './heat-tip'

/**
 * The tip pill is one cell wide and many cells long, so the cell it belongs to
 * decides whether the pill hangs over the panel's edge; it is also twice a cell
 * tall, so that same cell decides whether it reaches over the grid's top edge.
 * These tests hold both decisions and the overflow the first one removes; the
 * pill's own look is the feature sheet's (home-overview.css), and the geometry
 * it is measured against is repeated here so the reading has a pill to read.
 *
 * The fixture generates the pill for every cell rather than under `:hover`: the
 * reading is the same one the page takes while the pointer is on a cell, and a
 * headless test has no pointer to hold there.
 */
const STYLE = `
  .test-panel { width: 480px; padding: 12px; overflow: auto; box-sizing: border-box; }
  .test-panel[data-short] .dsh-claude-home-heat { height: 24px; }
  .dsh-claude-home-heat {
    display: grid; grid-auto-flow: column; grid-template-rows: repeat(7, 1fr);
    grid-auto-columns: 1fr; gap: 3px;
  }
  .dsh-claude-home-heat-cell { position: relative; aspect-ratio: 1; }
  .dsh-claude-home-heat-cell[data-tip]::after {
    content: attr(data-tip); position: absolute; bottom: calc(100% + 6px);
    left: 50%; transform: translateX(-50%); padding: 5px 10px; white-space: nowrap;
    font: 500 13px/18px sans-serif;
  }
  .dsh-claude-home-heat-cell[data-edge="start"]::after { left: 0; transform: none; }
  .dsh-claude-home-heat-cell[data-edge="end"]::after { left: auto; right: 0; transform: none; }
  .dsh-claude-home-heat-cell[data-side="below"]::after { top: calc(100% + 6px); bottom: auto; }
`

const COLUMNS = 26
const cleanups: (() => void)[] = []
afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()!()
})

/** A panel holding one 26-week grid whose cells all carry the same tip. */
function mount(options: { short?: boolean } = {}) {
  const style = document.createElement('style')
  style.textContent = STYLE
  const panel = document.createElement('div')
  panel.className = 'test-panel'
  if (options.short === true) panel.setAttribute('data-short', '')
  const grid = document.createElement('div')
  grid.className = 'dsh-claude-home-heat'
  for (let i = 0; i < COLUMNS * 7; i += 1) {
    const cell = document.createElement('span')
    cell.className = 'dsh-claude-home-heat-cell'
    cell.setAttribute('data-tip', '9月29日 — 4.1B Token')
    grid.append(cell)
  }
  panel.append(grid)
  document.body.append(style, panel)
  cleanups.push(() => { panel.remove(); style.remove() })
  return { panel, grid, cells: [...grid.children] as HTMLElement[] }
}

/** The cell at the top of a column. */
const cellOf = (cells: HTMLElement[], column: number) => cells[column * 7]
/** The cell in one row of a column, rows counted from the grid's top. */
const cellAt = (cells: HTMLElement[], column: number, row: number) => cells[column * 7 + row]
const overflows = (panel: HTMLElement) => panel.scrollWidth > panel.clientWidth
/** What the fixed three-column count this fix replaced answered for a column. */
const counted = (column: number) => (column < 3 ? 'start' : column >= COLUMNS - 3 ? 'end' : null)
/** Where the stylesheet hangs the pill the cell was told to carry: a pill under
    the cell is placed from its top edge, one above it from the cell's own top,
    so a positive resolved `top` is the pill standing below the cell. */
const hangsBelow = (cell: HTMLElement) => parseFloat(getComputedStyle(cell, '::after').top) > 0
/** The pill's box in the viewport, from the cell it hangs off. */
function pillBox(cell: HTMLElement) {
  const style = getComputedStyle(cell, '::after')
  const cellBox = cell.getBoundingClientRect()
  const height = parseFloat(style.height) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
  const top = cellBox.top + parseFloat(style.top)
  return { top, bottom: top + height }
}

test('a cell the centred pill already fits in keeps no alignment', () => {
  const { grid, cells } = mount()
  expect(placeHeatTip(cellOf(cells, 12), grid).edge).toBe(null)
  expect(cellOf(cells, 12).hasAttribute(HEAT_TIP_EDGE_ATTR)).toBe(false)
})

test('a cell whose pill cannot be read is left centred', () => {
  const { grid, cells } = mount()
  const bare = cellOf(cells, 0)
  bare.removeAttribute('data-tip')
  const placement = placeHeatTip(bare, grid)
  expect(placement.edge).toBe(null)
  expect(placement.side).toBe(null)
  expect(bare.hasAttribute(HEAT_TIP_EDGE_ATTR)).toBe(false)
  expect(bare.hasAttribute(HEAT_TIP_SIDE_ATTR)).toBe(false)
})

test('the pill of a cell near an end lines up with that end, and the panel stops scrolling', () => {
  const { panel, grid, cells } = mount()
  // The centred pills are what the panel has to scroll for.
  expect(overflows(panel)).toBe(true)
  const edges = cells.map(cell => placeHeatTip(cell, grid).edge)
  const columnOf = (index: number) => Math.floor(index / 7)
  // Every column the fixed count aligned keeps its edge, so the fix only ever
  // reaches further in.
  edges.forEach((edge, index) => {
    const before = counted(columnOf(index))
    if (before !== null) expect(edge).toBe(before)
  })
  // ...and it does reach further: the pill's own half-width is more than the
  // three columns the count allowed, so columns it left centred are aligned now.
  const gained = edges.filter((edge, index) => edge !== null && counted(columnOf(index)) === null)
  expect(gained.length).toBeGreaterThan(0)
  // The middle of the grid still shows the centred pill.
  expect(edges[12 * 7]).toBe(null)
  // Nothing hangs over the panel's edge any more.
  expect(overflows(panel)).toBe(false)
})

test('the pill of a cell in the grid’s upper rows hangs under it, inside the grid', () => {
  const { grid, cells } = mount()
  const top = cellAt(cells, 5, 0)
  expect(placeHeatTip(top, grid).side).toBe(HEAT_TIP_SIDE_BELOW)
  expect(top.getAttribute(HEAT_TIP_SIDE_ATTR)).toBe(HEAT_TIP_SIDE_BELOW)
  // The stylesheet answers the attribute: the pill hangs off the cell's bottom
  // edge, so it stays inside the grid instead of reaching over its top edge.
  expect(hangsBelow(top)).toBe(true)
  const gridBox = grid.getBoundingClientRect()
  const pill = pillBox(top)
  expect(pill.top).toBeGreaterThan(gridBox.top)
  expect(pill.bottom).toBeLessThan(gridBox.bottom)
})

test('a cell low enough in the grid keeps its pill above', () => {
  const { grid, cells } = mount()
  // The fourth row is the middle of the seven: the two sides are equal there.
  const middle = cellAt(cells, 5, 3)
  expect(placeHeatTip(middle, grid).side).toBe(null)
  expect(middle.hasAttribute(HEAT_TIP_SIDE_ATTR)).toBe(false)
  expect(hangsBelow(middle)).toBe(false)
  const bottom = cellAt(cells, 5, 6)
  expect(placeHeatTip(bottom, grid).side).toBe(null)
  expect(hangsBelow(bottom)).toBe(false)
})

test('a grid too short for the pill on either side keeps it above', () => {
  const { grid, cells } = mount({ short: true })
  const top = cellAt(cells, 5, 0)
  expect(placeHeatTip(top, grid).side).toBe(null)
  expect(hangsBelow(top)).toBe(false)
})
