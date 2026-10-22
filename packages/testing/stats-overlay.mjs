#!/usr/bin/env node
/**
 * stats-overlay.mjs — the meter's dock laid over the toolbar row (D77).
 *
 * Registered in the lane's scenario table through packages/testing/stats-position.mjs.
 *
 * The dock is the card's next sibling and the stylesheet lays it over the
 * toolbar row from the row's own box: its distance above the containing block
 * and its height come from custom properties the composer pass measures, because
 * both are the host's. A host whose card leaves a different gap under that row
 * used to put the meter several pixels off the row's line. This scenario holds
 * the context position, moves that gap on the real page and asserts the overlay
 * follows the row: the box the numbers' meter stands on is the box the model and
 * effort triggers stand on.
 */

/**
 * The skin's own marks, read off the surface table rather than spelled here
 * (D77): the table is what a lane names a skin mark through.
 */
import surfaceTable from './data/surface.json' with { type: 'json' }

const SURFACE = surfaceTable.surface
const mark = (id) => {
  const entry = SURFACE.find((candidate) => candidate.id === id)
  if (entry === undefined || entry.attribute === undefined) throw new Error(`stats-overlay: surface "${id}" names no attribute`)
  return entry.attribute
}
const PAGE_ZOOM = mark('skin.page-zoom')
const CONTEXT_METER = mark('stats.context-meter')
const CONTEXT_PANEL = mark('stats.context-panel')
const CONTEXT_PANEL_PLACED = mark('stats.context-panel-placed')

/** The row's box, the dock's box, the pill's own box and the properties the overlay reads. */
const readOverlay = (page) => page.evaluate(() => {
  const card = document.querySelector('[data-composer-card]')
  const row = card?.querySelector('[data-dsh-claude-part~="trailing"]')?.parentElement ?? null
  const cluster = card?.querySelector('[data-dsh-claude-part~="trailing"]') ?? null
  const meter = document.querySelector('[data-dsh-claude-context-meter]')
  const trigger = meter?.querySelector('button') ?? null
  const dock = card?.nextElementSibling ?? null
  const box = (el) => {
    if (el === null || el === undefined) return null
    const b = el.getBoundingClientRect()
    return { left: Math.round(b.left * 100) / 100, right: Math.round(b.right * 100) / 100, top: Math.round(b.top * 100) / 100, bottom: Math.round(b.bottom * 100) / 100, height: Math.round(b.height * 100) / 100 }
  }
  const z = (el) => el === null || el === undefined ? null : getComputedStyle(el).zIndex
  // The row's box rides the card's parent, the ancestor both readers share.
  const style = getComputedStyle(card?.parentElement ?? document.body)
  const clusterBox = box(cluster)
  const pillBox = box(trigger)
  return {
    row: box(row),
    dock: box(dock),
    meter: box(meter),
    pill: pillBox,
    pillGap: clusterBox === null || pillBox === null ? null : Math.round((pillBox.left - clusterBox.right) * 100) / 100,
    offset: style.getPropertyValue('--dsh-claude-meter-row-offset').trim(),
    height: style.getPropertyValue('--dsh-claude-meter-row-height').trim(),
    z: { card: z(card), dock: z(dock), meter: z(meter) },
  }
})

/**
 * Move the card's own gap under the row, let the row's size watcher take the new
 * reading and the page settle on it, and read the boxes again.
 */
const readOverlayWithGap = async (page, gap) => {
  await page.evaluate((value) => {
    const card = document.querySelector('[data-composer-card]')
    if (card !== null) card.style.marginBottom = value
  }, gap)
  await page.waitForTimeout(900)
  const reading = await readOverlay(page)
  await page.evaluate(() => {
    const card = document.querySelector('[data-composer-card]')
    if (card !== null) card.style.marginBottom = ''
  })
  await page.waitForTimeout(900)
  return reading
}

/**
 * A host whose meter trigger reaches outside the node it is parked in: the pill
 * is shifted 14px left inside its wrapper, so the room has to cover the pill
 * rather than the wrapper. Read, then put the trigger back.
 */
const readOverlayWithWidePill = async (page) => {
  const reading = await page.evaluate(() => {
    const trigger = document.querySelector('[data-dsh-claude-context-meter] button')
    if (trigger === null) return null
    trigger.style.marginLeft = '-14px'
    return true
  })
  if (reading !== true) return null
  await page.waitForTimeout(900)
  const read = await readOverlay(page)
  await page.evaluate(() => {
    const trigger = document.querySelector('[data-dsh-claude-context-meter] button')
    if (trigger !== null) trigger.style.marginLeft = ''
  })
  await page.waitForTimeout(900)
  return read
}

