/**
 * The line of statistics under the composer counts from the figures it shows
 * to a new reading over a few frames, and writes the reading at once when the
 * reader asked for reduced motion.
 *
 * @capability context-stats
 * @features context-stats
 * @risk Figures under the composer jump around, count backwards, or — for a reader who asked for reduced motion — keep rolling every time a turn lands.
 */
'use strict'
const { spec } = require('../../fixtures/behaviour.cjs')
const { seatStatsSession } = require('../../fixtures/stats-session.cjs')

/** The stand-in's session, on 2 turns and 100 tokens written back. */
const seatSession = (t) => seatStatsSession(t,
  { turns: 2, steps: 20, llmMs: 0, toolMs: 0, ttftMs: 0, ttftSteps: 0, decodeMs: 10000, decodeTokens: 1000 },
  { uncachedInputTokens: 1000, cacheReadTokens: 9000, cacheWriteTokens: 0, outputTokens: 100 })

/**
 * Land a new reading of 22 turns and record the turns figure — the line's first
 * figure, in whichever language the host speaks — on every frame until the page
 * settles.
 */
async function turnsWhileLanding(t) {
  const texts = await t.page.evaluate((line) => {
    window.__pushStats('sessionStats', { turns: 22, steps: 220 })
    return window.__dshSmokeProbe.watch(() => document.querySelector(line)?.innerText ?? '')
  }, t.surface('stats.inline-line'))
  return texts.map((text) => Number(/\d[\d,]*/.exec(text)?.[0]?.replace(/,/g, '') ?? NaN))
}

module.exports = spec({ page: 'stats-inline' }, ({ test }) => {
  test('a new reading is counted to from the figure on show, never backwards', async (t) => {
    await seatSession(t)
    const turns = await turnsWhileLanding(t)
    t.expectThat.equal(turns[0], 2, 'the line starts on the figure it showed')
    t.expectThat.equal(turns.at(-1), 22, 'the line ends on the new reading')
    t.expectThat.sequenceMonotonic(turns, 'the turns figure counts up')
    t.expectThat.equal(turns.some((value) => value > 2 && value < 22), true, 'the count passes through the figures between')
  })

  test('under reduced motion a new reading is written at once', async (t) => {
    await t.prefs({ motion: 'reduced' })
    await seatSession(t)
    const turns = await turnsWhileLanding(t)
    t.expectThat.equal(turns.filter((value) => value > 2 && value < 22), [], 'no figure between the two readings is ever shown')
    t.expectThat.equal(turns.at(-1), 22, 'the line shows the new reading')
  })
})
