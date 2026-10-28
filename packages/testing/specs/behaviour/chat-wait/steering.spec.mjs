/**
 * The pending steering bubble a reader appends during a live turn: the pinned
 * running row's canvas band reaches down over the bubble unless the bubble is
 * lifted above it.
 *
 * @capability chat-wait
 * @features chat-wait
 * @risk A reader who appends a message while the model is still working sees the top of their message painted over by the waiting line.
 */
import { spec, host } from '../../fixtures/behaviour.mjs'

const SCROLLER = host.attribute('chat.scroller')
const TAIL = host.attribute('chat.following-tail')
const FLOW = host.attribute('chat.flow')
const RUNNING = host.attribute('chat.running')
const PENDING = host.attribute('chat.pending-steering')

/** Build a scroller with the running row last and a pending steering bubble after it. */
function seatPending(t) {
  return t.page.evaluate(([scroller, tail, flow, running, pending]) => {
    document.body.style.setProperty('--dsh-composer-height', '120px')
    document.body.style.setProperty('--dsh-composer-fade-h', '40px')
    // The rule under test is the pin the chat area's follow lays down: it only
    // applies while the follow owns the scroll, which is the body mark below.
    document.body.setAttribute('data-dsh-claude-chat-follow', '')
    const holder = document.createElement('div')
    holder.setAttribute(scroller, '')
    holder.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:300px;overflow-y:auto;z-index:50'
    const following = document.createElement('div')
    following.setAttribute(tail, '')
    const column = document.createElement('div')
    column.setAttribute(flow, '')
    column.style.cssText = 'padding:16px 32px;display:flex;flex-direction:column;min-height:700px'
    const filler = document.createElement('div')
    filler.style.cssText = 'height:420px;flex:none'
    column.appendChild(filler)
    const row = document.createElement('div')
    row.setAttribute(running, '')
    row.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start'
    row.innerHTML = '<span role="status">Deep diving</span><span>Deep diving</span>'
    column.appendChild(row)
    const line = document.createElement('div')
    line.setAttribute(pending, '')
    line.style.cssText = 'display:flex;justify-content:flex-end;flex:none'
    line.innerHTML = '<div id="debugPendingBubble" style="width:260px;height:60px;background:rgb(240,240,240);border-radius:18px;padding:8px 12px">follow-up message</div>'
    column.appendChild(line)
    following.appendChild(column)
    holder.appendChild(following)
    document.body.appendChild(holder)
    holder.scrollTop = holder.scrollHeight
  }, [SCROLLER, TAIL, FLOW, RUNNING, PENDING])
}

export default spec({ page: 'chat-wait' }, ({ test }) => {
  test('a pending steering bubble is lifted above the pinned row\'s canvas band', async (t) => {
    await seatPending(t)
    await t.page.waitForTimeout(120)
    const state = await t.page.evaluate(([running, pending]) => {
      const row = document.querySelector(`[${running}]`)
      const line = document.querySelector(`[${pending}]`)
      const rowStyle = getComputedStyle(row)
      const lineStyle = getComputedStyle(line)
      return {
        position: lineStyle.position,
        lineZ: Number(lineStyle.zIndex),
        rowZ: Number(rowStyle.zIndex),
        lineBackground: lineStyle.backgroundColor,
        rowBackground: rowStyle.backgroundColor,
        bubbleTop: line.firstElementChild.getBoundingClientRect().top,
        rowBottom: row.getBoundingClientRect().bottom,
        maskHeight: Number.parseFloat(getComputedStyle(row, '::after').height),
      }
    }, [RUNNING, PENDING])
    t.expectThat.equal(state.position, 'relative', 'the pending row taking its own stacking level')
    t.expectThat.equal(state.lineZ > state.rowZ, true, `the pending row above the running row (${state.lineZ} > ${state.rowZ})`)
    t.expectThat.equal(state.lineBackground, state.rowBackground, 'the pending row painting the same canvas as the running row')
    t.expectThat.equal(Math.abs(state.bubbleTop - state.rowBottom) <= 1, true, 'the bubble standing directly below the running row')
    t.expectThat.equal(state.maskHeight >= 50, true, `the running row's canvas band still present (${state.maskHeight}px)`)
  })
})
