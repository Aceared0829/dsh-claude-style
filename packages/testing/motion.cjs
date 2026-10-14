#!/usr/bin/env node
/**
 * motion.cjs — the transitions.dev surfaces on the real page (D65, D45).
 *
 * Registered in the lane's scenario table (packages/testing/scenarios.cjs).
 *
 * Each surface is read where it moves, by the animation or the transition it
 * plays and the state it comes to rest in: the home greeting rising, the usage
 * panel's numbers taking over from its placeholders, a settings switch that
 * bounces only once pressed, a settings tab sliding in while a still copy of the
 * one it replaced slides out, the overtime badge popping onto the waiting line
 * and playing its exit before it hides, and a menu card growing out of its
 * trigger and dipping only a little as it closes. The `process` script keeps the
 * model silent past the overtime mark, so the badge comes and goes in one turn.
 * The page runs the studio home, which draws the usage panel.
 */
'use strict'
const { waitForSkin } = require('./dsh-web.cjs')
const { openSkinSettings } = require('./remote-settings.cjs')

/** The host's page markers this scenario reads. */
const HOST = {
  brandMark: '[class*="fishHitbox"]', // the hero's brand mark seat (theme/hero.css)
  greeting: '[class*="fishHitbox"] + [class*="titleGroup"]', // the hero's greeting beside it
}

/** The skin's own marks (the stylesheets and modules each names). */
const SKIN = {
  revealing: 'data-dsh-claude-revealing', // home-layout.ts
  statValue: '.dsh-claude-home-stat-value',
  page: '.dsh-claude-settings',
  switch: 'fieldset.dsh-claude-settings-rows .dsh-claude-settings-switch:not(:disabled)',
  tab: '.dsh-claude-settings-tabs [role="tab"]',
  rows: '.dsh-claude-settings-pages > fieldset.dsh-claude-settings-rows',
  leaving: '.dsh-claude-settings-leaving',
  badge: '.dsh-claude-chat-wait-badge',
  badgeLeaving: 'data-dsh-claude-wait-badge-leaving', // chat-wait.ts
  modelButton: '.dsh-claude-model-btn',
  modelCard: '.dsh-claude-model-popover:not(.dsh-claude-model-popover-sub)',
}

/** Longer than any entrance or exit the token table holds. */
const SETTLE_MS = 600

/** Record every hand-over the usage panel plays, from the page's first frame. */
function watchReveal(marks) {
  window.__motionReveal = []
  new MutationObserver((records) => {
    for (const record of records) {
      const panel = record.target
      if (!(panel instanceof Element) || !panel.hasAttribute(marks.revealing)) continue
      const value = panel.querySelector(marks.statValue)
      window.__motionReveal.push({ words: value === null ? null : getComputedStyle(value).animationName })
    }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: [marks.revealing] })
}

/** The animation an element plays, its delay, and nothing when it is not there. */
const animationOf = (page, selector) => page.evaluate((target) => {
  const element = document.querySelector(target)
  if (element === null) return null
  const style = getComputedStyle(element)
  return { name: style.animationName, delay: style.animationDelay }
}, selector)

/**
 * The settings switch: read at rest, read the moment a press lands, and left
 * with the value it had. The scenario's own patch layer stands over the saved
 * settings, so a written value can come back to the one the layers resolve
 * to; the switch is pressed again only when it has not.
 */
async function readSwitch(page) {
  const control = page.locator(SKIN.switch).first()
  const knob = () => control.evaluate((element) => {
    const style = getComputedStyle(element.querySelector('.dsh-claude-settings-switch-knob'))
    return { label: element.getAttribute('aria-label'), moved: element.hasAttribute('data-moved'), on: element.hasAttribute('data-on'), animation: style.animationName }
  })
  const settled = async () => {
    await page.waitForTimeout(SETTLE_MS)
    return knob()
  }
  const before = await knob()
  await control.click()
  const pressed = await knob()
  let after = await settled()
  if (after.on !== before.on) {
    await control.click()
    after = await settled()
  }
  return { before, pressed, after }
}

/** A tab change: the tab arriving and the still copy of the one leaving, read at once and after the slide. */
async function readTabSlide(page) {
  await page.locator(SKIN.tab).nth(1).click()
  const during = await page.evaluate((marks) => {
    const rows = document.querySelector(marks.rows)
    const still = document.querySelector(`${marks.leaving} > *`)
    return {
      enter: rows === null ? null : rows.getAttribute('data-dsh-claude-page-enter'),
      enterAnimation: rows === null ? null : getComputedStyle(rows).animationName,
      leave: still === null ? null : still.getAttribute('data-dsh-claude-page-leave'),
      leaveAnimation: still === null ? null : getComputedStyle(still).animationName,
      hidden: still === null ? null : still.getAttribute('aria-hidden') === 'true' && still.hasAttribute('inert') && !still.hasAttribute('role'),
    }
  }, SKIN)
  await page.waitForTimeout(SETTLE_MS)
  const after = await page.evaluate((marks) => document.querySelectorAll(`${marks.leaving} > *`).length, SKIN)
  return { during, after }
}

/** The model card: open and settled, then closed and settled. */
async function readMenu(page) {
  const card = () => page.evaluate((marks) => {
    const element = document.querySelector(marks.modelCard)
    if (element === null) return null
    const style = getComputedStyle(element)
    return { open: element.getAttribute('data-open'), scale: style.scale, transform: style.transform, opacity: style.opacity, visibility: style.visibility }
  }, SKIN)
  await page.locator(SKIN.modelButton).first().click()
  await page.waitForTimeout(SETTLE_MS)
  const opened = await card()
  // A press on the trigger keeps a card the hover opened; Escape closes it.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(SETTLE_MS)
  const closed = await card()
  return { opened, closed }
}

