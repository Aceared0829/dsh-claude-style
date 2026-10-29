/**
 * The reasoning-effort slider has its own switch, apart from the model picker's.
 * While it is on, the skin hides the host's own model seat and draws the level
 * itself; while it is off the picker's menu stays but the host's own seat comes
 * back visible, so a third-party effort control mounted in the same slot is
 * reachable again (issue #183).
 *
 * @capability effort-picker
 * @features model, effort
 * @risk The reader turns on a third-party effort control and it never appears under the skin, with no switch that hands the slot back.
 */
import { spec } from '../../fixtures/behaviour.mjs'

/** Whether the host's own model seat root carries the skin's hide mark right now. */
function hostHidden(t) {
  const attribute = t.surface.attribute('model.host-root')
  return t.page.evaluate((name) => document.querySelector(`[${name}]`) !== null, attribute)
}

/** Whether the skin's own model trigger and effort trigger stand on the page. */
function skinControls(t) {
  return t.page.evaluate(([modelSelector, effortSelector]) =>
    document.querySelector(modelSelector) !== null && document.querySelector(effortSelector) !== null,
  [t.surface('model.trigger'), t.surface('effort.trigger')])
}

export default spec({ page: 'effort' }, ({ test }) => {
  test('with the slider on, the skin hides the host seat and draws both seats itself', async (t) => {
    await t.prefs({ effortSlider: true })
    await t.settle()
    t.expectThat.equal(await hostHidden(t), true, 'the host seat is hidden while the skin draws the level')
    t.expectThat.equal(await skinControls(t), true, 'the model and effort triggers both stand')
  })

  test('switching the slider off keeps the picker and hands the host seat back, and on hides it again', async (t) => {
    await t.prefs({ effortSlider: false })
    await t.settle()
    t.expectThat.equal(await hostHidden(t), false, 'the host seat comes back visible with the slider off')
    t.expectThat.equal(await t.page.evaluate((s) => document.querySelector(s) !== null, t.surface('model.trigger')), true, 'the model picker stays with the slider off')

    await t.prefs({ effortSlider: true })
    await t.settle()
    t.expectThat.equal(await hostHidden(t), true, 'the host seat is hidden again with the slider back on')
    t.expectThat.equal(await skinControls(t), true, 'both skin triggers stand again')
  })
})
