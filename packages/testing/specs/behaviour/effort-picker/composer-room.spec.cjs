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

/** The host's model button: the reader finds it by its name, the model's. */
const modelButton = (page) => page.getByRole('button', { name: 'DeepSeek V4 Reasoner Extended Context' })

/** A Playwright box in the readers' shape. */
async function boxOf(locator) {
  const box = await locator.boundingBox()
  return box === null ? null : { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height, width: box.width, height: box.height }
}

module.exports = spec({ page: 'effort', bands: ['phone', 'compact', 'wide'] }, ({ test }) => {
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
    t.expectThat.equal(await modelButton(t.page).evaluate((element) => getComputedStyle(element).marginRight), '0px', 'the model name keeps no reserved room')
    t.expectThat.noHorizontalOverflow(await t.read.overflow(t.host('chat.scroller')), 'the conversation')
  })
})