function motionScenario({ check }) {
  return {
    script: 'process',
    prompt: 'take your time, then answer',
    viewport: { width: 1280, height: 900 },
    patch: [
      '- id: ui-skin-claude-style',
      '  config:',
      '    homeLayout: studio',
    ],
    initScript: { content: `(${watchReveal.toString()})(${JSON.stringify(SKIN)})` },
    /** The home page before the turn: the greeting, the panel, the settings page. */
    async beforeSend(context) {
      const { page, notes } = context
      await waitForSkin(page)
      notes.mark = await animationOf(page, HOST.brandMark)
      notes.greeting = await animationOf(page, HOST.greeting)
      await page.waitForFunction(() => (window.__motionReveal ?? []).length > 0, undefined, { timeout: 30000 }).catch(() => {})
      notes.reveal = await page.evaluate(() => window.__motionReveal ?? [])
      await openSkinSettings(page)
      notes.slide = await readTabSlide(page)
      // The composer tab carries switches of its own; the general tab has none.
      await page.locator(SKIN.tab).nth(2).click()
      await page.waitForTimeout(SETTLE_MS)
      notes.switch = await readSwitch(page)
      await page.keyboard.press('Escape')
      await page.locator(SKIN.page).first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
    },
    /** The overtime badge: out once the silence runs over, then its exit before it hides. */
    async duringTurn(context) {
      const { page, notes } = context
      await page.waitForSelector(`${SKIN.badge}:not([hidden])`, { timeout: 20000 })
      notes.badgeIn = await animationOf(page, `${SKIN.badge}:not([hidden])`)
      // The exit lasts one exit duration, shorter than a poll can be trusted to
      // see: the page records the leaving mark itself, and whether the badge was
      // still laid out when it arrived.
      await page.evaluate((marks) => {
        const badge = document.querySelector(marks.badge)
        window.__motionBadge = []
        new MutationObserver(() => {
          window.__motionBadge.push({ leaving: badge.hasAttribute(marks.badgeLeaving), hidden: badge.hidden })
        }).observe(badge, { attributes: true, attributeFilter: [marks.badgeLeaving, 'hidden'] })
      }, SKIN)
      await page.waitForFunction((marks) => document.querySelector(marks.badge).hidden, SKIN, { timeout: 30000 })
      notes.badgeSteps = await page.evaluate(() => window.__motionBadge)
    },
    async afterTurn(context) {
      context.notes.menu = await readMenu(context.page)
    },
    async assert({ session, notes }) {
      const reveal = notes.reveal ?? []
      const sw = notes.switch ?? {}
      const slide = notes.slide ?? {}
      const menu = notes.menu ?? {}
      const closedScale = Number.parseFloat(menu.closed?.scale ?? 'NaN')
      return [
        check('首页标题的标志与问候语错开升起',
          notes.mark?.name === 'dsh-claude-hero-rise' && notes.greeting?.name === 'dsh-claude-hero-rise' && notes.greeting?.delay !== '0s' && notes.mark?.delay === '0s',
          JSON.stringify({ mark: notes.mark, greeting: notes.greeting })),
        check('用量面板的数字到达时从占位里显出来',
          reveal.length > 0 && reveal[0].words === 'dsh-claude-home-reveal-words', JSON.stringify(reveal)),
        check('开关打开页面时静止，按下的那一刻才弹跳着过去，最后留下原来的值',
          sw.before?.moved === false && sw.before?.animation === 'none' &&
            sw.pressed?.moved === true && sw.pressed?.on !== sw.before?.on &&
            sw.pressed?.animation === (sw.pressed?.on ? 'dsh-claude-switch-on' : 'dsh-claude-switch-off') &&
            sw.after?.on === sw.before?.on,
          JSON.stringify(sw)),
        check('切到右侧的标签时新页从右侧滑入，旧页的静止副本向左滑出、不进入读屏与 Tab 顺序，播完即移除',
          slide.during?.enter === 'forward' && slide.during?.enterAnimation === 'dsh-claude-page-in' &&
            slide.during?.leave === 'forward' && slide.during?.leaveAnimation === 'dsh-claude-page-out' && slide.during?.hidden === true && slide.after === 0,
          JSON.stringify(slide)),
        check('超时徽标弹出时滑入，离开时先播完退出再隐藏',
          notes.badgeIn?.name === 'dsh-claude-wait-badge-in' &&
            JSON.stringify(notes.badgeSteps) === JSON.stringify([{ leaving: true, hidden: false }, { leaving: false, hidden: true }]),
          JSON.stringify({ in: notes.badgeIn, steps: notes.badgeSteps })),
        check('菜单卡片展开后停在原尺寸，收起后回到从触发点长出的起始比例',
          menu.opened?.open === 'true' && menu.opened?.scale === '1' && menu.opened?.transform === 'none' && menu.opened?.opacity === '1' &&
            menu.closed?.open === 'false' && menu.closed?.visibility === 'hidden' && Math.abs(closedScale * 0.99 - 0.97) < 0.001 &&
            /^matrix\(0\.99, 0, 0, 0\.99,/.test(menu.closed?.transform ?? ''),
          JSON.stringify(menu)),
        check('控制台没有异常', session.problems.length === 0, session.problems.slice(0, 3).join(' | ')),
      ]
    },
  }
}

module.exports = { motionScenario }