/** Whether the dock stands on the row's own line, as the overlay is supposed to place it. */
const onTheRow = (reading) => reading !== null && reading.dock !== null && reading.row !== null &&
  reading.dock.top === reading.row.top && reading.dock.height === reading.row.height

/**
 * Open the host's `@` menu in the composer and read where the dock stands while
 * it is up: the host renders that menu into the card's overlay seat, and a menu
 * row's own cluster is no composer row, so the reading taken with it open is the
 * one that shows whether the dock was measured off the menu (issue #102).
 *
 * The reading is taken after the card's own gap under the row moves, the way the
 * sibling checks force one: the composer measures the row when its box or the
 * stack's changes, so a menu opened over a settled card is read against the row
 * the last measurement found. Moving the gap is the reader's own case — a draft
 * that grows the card does the same — and it is what puts the open menu in front
 * of the measurement. What the reading is judged against is therefore the dock
 * the same gap gives with no menu up, not a row the same query answers with: a
 * menu row that wrongly took the cluster's part would otherwise be both the row
 * and the thing measured against it, and the two would agree.
 */
const readOverlayWithMenu = async (page) => {
  const input = page.locator('[data-composer-input]')
  await input.click()
  await page.keyboard.type('@')
  const menu = page.locator('[data-trigger-menu]')
  await menu.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(600)
  const open = await menu.count() > 0
  const inCard = await page.evaluate(() => {
    const card = document.querySelector('[data-composer-card]')
    const found = document.querySelector('[data-trigger-menu]')
    return found === null || card === null ? null : card.contains(found)
  })
  // Every mark of the skin's own namespace inside the menu, whatever it names.
  const measured = await page.evaluate((prefix) => {
    const menu = document.querySelector('[data-trigger-menu]')
    if (menu === null) return null
    const marked = [...menu.querySelectorAll('*')]
      .flatMap((el) => [...el.attributes].filter((attribute) => attribute.name.startsWith(prefix)).map((attribute) => attribute.name))
    return { marks: marked.slice(0, 6), marked: marked.length }
  }, 'data-dsh-claude-')
  const nudged = await readOverlayWithGap(page, '-4px')
  // The press left a draft behind; it goes again, and the page settles back.
  await page.evaluate(() => {
    const input = document.querySelector('[data-composer-input]')
    if (input === null) return
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(input)
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.execCommand('delete')
  })
  await page.waitForTimeout(600)
  return { open, inCard, measured, nudged, closed: await readOverlay(page) }
}

/**
 * The context popover at a page zoom: the page is put at the factor the
 * preference mirror writes onto <body> (the stylesheet draws the page at that
 * attribute, and the skin's geometry reads it back — shared/page-zoom.ts), the
 * popover is opened from the meter, and the boxes are read.
 *
 * The host places the panel from the trigger's box in the window's pixels and
 * writes them into the inline style, which the zoom scales again; the skin reads
 * the meter and the window in the panel's own pixels and places it there.
 */
const readContextPopoverAtZoom = async (page, zoom) => {
  await page.evaluate(([attribute, value]) => document.body.setAttribute(attribute, value), [PAGE_ZOOM, zoom])
  await page.waitForTimeout(700)
  const opened = await page.evaluate((meter) => {
    const trigger = document.querySelector(`[${meter}] button`)
    if (trigger === null) return false
    trigger.click()
    return true
  }, CONTEXT_METER)
  await page.waitForTimeout(1000)
  const reading = opened ? await page.evaluate(([panelMark, placedMark, meterMark]) => {
    const panel = document.querySelector(`[${panelMark}]`)
    const meter = document.querySelector(`[${meterMark}]`)
    if (panel === null || meter === null) return null
    const box = (el) => {
      const b = el.getBoundingClientRect()
      const round = (value) => Math.round(value * 10) / 10
      return { left: round(b.left), top: round(b.top), right: round(b.right), bottom: round(b.bottom), width: round(b.width), height: round(b.height) }
    }
    return {
      aligned: panel.hasAttribute(placedMark),
      panel: box(panel),
      meter: box(meter),
      window: { width: innerWidth, height: innerHeight },
      zoom: Number.parseFloat(getComputedStyle(document.body).zoom),
    }
  }, [CONTEXT_PANEL, CONTEXT_PANEL_PLACED, CONTEXT_METER]) : null
  await page.evaluate(([attribute, meter]) => {
    document.body.removeAttribute(attribute)
    document.querySelector(`[${meter}] button`)?.click()
  }, [PAGE_ZOOM, CONTEXT_METER])
  await page.waitForTimeout(700)
  return reading
}

