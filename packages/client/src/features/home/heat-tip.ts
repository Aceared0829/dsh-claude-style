import { inPageBox } from '../../shared/page-zoom'

/**
 * Where a heat cell's tip pill stands.
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
 * The pill also stands twice a cell tall, so a cell in the grid's upper rows
 * carries it over the grid's own top edge and across the panel's stat cells
 * above. The side is the cell's own too: the pill stands on whichever side of
 * the cell holds more room, above when the two are equal, and its height is
 * read off the same generated pill as the width.
 *
 * The answers are written on the cell as `data-edge` and `data-side`, which the
 * stylesheet reads: `start` lines the pill up with the cell's left edge, `end`
 * with its right, neither is the centred pill that already fits, and `below`
 * hangs the pill under the cell.
 */

/** The cell the heat grid is built from; the pill hangs off it. */
export const HEAT_CELL_SELECTOR = '.dsh-claude-home-heat-cell'
/** The alignment the stylesheet reads off the hovered cell. */
export const HEAT_TIP_EDGE_ATTR = 'data-edge'
/** The side the stylesheet reads off the hovered cell; absent means above. */
export const HEAT_TIP_SIDE_ATTR = 'data-side'
/** The side value that hangs the pill under its cell. */
export const HEAT_TIP_SIDE_BELOW = 'below'

/** What one cell's pill was told to do. */
export interface HeatTipPlacement {
  /** The edge the pill lines up with, null while the centred pill already fits. */
  edge: 'start' | 'end' | null
  /** The side the pill stands on, null for above. */
  side: typeof HEAT_TIP_SIDE_BELOW | null
}

/**
 * Stand a heat cell's tip pill inside `grid`: line it up with the edge that keeps
 * it in, and put it on the side of the cell that has the room. Say which edge and
 * which side that was.
 *
 * The pill's box is its used box plus the padding the stylesheet gives it, since
 * the `width` and `height` a computed style reports are the content box alone.
 * Those are in the pixels the page's own styles read, and a measured box is in
 * the viewport's, so the boxes are brought over before the two are compared
 * (shared/page-zoom.ts).
 */
export function placeHeatTip(cell: HTMLElement, grid: HTMLElement): HeatTipPlacement {
  const pill = window.getComputedStyle(cell, '::after')
  const width = parseFloat(pill.width) + parseFloat(pill.paddingLeft) + parseFloat(pill.paddingRight)
  const height = parseFloat(pill.height) + parseFloat(pill.paddingTop) + parseFloat(pill.paddingBottom)
  const gridBox = inPageBox(grid.getBoundingClientRect())
  const cellBox = inPageBox(cell.getBoundingClientRect())
  const centre = cellBox.left + cellBox.width / 2
  // A pill whose box could not be read — no tip on this cell, or a page that
  // has not generated it — answers NaN here, and a comparison against NaN is
  // false, which leaves the pill centred and above.
  const edge = centre - width / 2 < gridBox.left ? 'start' : centre + width / 2 > gridBox.right ? 'end' : null
  if (edge === null) cell.removeAttribute(HEAT_TIP_EDGE_ATTR)
  else if (cell.getAttribute(HEAT_TIP_EDGE_ATTR) !== edge) cell.setAttribute(HEAT_TIP_EDGE_ATTR, edge)

  const above = cellBox.top - gridBox.top
  const below = gridBox.bottom - cellBox.bottom
  // The lower side takes the pill only where it holds more room than the upper
  // one and room enough for the pill itself: a grid squeezed too short for
  // either keeps the pill above, where it has always stood.
  const side = below > above && below >= height ? HEAT_TIP_SIDE_BELOW : null
  if (side === null) cell.removeAttribute(HEAT_TIP_SIDE_ATTR)
  else if (cell.getAttribute(HEAT_TIP_SIDE_ATTR) !== side) cell.setAttribute(HEAT_TIP_SIDE_ATTR, side)
  return { edge, side }
}
