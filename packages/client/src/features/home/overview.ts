import * as React from 'react'
import { formatHomeCount, homeShortDate, homeShortDateFormat } from './data'
import type { HeatCell, HomePanel } from './data'
import { formatCompactTokens } from '../../shared/format'
import { HEAT_CELL_SELECTOR, placeHeatTip } from './heat-tip'
import { copy } from './copy'

/**
 * The panel's Overview tab: the six stat cells, the heat grid, and Claude
 * Code's yardstick line.
 *
 * The frame is drawn before any number arrives — the cells keep their
 * geometry and show a skeleton — so the page never shifts under the pointer
 * when the roll-up lands. A figure the source cannot answer is a dash, not a
 * zero and not a skeleton: the skeleton means "still loading", which a
 * missing figure is not.
 *
 * @returns `{ view(data) }`, where `data` is `homePanelData`'s answer.
 */
export function createHomeOverview() {
  function statCell(key: string, label: string, text: string, skeleton: boolean) {
    return React.createElement(
      'div',
      { key, className: 'dsh-claude-home-stat', 'data-stat': key, 'data-skeleton': skeleton ? '' : undefined },
      React.createElement('span', { className: 'dsh-claude-home-stat-label' }, label),
      React.createElement('span', { className: 'dsh-claude-home-stat-value', title: skeleton ? undefined : text }, skeleton ? '' : text),
    )
  }

  /**
   * A heat cell's tip: the day and the tokens that day spent, "Sep 9 —
   * 15.9k tokens". Both sources behind the grid carry a per-day token total,
   * so every cell reads the same figure the cell's own heat is bucketed from.
   */
  function heatTip(format: Intl.DateTimeFormat, cell: HeatCell) {
    return copy('homeHeatTipTokens', {
      date: homeShortDate(format, cell.date),
      tokens: formatCompactTokens(cell.tokens),
    })
  }

  function view(data: HomePanel) {
    const skeleton = !data.known
    const format = homeShortDateFormat()
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        'div',
        { className: 'dsh-claude-home-stats' },
        statCell('sessions', copy('homeSessions'), data.sessions === null ? '—' : formatHomeCount(data.sessions), skeleton),
        statCell('calls', copy('homeCalls'), data.calls === null ? '—' : formatHomeCount(data.calls), skeleton),
        statCell('tokens', copy('homeTokens'), formatCompactTokens(data.tokens), skeleton),
        statCell('days', copy('homeActiveDays'), data.activeDays === null ? '—' : formatHomeCount(data.activeDays), skeleton),
        statCell('peak', copy('homePeakHour'), data.peakHour === null ? '—' : data.peakHour, skeleton),
        statCell('model', copy('homeTopModel'), data.model === null ? '—' : data.model, skeleton),
      ),
      React.createElement(
        'div',
        {
          className: 'dsh-claude-home-heat',
          'data-skeleton': data.known ? undefined : '',
          // The pill a cell carries is wider than the cell, so where it may
          // stand is decided from the width it takes on the cell the pointer
          // is over, never from a column count (heat-tip.ts).
          onMouseOver(event: React.MouseEvent<HTMLDivElement>) {
            const cell = (event.target as HTMLElement).closest?.(HEAT_CELL_SELECTOR)
            if (cell instanceof HTMLElement) placeHeatTip(cell, event.currentTarget)
          },
        },
        data.grid.cells.map(cell => {
          const tip = skeleton ? undefined : heatTip(format, cell)
          return React.createElement('span', {
            key: cell.date,
            className: 'dsh-claude-home-heat-cell',
            'data-level': cell.level,
            'data-tip': tip,
            'aria-label': tip,
          })
        }),
      ),
      data.fun === null ? null : React.createElement('span', { className: 'dsh-claude-home-fun' }, data.fun),
    )
  }

  return { view }
}
