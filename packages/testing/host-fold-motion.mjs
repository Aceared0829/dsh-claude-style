#!/usr/bin/env node
/**
 * host-fold-motion.mjs — the host's own fold motion over a process group the
 * reader closes, end to end (D71, D40, D77).
 *
 * Registered in the lane's scenario table (packages/testing/scenarios.mjs).
 *
 * The chat target's work-details presentation defers a completed turn's folding
 * to the next input (`collapseTiming: next-input`), and while a turn runs the
 * host writes `data-chat-motion` on the message column and moves a closing row
 * itself: the row fades, then its height and margin close over 110 ms
 * (dsh-client-ui-chat's flow-motion). The skin hands the reader's press to the
 * host and keeps no height animation of its own, so the group the reader closes
 * has to shrink once, with no frame of it growing back, and the skin's stream
 * slide must not move the column while the host is moving the scroller.
 *
 * The `tailReasoning` script reasons at the tail of a full screen inside a
 * process group. The scenario waits for that reasoning, presses the group's
 * header the way the host's own control takes a press, and samples the page
 * every frame from the press until the host's marks have left.
 */

/** The host's page markers this scenario reads, as packages/testing/lane.mjs names them. */
const HOST = {
  scroller: '[data-conversation-scroll]', // CONVERSATION_SCROLL_SELECTOR
  column: '[data-chat-flow]', // CHAT_FLOW_SELECTOR
  group: '[data-step-process]', // PROCESS_GROUP_SELECTOR
  body: '[data-step-process-body]', // PROCESS_BODY_SELECTOR
  reasoning: '[data-variant="think"][data-state="running"]', // THINK_ROW_SELECTOR in its running phase
}

/**
 * Sample the page once per frame: the group's root and body, the scroller, the
 * column's transform, and the host's own fold marks.
 *
 * @param page - the lane's page.
 * @returns once the sampler is running; the frames land in the page's own global.
 */
