/**
 * A burst of the answer wider than the stream slide carries is still slid. The
 * host's follow pins the end the moment the batch lands, so the text above it is
 * pushed up by the whole growth in one frame; the skin puts the column back down
 * by as much of that growth as a slide carries and glides it to rest (D71). A
 * growth taken for a replaced column instead leaves the column where the burst
 * put it, and the reader sees the transcript jump.
 *
 * The reading is the column's own painted offset over the frames after the
 * growth: a reached stretch, then a landing at rest. The page under it is the
 * stand-in chat area, with the host's streaming mark and its follow mark on the
 * wrapper the column stands in.
 *
 * @capability chat-follow
 * @features chat-follow
 * @risk A burst of the answer is jumped whole: the transcript jolts, and the text above the newest line leaves the viewport without a glide.
 */
import { spec, host } from '../../fixtures/behaviour.mjs'

const FLOW = host('chat.flow')
const SCROLLER = host('chat.scroller')
const STREAMING = host('chat.streaming')
const FOLLOWING_TAIL = host('chat.following-tail')
/**
 * A growth past the longest stretch a slide carries (SCROLL_EASE_LEAD_PX,
 * packages/engine/src/scroll-ease.ts): a burst the host pinned in one frame.
 */
const BURST_PX = 2400
/** The least of that stretch a slide must show: the first frames paint a large share of it. */
const REACHED_PX = 300
/** The offset a column at rest carries, and the most one frame may carry. */
const REST_PX = 1
const CARRY_PX = 1200

const attributeOf = (selector) => selector.slice(1, -1)

export default spec({ page: 'chat-follow' }, ({ test }) => {
  test('a burst wider than the slide carries is put back down by a slide, not jumped whole', async (t) => {
    const reading = await t.page.evaluate(async ({ flow, scroller, streaming, following, burst }) => {
      const column = document.querySelector(flow)
      const viewport = document.querySelector(scroller)
      const frame = () => new Promise((done) => window.__nativeRaf(done))
      // The host's own mark that its follow is on, on the wrapper around the
      // column, and the streaming mark inside it: the two things a slide reads
      // as "this growth was pinned".
      column.parentElement.setAttribute(following, '')
      const mark = document.createElement('div')
      mark.setAttribute(streaming, '')
      column.appendChild(mark)
      const paced = document.createElement('div')
      paced.style.height = '20px'
      column.appendChild(paced)
      // The guard subscribes to the column when content arrives; a frame later
      // its first size report has named the column and the scroller.
      await frame()
      await frame()
      viewport.scrollTop = viewport.scrollHeight
      paced.style.height = `${burst}px`
      viewport.scrollTop = viewport.scrollHeight
      const offsets = []
      const offset = () => {
        const transform = getComputedStyle(column).transform
        return transform === 'none' ? 0 : Math.round(new DOMMatrix(transform).m42)
      }
      for (let at = 0; at < 25; at += 1) {
        await frame()
        offsets.push(offset())
      }
      await new Promise((done) => setTimeout(done, 400))
      return { offsets, settled: offset(), overflowing: viewport.scrollHeight > viewport.clientHeight }
    }, { flow: FLOW, scroller: SCROLLER, streaming: attributeOf(STREAMING), following: attributeOf(FOLLOWING_TAIL), burst: BURST_PX })
    t.expectThat.equal(reading.overflowing, true, 'the transcript is taller than the scroller, so the burst was pinned')
    t.expectThat.equal(Math.max(...reading.offsets) >= REACHED_PX, true, `the burst put the column back down by a slide's stretch: ${JSON.stringify(reading.offsets)}`)
    t.expectThat.equal(Math.max(...reading.offsets) <= CARRY_PX + REST_PX, true, `no frame carried more than a slide carries: ${JSON.stringify(reading.offsets)}`)
    t.expectThat.equal(reading.settled <= REST_PX, true, `the column lands at rest once the slide is over: ${reading.settled}`)
  })
})
