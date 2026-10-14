#!/usr/bin/env node
/**
 * long-session.cjs — what a frame costs once the conversation is long (D66).
 *
 * Registered in the lane's scenario table (packages/testing/scenarios.cjs).
 *
 * The skin's per-frame cost used to follow the size of the page: a pass queried
 * the document for the host nodes it reads, and every streaming batch ran every
 * feature's sync. This scenario grows a transcript first, then streams one more
 * answer while an in-page probe times the frames, so a change to that cost is
 * judged on the numbers a long session really pays. The bounds are loose on
 * purpose — a lane runner is a shared machine — and the readings are printed
 * with every check so a regression is visible before it trips one.
 *
 * The frame timer is a `requestAnimationFrame` interval, so its readings are
 * the wall clock between frames: on a headless runner without a GPU the p50
 * sits above one 60 Hz frame for reasons that have nothing to do with the
 * skin, and the comparison that matters is the same runner before and after a
 * change to the pass (a `git worktree` of the previous revision runs the same
 * scenario).
 */
'use strict'
const { sendPrompt, waitForTurn } = require('./prompt.cjs')

/**
 * How many turns the transcript is grown by before the measured one. The
 * default keeps the scenario's own runtime near a minute; a run judging a
 * change to what a long transcript costs raises it (`DSH_LONG_SESSION_TURNS`)
 * to put hundreds of rows on the page.
 */
const FILL_TURNS = Number(process.env.DSH_LONG_SESSION_TURNS ?? 8)
/** The pause between the scripted answer's pieces: fast enough for eight fill turns, slow enough to stream. */
const STREAM_DELAY_MS = 60
/** A frame in a long session stays under this: about fifteen 60 Hz frames. */
const WORST_FRAME_MS = 250
/** Long tasks together stay under this over the measured turn. */
const LONG_TASK_BUDGET_MS = 3000

function longSessionScenario({ check }) {
  return {
    script: 'long',
    prompt: 'write a long answer',
    delayMs: STREAM_DELAY_MS,
    // A tall window, so the measured turn streams into a transcript that is
    // already several screens long rather than into an empty page.
    viewport: { width: 1280, height: 900 },
    /** The frame timer and the long-task observer, running from the page's first script. */
    initScript: () => {
      window.__longSession = { frames: [], longtasks: [] }
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__longSession.longtasks.push(Math.round(entry.duration))
      }).observe({ entryTypes: ['longtask'] })
      let last = performance.now()
      const tick = (now) => {
        window.__longSession.frames.push(Math.round((now - last) * 100) / 100)
        last = now
        // The lane's own scenarios run for minutes; a cap keeps a forgotten page from filling memory.
        if (window.__longSession.frames.length < 60000) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    },
    /** Grow the transcript, then start the measurement over: only the measured turn's frames count. */
    async beforeSend(context) {
      const { page } = context
      for (let index = 0; index < FILL_TURNS; index += 1) {
        await sendPrompt(page, `fill the transcript ${index + 1}`)
        await waitForTurn(page)
      }
      const filled = await page.evaluate(() => {
        window.__longSession.frames.length = 0
        window.__longSession.longtasks.length = 0
        return {
          nodes: document.querySelectorAll('body *').length,
          rows: document.querySelectorAll('[data-chat-flow-kind]').length,
        }
      })
      context.notes.filled = filled
    },
    async assert({ page, session, notes }) {
      const measured = await page.evaluate(() => ({
        frames: window.__longSession.frames.slice(),
        longtasks: window.__longSession.longtasks.slice(),
        nodes: document.querySelectorAll('body *').length,
        rows: document.querySelectorAll('[data-chat-flow-kind]').length,
      }))
      const frames = measured.frames.slice().sort((left, right) => left - right)
      const at = (share) => (frames.length === 0 ? 0 : frames[Math.min(frames.length - 1, Math.floor(frames.length * share))])
      const worst = frames.length === 0 ? 0 : frames[frames.length - 1]
      const over = measured.frames.filter((duration) => duration > 40).length
      const longTotal = measured.longtasks.reduce((sum, duration) => sum + duration, 0)
      const filled = notes.filled ?? { nodes: 0, rows: 0 }
      return [
        check('测量前已经积累了多轮对话，测量那一轮又长了',
          filled.rows >= FILL_TURNS * 2 && measured.rows > filled.rows,
          `rows ${filled.rows} → ${measured.rows}, nodes ${filled.nodes} → ${measured.nodes}`),
        check('采样覆盖了整条流式回答', measured.frames.length > 20, `frames=${measured.frames.length}`),
        check(`长会话里没有一帧超过 ${WORST_FRAME_MS} 毫秒`, worst < WORST_FRAME_MS,
          `p50=${at(0.5)}ms p95=${at(0.95)}ms max=${worst}ms, frames over 40ms=${over} of ${measured.frames.length}`),
        check('长时间任务没有占满这一轮', longTotal < LONG_TASK_BUDGET_MS,
          `${measured.longtasks.length} long tasks totalling ${longTotal}ms`),
        check('控制台没有异常', session.problems.length === 0, session.problems.slice(0, 3).join(' | ')),
      ]
    },
  }
}

module.exports = { longSessionScenario }