function watch(page) {
  return page.evaluate((marks) => {
    const trace = []
    window.__hostFoldTrace = trace
    window.__hostFoldPress = null
    const column = document.querySelector(marks.column)
    const sample = () => {
      if (trace.length >= 6000) return
      if (column === null || !column.isConnected) {
        trace.push({ gone: true })
        requestAnimationFrame(sample)
        return
      }
      const groups = [...document.querySelectorAll(marks.group)]
      const group = groups[groups.length - 1] ?? null
      const body = group === null ? null : group.querySelector(marks.body)
      const scroller = document.querySelector(marks.scroller)
      // A column whose transform is not painted answers 'none'; anything else is
      // the skin's slide carrying a distance (chat-follow.ts, D71).
      const transform = getComputedStyle(column).transform
      const translate = transform === 'none' ? 0 : new DOMMatrix(transform).m42
      trace.push({
        t: Math.round(performance.now()),
        groupHeight: group === null ? null : Math.round(group.getBoundingClientRect().height * 10) / 10,
        bodyHeight: body === null ? null : Math.round(body.getBoundingClientRect().height * 10) / 10,
        bodyHidden: body === null ? null : body.hasAttribute('hidden'),
        scrollTop: scroller === null ? null : Math.round(scroller.scrollTop),
        scrollHeight: scroller === null ? null : Math.round(scroller.scrollHeight),
        following: column.closest('[data-chat-following-tail]') !== null,
        scope: column.hasAttribute('data-chat-motion'),
        collapse: column.querySelectorAll('[data-chat-motion="collapse"]').length,
        reveal: column.querySelectorAll('[data-chat-motion="reveal"]').length,
        translate: Math.round(translate * 10) / 10,
        animations: column.getAnimations().length,
      })
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  }, HOST)
}

/**
 * Press the newest process group's header twice, the way a reader closes a
 * running group: the first press opens the host's own disclosure, which the
 * skin's mark had left closed, and the group keeps standing; the second press
 * is the one the host folds it on. The frame the second press landed on is the
 * one marked.
 *
 * @returns what the header said before the opening press, what it said before
 *     the closing one, and the frame the closing press landed on; null when
 *     there was no header.
 */
async function pressGroup(page) {
  const before = await page.evaluate((marks) => {
    const groups = [...document.querySelectorAll(marks.group)]
    const group = groups[groups.length - 1]
    const header = group === undefined ? null : group.querySelector('[aria-controls]')
    if (!(header instanceof HTMLElement)) return null
    const expanded = header.getAttribute('aria-expanded')
    header.click()
    return expanded
  }, HOST)
  if (before === null) return null
  return page.evaluate(({ marks, expanded }) => {
    const groups = [...document.querySelectorAll(marks.group)]
    const group = groups[groups.length - 1]
    const header = group.querySelector('[aria-controls]')
    window.__hostFoldPress = window.__hostFoldTrace.length
    header.click()
    return { expanded, at: window.__hostFoldPress }
  }, { marks: HOST, expanded: before })
}

function hostFoldMotionScenario({ check }) {
  return {
    script: 'tailReasoning',
    prompt: 'list the files and think it over',
    delayMs: 300,
    viewport: { width: 1280, height: 600 },
    // The chat target's presentation: a capped process group to press, and the
    // host's own fold motion on while a turn runs.
    patch: [
      '- id: ui-chat',
      '  config:',
      '    transcriptView: standard',
      '    collapseTiming: next-input',
    ],
    /**
     * Wait for the running group to reason at the tail of a full screen, press
     * its header, and keep sampling until the host's own fold has landed.
     */
    async duringTurn(context) {
      const { page } = context
      await watch(page)
      await page.waitForFunction((marks) => {
        const scroller = document.querySelector(marks.scroller)
        const column = document.querySelector(marks.column)
        const groups = [...document.querySelectorAll(marks.group)]
        const group = groups[groups.length - 1]
        if (scroller === null || column === null || group === undefined) return false
        const body = group.querySelector(marks.body)
        // The body the skin shows is drawn while the host still keeps it folded.
        if (body === null || body.getBoundingClientRect().height === 0) return false
        if (group.querySelector(marks.reasoning) === null) return false
        return scroller.scrollHeight - scroller.clientHeight > scroller.clientHeight / 2
      }, HOST, { timeout: 30000 })
      context.notes.press = await pressGroup(page)
      // The host's own mark on the row it closes: waited for, then waited out.
      await page.waitForFunction(() => {
        const press = window.__hostFoldPress
        const frames = window.__hostFoldTrace
        if (press === null || frames.length - press < 4) return false
        const since = frames.slice(press)
        const tail = since.slice(-3)
        return since.some((frame) => (frame.collapse ?? 0) > 0 || (frame.reveal ?? 0) > 0) &&
          tail.every((frame) => (frame.collapse ?? 0) === 0 && (frame.reveal ?? 0) === 0)
      }, undefined, { timeout: 10000 })
      // A stretch for the position and the layout to come to rest after the mark.
      await page.waitForTimeout(500)
      context.notes.stop = await page.evaluate(() => window.__hostFoldTrace.length)
      context.notes.streaming = await page.evaluate((marks) => document.querySelector(marks.reasoning) !== null, HOST)
    },
    async afterTurn(context) {
      context.notes.trace = await context.page.evaluate(() => window.__hostFoldTrace ?? [])
    },
    async assert({ session, notes }) {
      const trace = notes.trace ?? []
      const press = notes.press ?? null
      const from = press?.at ?? 0
      const frames = trace.slice(from, notes.stop ?? trace.length)
      // Only the frames the host's marks are on: the stretch a reader sees the
      // host move a row.
      const marked = frames.filter((frame) => (frame.collapse ?? 0) > 0 || (frame.reveal ?? 0) > 0)
      const heights = frames.map((frame) => frame.groupHeight).filter((height) => typeof height === 'number')
      const grew = heights.filter((height, at) => at > 0 && height > heights[at - 1] + 0.5)
      const moved = marked.filter((frame) => Math.abs(frame.translate ?? 0) > 0.5 || (frame.animations ?? 0) > 0)
      const last = frames[frames.length - 1] ?? {}
      return [
        check('宿主自己的折叠动效在这段输出里开着',
          notes.press !== null && frames[0]?.scope === true && marked.length > 0,
          `scope=${frames[0]?.scope} marked=${marked.length} of ${frames.length} frames, press=${JSON.stringify(press)}`),
        check('读者合上运行中的过程组时，宿主真的滚动了这一行',
          marked.length > 0 && heights.length > 1 && heights[0] - heights[heights.length - 1] > 20,
          `group ${heights[0]} → ${heights[heights.length - 1]} over ${frames.length} frames`),
        check('组只收起一次，没有回弹',
          heights.length > 1 && grew.length === 0 && (last.bodyHidden === true),
          `grew on ${grew.length} frames${grew.length === 0 ? '' : ` (${JSON.stringify(grew.slice(0, 3))})`}, bodyHidden=${last.bodyHidden}, heights=${JSON.stringify(heights.slice(0, 6))}…${JSON.stringify(heights.slice(-3))}`),
        check('宿主收起期间皮肤的流式位移不推消息列',
          moved.length === 0,
          `${moved.length} of ${marked.length} host-motion frames with the column moving: ${JSON.stringify(moved.slice(0, 3).map((frame) => ({ translate: frame.translate, animations: frame.animations })))}`),
        check('控制台没有异常', session.problems.length === 0, session.problems.slice(0, 3).join(' | ')),
      ]
    },
  }
}

export { hostFoldMotionScenario }
