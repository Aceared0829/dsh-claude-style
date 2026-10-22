/**
 * The composer's seat is one item in the row: the model's name and the effort
 * level share a box that stands against the row's right end and grows leftward,
 * so a level's name changing width moves the box's left end and leaves the edge
 * both cards hang from where it was.
 *
 * @capability effort-picker
 * @features effort, model
 * @risk In a narrow window the level covers the model's name or pushes the composer wider than the window, and the conversation grows a horizontal scrollbar.
 */
import { spec } from '../../fixtures/behaviour.mjs'
import { boxOf } from '../../fixtures/boxes.mjs'
import { MODEL_SEAT_NAME } from '../../fixtures/model-seat.mjs'

/** The host's model button: the reader finds it by its name, the model's. */
const modelButton = (page) => page.getByRole('button', { name: MODEL_SEAT_NAME })

// The geometry is judged at both pixel densities: a device pixel is what the
// row's slack is spent in, and a fractional edge rounds differently at 2x.
export default spec({ page: 'effort', bands: ['phone', 'compact', 'wide'], densities: [1, 2] }, ({ test }) => {
  test('the seat box holds the model\'s name and the level as one row item', async (t) => {
    const seat = await t.read.box(t.surface('model.seat'))
    const level = await t.read.box(t.surface('effort.trigger'))
    const model = await boxOf(modelButton(t.page))
    const card = await t.read.box(t.host('composer.card'))
    const row = await t.read.box(t.surface('composer.row'))
    t.expectThat.visible(seat, 'the seat box is drawn')
    t.expectThat.visible(level, 'the level is drawn')
    t.expectThat.boxesApart(level, model, 'the level does not cover the model name')
    t.expectThat.equal(model.right <= level.left + 1, true, `the model's name comes first (${model.right} against ${level.left})`)
    t.expectThat.boxWithin(seat, card, 'the seat stays inside the composer card')
    t.expectThat.equal(seat.right <= row.right + 1, true, `the seat ends inside the row (${seat.right} against ${row.right})`)
    t.expectThat.noHorizontalOverflow(await t.read.overflow(t.host('composer.card')), 'the composer card')
    t.expectThat.noHorizontalOverflow(await t.read.overflow(t.host('chat.scroller')), 'the conversation')
  })

  test('switching the picker off hands the seat back whole, the level with it', async (t) => {
    await t.prefs({ modelPicker: false })
    t.expectThat.absent(await t.read.box(t.surface('model.seat')), 'the seat box')
    t.expectThat.absent(await t.read.box(t.surface('effort.trigger')), 'the level')
    t.expectThat.visible(await boxOf(modelButton(t.page)), 'the host\'s own seat')
    t.expectThat.noHorizontalOverflow(await t.read.overflow(t.host('chat.scroller')), 'the conversation')
  })

  test('opening the card leaves the seat and the level where they stand', async (t) => {
    const seatDown = await t.read.box(t.surface('model.seat'))
    const levelDown = await t.read.box(t.surface('effort.trigger'))
    await t.page.click(t.surface('effort.trigger'))
    await t.settle()
    const seatUp = await t.read.box(t.surface('model.seat'))
    const levelUp = await t.read.box(t.surface('effort.trigger'))
    t.expectThat.equal(Math.round(seatUp.left * 10), Math.round(seatDown.left * 10), `the box keeps its left end (${seatDown.left} → ${seatUp.left})`)
    t.expectThat.equal(Math.round(seatUp.right * 10), Math.round(seatDown.right * 10), `the box keeps its right end (${seatDown.right} → ${seatUp.right})`)
    t.expectThat.equal(Math.round(levelUp.width * 10), Math.round(levelDown.width * 10), `the level keeps its width (${levelDown.width} → ${levelUp.width})`)
  })
})