function statsOverlayScenario({ check }) {
  return {
    script: 'greeting',
    prompt: 'hello there',
    patch: [
      '- id: ui-skin-claude-style',
      '  config:',
      '    statsPosition: context',
    ],
    async assert({ page, session }) {
      await page.waitForFunction(
        () => document.querySelector('[data-dsh-claude-context-meter]') !== null,
        undefined, { timeout: 20000 },
      ).catch(() => {})
      const resting = await readOverlay(page)
      // The overlay is a positioning layer: the dock itself must not stand over
      // the card, or a host that paints its stats band covers the toolbar row's
      // own controls (issue #86). The meter is the one child lifted back above.
      const stacking = resting.z
      // The host's own gap under the row, moved the way a host that leaves a
      // different one would: the overlay has to follow the row, not the number
      // this window happens to leave. Zero is the reading the issue reported.
      const flush = await readOverlayWithGap(page, '-4px')
      const wider = await readOverlayWithGap(page, '12px')
      const restored = await readOverlay(page)
      // The pill, reaching outside the node the host parks it in.
      const widePill = await readOverlayWithWidePill(page)
      // The host's own `@` menu, mounted in the card's overlay seat: a menu row is
      // no composer row, so the dock must not follow it (issue #102).
      const withMenu = await readOverlayWithMenu(page)
      // The context popover on the same real page, at the reader's page zoom.
      const popover = await readContextPopoverAtZoom(page, '1.25')
      const popoverGap = popover === null ? null : (popover.meter.top - popover.panel.bottom) / popover.zoom
      return [
        check('the dock stands on the toolbar row\'s own line, measured off the row rather than assumed',
          onTheRow(resting) && Number.parseFloat(resting.offset) >= 0 && Number.parseFloat(resting.height) > 0,
          JSON.stringify(resting)),
        check('the dock is a positioning layer: the card and its row stand above it, and the meter stands above the card',
          stacking.dock === 'auto' && Number(stacking.card) > 0 && Number(stacking.meter) > Number(stacking.card),
          JSON.stringify(stacking)),
        check('a card leaving no gap under that row still keeps the meter on the row\'s line',
          onTheRow(flush) && Number.parseFloat(flush.offset) === 0,
          JSON.stringify(flush)),
        check('a card leaving a wider gap under that row keeps the meter on the row\'s line',
          onTheRow(wider) && Number.parseFloat(wider.offset) === Number.parseFloat(resting.offset) + 12,
          JSON.stringify(wider)),
        check('the reading follows the gap back when the host leaves it as it was',
          onTheRow(restored) && Number.parseFloat(restored.offset) === Number.parseFloat(resting.offset),
          JSON.stringify(restored)),
        check('the room covers the pill itself: a trigger reaching outside the node it is parked in keeps 8px clear of the row\'s text',
          widePill !== null && widePill.pillGap !== null && widePill.pillGap >= 7,
          JSON.stringify(widePill === null ? null : { pillGap: widePill.pillGap, meter: widePill.meter, pill: widePill.pill })),
        check('the host\'s @ menu opens inside the composer card, and the dock keeps the line the same gap gives with no menu up',
          withMenu.open && withMenu.inCard === true &&
            withMenu.nudged.dock !== null && flush.dock !== null &&
            withMenu.nudged.dock.top === flush.dock.top && withMenu.nudged.dock.height === flush.dock.height &&
            withMenu.nudged.offset === flush.offset,
          JSON.stringify({ withMenu, flush })),
        check('a menu row is no composer row: the open menu carries none of the composer\'s marks',
          withMenu.measured !== null && withMenu.measured.marked === 0,
          JSON.stringify(withMenu.measured)),
        check('closing the menu puts the page back where it stood',
          onTheRow(withMenu.closed) && withMenu.closed.offset === resting.offset,
          JSON.stringify({ closed: withMenu.closed, resting })),
        check('页面缩放到 125% 时，上下文弹层仍贴在计量圆环上方并留在窗口内',
          popover !== null && popover.aligned && popover.zoom === 1.25 &&
            popoverGap >= 7 && popoverGap <= 9 &&
            popover.panel.top >= 0 && popover.panel.bottom <= popover.window.height + 1,
          JSON.stringify(popover === null ? null : { ...popover, gap: popoverGap })),
        check('控制台没有异常', session.problems.length === 0, session.problems.slice(0, 3).join(' | ')),
      ]
    },
  }
}

export { statsOverlayScenario }
