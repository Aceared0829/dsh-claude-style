/**
 * The effort card hangs from the trigger's box, not from the label inside it; the
 * name sits in the middle of that box; and the trigger holds the width of the
 * ladder's widest name while the card is up — whichever level it is on, and
 * whether or not the model's catalog names a default level of its own.
 *
 * @capability effort-picker
 * @features effort
 * @risk The card slides sideways or the trigger's width flickers as levels change, so the slider moves under the pointer and the reader picks a level next to the one they aimed at.
 */
import { spec } from '../../fixtures/behaviour.mjs'
import { echoSelection } from '../../fixtures/model-seat.mjs'

/**
 * A frame-by-frame recording of the card's panel, the trigger and its label;
 * answers every frame it saw. The selectors are the surface table's, handed in
 * so the spec names no class of its own.
 */
function record(t, panel, trigger, ms) {
  return t.page.evaluate(({ panelSelector, triggerSelector, duration }) => new Promise((resolve) => {
    const card = document.querySelector(panelSelector)
    const button = document.querySelector(triggerSelector)
    const label = button.firstElementChild
    const frames = []
    const until = performance.now() + duration
    const tick = () => {
      const text = document.createRange()
      text.selectNodeContents(label)
      const c = card.getBoundingClientRect()
      const b = button.getBoundingClientRect()
      frames.push({
        cardLeft: Math.round(c.left * 10) / 10,
        cardRight: Math.round(c.right * 10) / 10,
        buttonLeft: Math.round(b.left * 10) / 10,
        buttonRight: Math.round(b.right * 10) / 10,
        buttonWidth: Math.round(b.width * 10) / 10,
        labelLeft: Math.round(text.getBoundingClientRect().left * 10) / 10,
        labelRight: Math.round(text.getBoundingClientRect().right * 10) / 10,
        minWidth: button.style.minWidth,
        name: label.textContent,
      })
      if (performance.now() < until) requestAnimationFrame(tick)
      else resolve(frames)
    }
    requestAnimationFrame(tick)
  }), { panelSelector: panel, triggerSelector: trigger, duration: ms })
}

/** The value of `key` over every frame, deduplicated. */
const valuesOf = (frames, key) => [...new Set(frames.map((frame) => frame[key]))]

/**
 * The stand-in page with the effort card open on the level it starts with, its
 * directory echoing a selection like the host's own store, and one settled frame
 * of the panel, the trigger and the label.
 */
async function openCard(t) {
  const panel = t.surface('effort.popover')
  const trigger = t.surface('effort.trigger')
  await echoSelection(t.page, 'max')
  await t.page.click(trigger)
  await t.settle()
  const frames = await record(t, panel, trigger, 200)
  return { panel, trigger, frames, last: frames[frames.length - 1] }
}

export default spec({ page: 'effort' }, ({ test }) => {
  test('the card hangs from the button\'s own right edge, past the label', async (t) => {
    const { last } = await openCard(t)
    t.expectThat.equal(Math.abs(last.cardRight - last.buttonRight) <= 1, true, `the card's right edge is the button's (${last.cardRight} against ${last.buttonRight})`)
    // The open card widens the button to the ladder's widest name, so the label
    // that the card might hang from stands clear of the button's right edge.
    t.expectThat.equal(last.buttonRight - last.labelRight >= 1, true, `the label ends inside the button (${last.labelRight} against ${last.buttonRight})`)
  })

  test('the level\'s name sits in the middle of the button', async (t) => {
    const { last } = await openCard(t)
    const left = Math.round((last.labelLeft - last.buttonLeft) * 10) / 10
    const right = Math.round((last.buttonRight - last.labelRight) * 10) / 10
    t.expectThat.equal(Math.abs(left - right) <= 1.5, true, `the name is centred (${left}px before it, ${right}px after it)`)
  })

  test('the trigger keeps one width while the card is open, and the card one place', async (t) => {
    const { panel, trigger } = await openCard(t)
    const track = await t.read.box(t.surface('effort.track'))
    const recording = record(t, panel, trigger, 1400)
    await t.page.waitForTimeout(150)
    await t.page.mouse.click(track.left + track.width / 3, track.top + track.height / 2)
    await t.page.waitForTimeout(300)
    await t.page.mouse.click(track.left + track.width * 0.97, track.top + track.height / 2)
    const frames = await recording
    t.expectThat.equal(valuesOf(frames, 'buttonWidth').length, 1, `the trigger keeps one width (${valuesOf(frames, 'buttonWidth').join(', ')})`)
    t.expectThat.equal(valuesOf(frames, 'cardLeft').length, 1, `the card keeps one left edge (${valuesOf(frames, 'cardLeft').join(', ')})`)
  })

  test('a model whose catalog names no default level reserves the default step too', async (t) => {
    const panel = t.surface('effort.popover')
    const trigger = t.surface('effort.trigger')
    // DeepSeek's own catalog leaves `defaultEffort` out, so the ladder leads with
    // the control's "Default" step — the widest name on the ladder, and the one a
    // reservation built from the declared levels alone would miss.
    await t.page.evaluate(() => {
      const directory = window.__dshSmokeHost.modelDirectories.directoryFor('smoke-session')
      const snapshot = directory.store.getSnapshot.bind(directory.store)
      let level = 'max'
      directory.store.getSnapshot = () => {
        const snap = snapshot()
        if (snap === null || snap.current === null) return snap
        const groups = snap.groups.map((group) => ({
          ...group,
          models: group.models.map((model) => model.reasoning === undefined
            ? model
            : { ...model, reasoning: { efforts: model.reasoning.efforts } }),
        }))
        return { ...snap, current: { ...snap.current, reasoningEffort: level }, groups }
      }
      directory.select = (selection) => {
        if (selection && selection.reasoningEffort !== undefined) level = selection.reasoningEffort
        return Promise.resolve()
      }
    })
    await t.settle()
    await t.page.click(trigger)
    await t.settle()
    const track = await t.read.box(t.surface('effort.track'))
    const recording = record(t, panel, trigger, 1200)
    await t.page.waitForTimeout(150)
    // The weakest stop is the default step, whose name is the widest of all.
    await t.page.mouse.click(track.left + 2, track.top + track.height / 2)
    const frames = await recording
    t.expectThat.equal(valuesOf(frames, 'minWidth').length, 1, `the reserved width holds across the default step (${valuesOf(frames, 'minWidth').join(', ')})`)
    t.expectThat.equal(valuesOf(frames, 'cardLeft').length, 1, `the card keeps one left edge (${valuesOf(frames, 'cardLeft').join(', ')})`)
    t.expectThat.equal(frames[frames.length - 1].name !== '', true, 'the trigger names a level')
  })
})
