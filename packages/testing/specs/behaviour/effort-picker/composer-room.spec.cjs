/**
 * The effort button stands beside the model name in the composer row. The room
 * it needs comes out of the row's slack, and out of the model name where the
 * row has none, so a narrow window never grows a horizontal scrollbar for its
 * sake; switching the picker off hands the name its whole room back.
 *
 * @capability effort-picker
 * @features effort, model
 * @risk In a narrow window the effort button covers the model name or pushes the composer wider than the window, and the conversation grows a horizontal scrollbar.
 */
'use strict'
const { spec } = require('../../fixtures/behaviour.cjs')
const { boxOf } = require('../../fixtures/boxes.cjs')
const { MODEL_SEAT_NAME } = require('../../fixtures/model-seat.cjs')

/** The host's model button: the reader finds it by its name, the model's. */
const modelButton = (page) => page.getByRole('button', { name: MODEL_SEAT_NAME })

// The geometry is judged at both pixel densities: a device pixel is what the
// row's slack is spent in, and a fractional edge rounds differently at 2x.
module.exports = spec({ page: 'effort', bands: ['phone', 'compact', 'wide'], densities: [1, 2] }, ({ test }) => {
  test('the effort button stands beside the model name, inside the card, with no horizontal scrollbar', async (t) => {
    const trigger = await t.read.box(t.surface('effort.trigger'))
    const model = await boxOf(modelButton(t.page))
    const card = await t.read.box(t.host('composer.card'))
    t.expectThat.visible(trigger, 'the effort button is drawn')
    t.expectThat.visible(model, 'the model name is drawn')
    t.expectThat.boxesApart(trigger, model, 'the effort button does not cover the model name')
    t.expectThat.boxWithin(trigger, card, 'the effort button stays inside the composer card')
    t.expectThat.noHorizontalOverflow(await t.read.overflow(t.host('composer.card')), 'the composer card')
    t.expectThat.noHorizontalOverflow(await t.read.overflow(t.host('chat.scroller')), 'the conversation')
  })

  test('switching the picker off takes the button away and gives the model name its room back', async (t) => {
    await t.prefs({ modelPicker: false })
    t.expectThat.absent(await t.read.box(t.surface('effort.trigger')), 'the effort button')
    // The room the button reserved comes off the model name's cap (features/effort/room.ts),
    // so the name the row had shortened stands whole again. Read off the
    // trigger's own text against its box: a shortened one reports more text
    // than it draws, which is the ellipsis the reader sees.
    const name = await modelButton(t.page).evaluate((element) => ({ scroll: element.scrollWidth, client: element.clientWidth }))
    t.expectThat.equal(name.scroll - name.client <= 1, true, `the model name stands whole (${name.scroll}px of text in a ${name.client}px box)`)
    t.expectThat.noHorizontalOverflow(await t.read.overflow(t.host('chat.scroller')), 'the conversation')
  })
})
