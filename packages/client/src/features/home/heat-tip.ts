import { inPageBox } from '../../shared/page-zoom'

/**
 * Where a heat cell's tip pill lines up.
 *
 * The pill is centred on its cell (home-overview.css), so it hangs half its own
 * width past either side of it: a cell within that reach of the grid's own edge
 * carries the pill over the panel's edge, and the panel — a scroll container —
 * answers with a horizontal scrollbar under the grid. Which cells are within
 * reach is the pill's own width, and that changes with the day written on it and
 * the figure beside it, so the cell the pointer is on says it: the pill is
 * generated only while that cell is hovered, and its used width is readable
 * from there.
 *
 * The answer is written on the cell as `data-edge`, which the stylesheet reads:
 * `start` lines the pill up with the cell's left edge, `end` with its right, and
 * neither is the centred pill that already fits.
 */

/** The cell the heat grid is built from; the pill hangs off it. */
export const HEAT_CELL_SELECTOR = '.dsh-claude-home-heat-cell'
/** The alignment the stylesheet reads off the hovered cell. */
export const HEAT_TIP_EDGE_ATTR = 'data-edge'

/**
 * Line a heat cell's tip pill up with the edge that keeps it inside `grid`, and
 * say which edge that was (null while the centred pill already fits).
 *
 * The pill's width is its used width plus the padding the stylesheet gives it,
 * since the `width` a computed style reports is the content box alone. That
 * width is in the pixels the page's own styles read, and a measured box is in
 * the viewport's, so the boxes are brought over before the two are compared
 * (shared/page-zoom.ts).
 */
export function placeHeatTip(cell: HTMLElement, grid: HTMLElement): 'start' | 'end' | null {
  const pill = window.getComputedStyle(cell, '::after')
  const width = parseFloat(pill.width) + parseFloat(pill.paddingLeft) + parseFloat(pill.paddingRight)
  const gridBox = inPageBox(grid.getBoundingClientRect())
  const cellBox = inPageBox(cell.getBoundingClientRect())
  const centre = cellBox.left + cellBox.width / 2
  // A pill whose width could not be read — no tip on this cell, or a page that
  // has not generated it — answers NaN here, and a comparison against NaN is
  // false, which leaves the pill centred.
  const edge = centre - width / 2 < gridBox.left ? 'start' : centre + width / 2 > gridBox.right ? 'end' : null
  if (edge === null) cell.removeAttribute(HEAT_TIP_EDGE_ATTR)
  else if (cell.getAttribute(HEAT_TIP_EDGE_ATTR) !== edge) cell.setAttribute(HEAT_TIP_EDGE_ATTR, edge)
  return edge
}
