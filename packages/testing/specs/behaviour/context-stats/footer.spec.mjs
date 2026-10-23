/**
 * @capability context-stats
 * @features context-stats, composer
 * @risk Compact statistics cover controls, move React-owned nodes or leave footer positioning behind on a mode switch.
 */
import { spec } from '../../fixtures/behaviour.mjs'
import { seatStatsSession } from '../../fixtures/stats-session.mjs'

const stats = { turns: 2, steps: 20, decodeMs: 10000, decodeTokens: 1000 }
const usage = { uncachedInputTokens: 1000, cacheReadTokens: 99000, cacheWriteTokens: 0, outputTokens: 100 }

async function reading(t) {
  return t.page.evaluate(([cardSelector, lineSelector, part, dockMark, lineMark]) => {
    const card = document.querySelector(cardSelector)
    const dock = card.parentElement.querySelector(`[${part}~="composer-dock"]`)
    const row = card.querySelector(`[${part}~="trailing"]`).parentElement
    const line = document.querySelector(lineSelector)
    const box = element => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect()
      return { left, right, top, bottom, width, height }
    }
    return {
      mode: dock.getAttribute(dockMark),
      marked: line.hasAttribute(lineMark),
      nativeParent: dock.parentElement === card.parentElement,
      lineInDock: line.parentElement === dock,
      segments: [...line.children].filter(child => child.getClientRects().length > 0).length,
      line: box(line),
      dock: box(dock),
      toolbar: box(row),
      tools: box(row.querySelector(`[${part}~="tools"]`)),
      trailing: box(row.querySelector(`[${part}~="trailing"]`)),
    }
  }, [t.host('composer.card'), t.surface('stats.inline-line'), t.surface.attribute('skin.part'), t.surface.attribute('stats.footer-dock'), t.surface.attribute('stats.footer-line')])
}

export default spec({ page: 'stats-inline' }, ({ test }) => {
  test('footer figures share the toolbar, follow alignment and restore other modes', async t => {
    await seatStatsSession(t, stats, usage)
    await t.prefs({ statsPosition: 'footer', motion: 'reduced' })
    const center = await reading(t)
    t.expectThat.equal(center.mode, 'overlay', 'the wide toolbar has room for compact figures')
    t.expectThat.equal(center.nativeParent, true, 'the host keeps its own React parent')
    t.expectThat.equal(center.lineInDock, true, 'the compact figures share the host meter dock')
    t.expectThat.equal(center.segments, 2, 'only cost and cache are shown beside the meter')
    t.expectThat.boxWithin(center.dock, center.toolbar, 'the footer fits inside the toolbar')
    t.expectThat.boxesApart(center.dock, center.tools, 'the footer leaves the left controls free')
    t.expectThat.boxesApart(center.dock, center.trailing, 'the footer leaves the right controls free')
    await t.prefs({ statsFooterAlign: 'left' })
    const left = await reading(t)
    await t.prefs({ statsFooterAlign: 'right' })
    const right = await reading(t)
    t.expectThat.equal(left.line.left < center.line.left && center.line.left < right.line.left, true, 'alignment moves the compact figures left to right')
    await t.prefs({ statsPosition: 'inline' })
    const inline = await reading(t)
    t.expectThat.equal([inline.marked, inline.mode, inline.nativeParent], [false, null, true], 'inline mode restores the native dock flow')
    t.expectThat.equal(inline.segments > center.segments, true, 'inline mode restores the fuller statistics')
    await t.prefs({ statsPosition: 'context' })
    t.expectThat.absent(await t.read.count(t.surface('stats.inline-line')), 'context mode removes the inline figures')
  })

  test('a narrow toolbar gives statistics their own line and widening restores the overlay', async t => {
    await seatStatsSession(t, stats, usage)
    await t.prefs({ statsPosition: 'footer', motion: 'reduced' })
    await t.page.setViewportSize({ width: 420, height: 844 })
    await t.page.evaluate(selector => {
      document.querySelector(selector).parentElement.style.width = '320px'
    }, t.host('composer.card'))
    await t.settle()
    const narrow = await reading(t)
    t.expectThat.equal(narrow.mode, 'below', 'the narrow toolbar leaves figures below it')
    t.expectThat.boxesApart(narrow.dock, narrow.tools, 'statistics do not cover the left controls')
    t.expectThat.boxesApart(narrow.dock, narrow.trailing, 'statistics do not cover the right controls')
    await t.page.setViewportSize({ width: 1440, height: 900 })
    await t.page.evaluate(selector => {
      document.querySelector(selector).parentElement.style.removeProperty('width')
    }, t.host('composer.card'))
    await t.settle()
    t.expectThat.equal((await reading(t)).mode, 'overlay', 'widening restores the toolbar position')
    await t.prefs({ composerScope: 'off' })
    const off = await reading(t)
    t.expectThat.equal([off.marked, off.mode], [false, null], 'disabling restyling clears footer placement')
  })
})
