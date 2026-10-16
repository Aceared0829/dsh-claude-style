import { afterEach, expect, test } from 'vitest'
import { installParts } from './parts'
import { HOLDS_ATTR, PART_ATTR, TEST_VOCABULARY } from './test-vocabulary'

/**
 * The holds a stylesheet reads as structure (D9): core/parts.ts answers the
 * relations in core/parts-table.ts from the same walk that writes the parts, so
 * a rule matching an element by what its subtree contains reads one attribute
 * instead of asking the browser on every change below it.
 */

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  document.body.replaceChildren()
})

/** The hold mark on an element, or null. */
const holds = (element: Element | null) => element === null ? null : element.getAttribute(HOLDS_ATTR)

/** The part mark on an element, or null. */
const partOf = (selector: string) => document.querySelector(selector)?.getAttribute(PART_ATTR) ?? null

test('a header holding the tab strip reads the mark, and loses it with the strip', async () => {
  document.body.innerHTML =
    '<div data-slot="conversation.header"><div class="_header_ab"><div class="_titleRow_ab"></div><div class="_tabs_ab"></div></div></div>'
  cleanups.push(installParts(TEST_VOCABULARY))
  const header = document.querySelector('[data-test-part~="conversation-header"]')
  expect(holds(header)).toBe('view-tabs')
  const strip = partOf('[data-test-part~="view-tabs"]')
  expect(strip).toBe('view-tabs')

  document.querySelector('[data-test-part~="view-tabs"]')!.remove()
  await settle()
  expect(holds(header)).toBeNull()
})

test('a hold as its own child counts the direct child alone', async () => {
  document.body.innerHTML =
    '<div data-slot="root"><div class="_frame_ab"><div class="_sidebarCol_ab"></div><div class="_centerCol_ab"></div></div></div>'
  cleanups.push(installParts(TEST_VOCABULARY))
  const frame = document.querySelector('[data-test-part~="layout-frame"]')
  expect(holds(frame)).toBe('sidebar-column')

  // The same column one box deeper is not the frame's own child, so the rule
  // that reads `A:has(> B)` stays quiet.
  const column = document.querySelector('[data-test-part~="sidebar-column"]')!
  const wrapper = document.createElement('div')
  wrapper.className = '_slot_wrap_ab'
  column.parentElement!.appendChild(wrapper)
  wrapper.appendChild(column)
  await settle()
  expect(holds(frame)).toBeNull()
})

test('an unnamed wrapper takes the mark for what it holds, the scope anchor does not', async () => {
  document.body.innerHTML =
    '<div data-conversation-scroll><div class="_composerHero_ab"><div class="_headSeat_ab">' +
    '<div class="_headline_ab"><div class="_fishHitbox_ab"></div></div></div>' +
    '<div class="_composerStack_ab"><div class="_tray_ab"><div class="_card_ab" data-composer-card=""></div></div></div>' +
    '</div></div>'
  cleanups.push(installParts(TEST_VOCABULARY))
  const seat = document.querySelector('[class~="_headSeat_ab"]')
  expect(holds(seat)).toBe('hero-headline')
  expect(holds(document.querySelector('[data-test-part~="composer-hero"]'))).toBeNull()
  expect(holds(document.querySelector('[data-test-part~="hero-headline"]'))).toBe('hero-mark')
  expect(holds(document.querySelector('[class~="_tray_ab"]'))).toBe('composer-card')
  expect(holds(document.querySelector('[data-test-part~="composer-stack"]'))).toBeNull()
  expect(holds(document.querySelector('[data-composer-card]'))).toBeNull()
})

test('a holder that takes its attribute after the node it holds still marks it', async () => {
  document.body.innerHTML = '<div class="_phase_ab"><div data-conversation-scroll=""></div></div>'
  cleanups.push(installParts(TEST_VOCABULARY))
  const phase = document.querySelector('[class~="_phase_ab"]')
  expect(holds(phase)).toBeNull()
  phase!.setAttribute('data-phase', 'active')
  await settle()
  expect(holds(phase)).toBe('conversation-scroll')
})

test('a dialog holding the host\'s statistics reads the mark, and one outside the relation does not', async () => {
  document.body.innerHTML =
    '<div role="dialog"><div class="_stats_ab" data-session-stats-details=""></div></div>' +
    '<div role="dialog"><div class="_rows_ab"></div></div>'
  cleanups.push(installParts(TEST_VOCABULARY))
  const dialogs = document.querySelectorAll('[role="dialog"]')
  expect(holds(dialogs[0])).toBe('host-stats')
  expect(holds(dialogs[1])).toBeNull()
})

test('the foot area marks its boxes around the host row, and nothing above the scope', async () => {
  document.body.innerHTML =
    '<div data-slot="sidebar"><div class="_root_ab"><div class="_footArea_ab"><div class="_settingsArea_ab">' +
    '<div class="_triggerRow_ab"><button data-dsh-claude-account-host-row=""></button></div></div></div></div></div>'
  cleanups.push(installParts(TEST_VOCABULARY))
  expect(holds(document.querySelector('[data-test-part~="settings-trigger"]'))).toBe('account-row')
  expect(holds(document.querySelector('[data-test-part~="settings-area"]'))).toBe('account-row')
  const root = document.querySelector('[data-test-part~="sidebar-root"]')
  expect(holds(root)).toBeNull()
  const foot = document.querySelector('[data-test-part~="foot-area"]')
  expect(holds(foot)).toBeNull()

  document.querySelector('[data-dsh-claude-account-host-row]')!.remove()
  await settle()
  expect(holds(document.querySelector('[data-test-part~="settings-trigger"]'))).toBeNull()
})

test('the teardown takes every hold mark off with the parts', async () => {
  document.body.innerHTML =
    '<div data-slot="conversation.header"><div class="_header_ab"><div class="_tabs_ab"></div></div></div>'
  const dispose = installParts(TEST_VOCABULARY)
  expect(holds(document.querySelector('[data-test-part~="conversation-header"]'))).toBe('view-tabs')
  dispose()
  expect(document.querySelectorAll(`[${HOLDS_ATTR}]`).length).toBe(0)
  expect(document.querySelectorAll(`[${PART_ATTR}]`).length).toBe(0)
})
