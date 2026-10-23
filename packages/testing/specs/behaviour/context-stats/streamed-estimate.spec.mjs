/**
 * While an answer streams, the written-back figure under the composer grows
 * with the text on the page, at each character's rough token share; a tool
 * call's arguments never reach the page, so each call row adds its tool's own
 * price once. When the step settles, the host's own total takes over and
 * nothing it covers is counted again.
 *
 * @capability context-stats
 * @features context-stats
 * @risk While the model streams, the token figure under the composer stands still, jumps by the whole answer twice when the step settles, prices a write like a read, keeps its own model's error after its settlements showed it, or counts a sidebar preview or a re-rendered tool call as new output.
 */
import { spec } from '../../fixtures/behaviour.mjs'
import { seatStatsSession } from '../../fixtures/stats-session.mjs'

/** The stand-in's session on 100 tokens written back, the figures on show written at once. */
async function seatSession(t) {
  await t.prefs({ motion: 'reduced' })
  await seatStatsSession(t,
    { turns: 1, steps: 1, llmMs: 0, toolMs: 0, ttftMs: 0, ttftSteps: 0, decodeMs: 1000, decodeTokens: 100 },
    { uncachedInputTokens: 1000, cacheReadTokens: 9000, cacheWriteTokens: 0, outputTokens: 100 })
}

/** The written-back figure the line shows: the number after the down arrow. */
async function writtenBack(t) {
  const text = await t.read.text(t.surface('stats.inline-line'))
  const figure = /↓\s*([\d,]+)/.exec(text ?? '')
  return figure === null ? null : Number(figure[1].replace(/,/g, ''))
}

/**
 * A streaming container of the host's, inside the conversation or beside it,
 * filled the way a stream fills it: a piece at a time, a little apart, so the
 * reading the skin takes between passes sees the text arrive.
 */
async function stream(t, text, { inside = true, id = 'stream' } = {}) {
  await t.page.evaluate(async ([scroller, streaming, words, within, key]) => {
    const parent = within ? document.querySelector(scroller) : document.body
    let container = document.getElementById(key)
    if (container === null) {
      container = document.createElement('div')
      container.id = key
      container.setAttribute(streaming, '')
      parent.append(container)
    }
    // The estimate takes a container's first reading as its baseline and counts
    // from the second, one reading interval (100ms, features/context-stats/stream-estimate.ts)
    // apart. The container stands empty past that interval before any text
    // arrives: on a machine loaded enough to miss the first reading, a baseline
    // taken over the whole text would leave no growth to read.
    await new Promise((resolve) => setTimeout(resolve, 250))
    for (const piece of words.match(/[\s\S]{1,4}/g) ?? []) {
      container.append(piece)
      await new Promise((resolve) => setTimeout(resolve, 40))
    }
    // One more change past the reading's interval, the way the stream goes on.
    await new Promise((resolve) => setTimeout(resolve, 150))
    container.append('')
    container.setAttribute('data-test-tick', String(Date.now()))
  }, [t.host('chat.scroller'), t.host('chat.streaming-attribute'), text, inside, id])
  await t.settle()
}

/** A tool call row of the host's, mounted in the conversation and naming `tool` when given. */
async function callRow(t, id, tool = null) {
  await t.page.evaluate(([scroller, call, toolAttribute, key, toolName]) => {
    const row = document.createElement('div')
    row.setAttribute(call, key)
    row.id = key
    if (toolName !== null) {
      const view = document.createElement('span')
      view.setAttribute(toolAttribute, toolName)
      row.append(view)
    }
    document.querySelector(scroller).append(row)
  }, [t.host('chat.scroller'), t.host.attribute('chat.call'), t.host('chat.call-tool-attribute'), id, tool])
  await t.settle()
}

export default spec({ page: 'stats-inline' }, ({ test }) => {
  test('streamed text grows the written-back figure by its token share, wide characters by more', async (t) => {
    await seatSession(t)
    const settled = await writtenBack(t)
    t.expectThat.equal(settled, 100, 'the line starts on the settled total')
    await stream(t, 'abcdefghijklmnopqrstuvwxyz0123')
    const narrow = (await writtenBack(t)) - settled
    t.expectThat.equal(narrow > 0 && narrow < 30, true, `thirty narrow characters add some but fewer than thirty tokens (added ${narrow})`)
    await stream(t, '你好世界你好世界你好世界你好世界你好世界你好世界你好世界一二', { id: 'wide' })
    const wide = (await writtenBack(t)) - settled - narrow
    t.expectThat.equal(wide > narrow, true, `thirty wide characters add more than thirty narrow ones (${wide} against ${narrow})`)
  })

  test('a settlement hands the figure to the host\'s total, and the text it covers is not counted again', async (t) => {
    await seatSession(t)
    await stream(t, 'abcdefghijklmnopqrstuvwxyz0123456789')
    t.expectThat.equal((await writtenBack(t)) > 100, true, 'the stream raised the figure')
    await t.page.evaluate(() => window.__pushStats('tokenUsage', { outputTokens: 120 }))
    await t.settle()
    t.expectThat.equal(await writtenBack(t), 120, 'the figure is the host\'s settled total')
  })

  test('a step the figure overshot writes the next one lower', async (t) => {
    await seatSession(t)
    const settled = await writtenBack(t)
    await stream(t, '你好世界'.repeat(50))
    const first = (await writtenBack(t)) - settled
    // The host settles forty tokens for that step, well under what the figure added.
    await t.page.evaluate(() => window.__pushStats('tokenUsage', { outputTokens: 140 }))
    await t.settle()
    await stream(t, '你好世界'.repeat(50), { id: 'second' })
    const second = (await writtenBack(t)) - 140
    t.expectThat.equal(first > 40, true, `the first stream added its share (${first})`)
    t.expectThat.equal(second < first, true, `the lowered multiplier writes the second stream lower (${second} against ${first})`)
  })

  test('a call row counts its tool\'s own price, a write several times a read', async (t) => {
    await seatSession(t)
    const settled = await writtenBack(t)
    await callRow(t, 'call-read', 'read')
    await stream(t, 'e')
    const read = (await writtenBack(t)) - settled
    await callRow(t, 'call-write', 'write')
    await stream(t, 'f')
    const write = (await writtenBack(t)) - settled - read
    t.expectThat.equal(read > 0 && read < 120, true, `a read adds its own price (added ${read})`)
    t.expectThat.equal(write > 400, true, `a write adds several times a read (added ${write})`)
  })

  test('a call row counts once, however often the host re-renders it', async (t) => {
    await seatSession(t)
    await stream(t, 'abcd')
    const before = await writtenBack(t)
    await callRow(t, 'call-1', 'write')
    await stream(t, 'e')
    const withCall = await writtenBack(t)
    t.expectThat.equal(withCall - before >= 400, true, `the call adds its tool's price (added ${withCall - before})`)
    await t.page.evaluate(() => {
      const row = document.getElementById('call-1')
      const parent = row.parentElement
      row.remove()
      parent.append(row)
    })
    await stream(t, 'f')
    t.expectThat.equal((await writtenBack(t)) - withCall < 5, true, 'the re-rendered row is not counted again')
  })

  test('text streaming outside the shown conversation is not counted', async (t) => {
    await seatSession(t)
    const settled = await writtenBack(t)
    await stream(t, 'abcdefghijklmnopqrstuvwxyz0123456789', { inside: false, id: 'elsewhere' })
    t.expectThat.equal(await writtenBack(t), settled, 'the figure keeps the settled total')
  })
})
