import { afterEach, expect, test } from 'vitest'
import { HEAT_TIP_EDGE_ATTR, placeHeatTip } from './heat-tip'

/**
 * The tip pill is one cell wide and many cells long, so the cell it belongs to
 * decides whether the pill hangs over the panel's edge. These tests hold that
 * decision and the overflow it removes; the pill's own look is the feature
 * sheet's (home-overview.css), and the geometry it is measured against is
 * repeated here so the reading has a pill to read.
 *
 * The fixture generates the pill for every cell rather than under `:hover`: the
 * reading is the same one the page takes while the pointer is on a cell, and a
 * headless test has no pointer to hold there.
 */
const STYLE = `
  .test-panel { width: 480px; padding: 12px; overflow: auto; box-sizing: border-box; }
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
`

const COLUMNS = 26
const cleanups: (() => void)[] = []
afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()!()
})

/** A panel holding one 26-week grid whose cells all carry the same tip. */
function mount() {
  const style = document.createElement('style')
  style.textContent = STYLE
  const panel = document.createElement('div')
  panel.className = 'test-panel'
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
const overflows = (panel: HTMLElement) => panel.scrollWidth > panel.clientWidth
/** What the fixed three-column count this fix replaced answered for a column. */
const counted = (column: number) => (column < 3 ? 'start' : column >= COLUMNS - 3 ? 'end' : null)

test('a cell the centred pill already fits in keeps no alignment', () => {
  const { grid, cells } = mount()
  expect(placeHeatTip(cellOf(cells, 12), grid)).toBe(null)
  expect(cellOf(cells, 12).hasAttribute(HEAT_TIP_EDGE_ATTR)).toBe(false)
})

test('a cell whose pill cannot be read is left centred', () => {
  const { grid, cells } = mount()
  const bare = cellOf(cells, 0)
  bare.removeAttribute('data-tip')
  expect(placeHeatTip(bare, grid)).toBe(null)
  expect(bare.hasAttribute(HEAT_TIP_EDGE_ATTR)).toBe(false)
})

test('the pill of a cell near an end lines up with that end, and the panel stops scrolling', () => {
  const { panel, grid, cells } = mount()
  // The centred pills are what the panel has to scroll for.
  expect(overflows(panel)).toBe(true)
  const edges = cells.map(cell => placeHeatTip(cell, grid))
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
