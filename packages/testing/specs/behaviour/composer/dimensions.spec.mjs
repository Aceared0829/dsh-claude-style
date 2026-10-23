/**
 * @capability composer
 * @features composer
 * @risk Saved dimensions overflow narrower panels or leave host styles changed after reset or teardown.
 */
import { spec } from '../../fixtures/behaviour.mjs'

async function read(t) {
  return t.page.evaluate(([stackSelector, cardSelector]) => {
    const stack = document.querySelector(stackSelector)
    const card = stack.querySelector(cardSelector)
    const box = element => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect()
      return { left, right, top, bottom, width, height }
    }
    return { stack: box(stack), card: box(card), parent: box(stack.parentElement), gap: getComputedStyle(stack).paddingBottom, inline: stack.getAttribute('style') }
  }, [t.host('composer.stack'), t.host('composer.card')])
}

export default spec({ page: 'composer' }, ({ test }) => {
  test('saved dimensions fit narrower panels and reset each property independently', async t => {
    await t.page.evaluate(selector => {
      const stack = document.querySelector(selector)
      stack.style.cssText = 'width:100%;max-width:900px;margin-left:auto;margin-right:auto;padding-bottom:12px'
    }, t.host('composer.stack'))
    await t.settle()
    const initial = await read(t)
    await t.prefs({ composerWidth: '600', composerBottomGap: '40' })
    const custom = await read(t)
    t.expectThat.equal(custom.card.width < initial.card.width, true, 'a smaller saved width narrows the card')
    t.expectThat.equal(parseFloat(custom.gap) > parseFloat(initial.gap), true, 'the saved gap adds room below the entire composer')
    await t.page.evaluate(selector => { document.querySelector(selector).parentElement.style.width = '420px' }, t.host('composer.stack'))
    await t.settle()
    const narrow = await read(t)
    t.expectThat.boxWithin(narrow.stack, narrow.parent, 'the stack fits its narrow panel')
    t.expectThat.boxWithin(narrow.card, narrow.stack, 'the card fits its narrow stack')
    await t.page.evaluate(selector => { document.querySelector(selector).parentElement.style.removeProperty('width') }, t.host('composer.stack'))
    await t.prefs({ composerWidth: '' })
    const resetWidth = await read(t)
    t.expectThat.equal(resetWidth.card.width, initial.card.width, 'width reset returns the original card width')
    t.expectThat.equal(resetWidth.gap, custom.gap, 'width reset retains the chosen bottom gap')
    await t.prefs({ composerBottomGap: '' })
    const resetBoth = await read(t)
    t.expectThat.equal(resetBoth.inline, initial.inline, 'both resets restore all original inline declarations')
  })

  test('scope changes and host replacement retain preferences and restore host declarations', async t => {
    await t.prefs({ composerWidth: '600', composerBottomGap: '40' })
    const custom = await read(t)
    await t.prefs({ composerScope: 'off' })
    const off = await read(t)
    t.expectThat.equal(off.inline === null || off.inline === '', true, 'turning off restyling releases the host styles')
    await t.prefs({ composerScope: 'all' })
    t.expectThat.equal((await read(t)).gap, custom.gap, 'enabling restyling uses the saved gap')
    await t.page.evaluate(selector => {
      const previous = document.querySelector(selector)
      const next = previous.cloneNode(true)
      next.removeAttribute('style')
      previous.replaceWith(next)
    }, t.host('composer.stack'))
    await t.settle()
    const replaced = await read(t)
    t.expectThat.equal(replaced.card.width, custom.card.width, 'a new host stack uses the saved width')
    t.expectThat.equal(replaced.gap, custom.gap, 'a new host stack uses the saved gap')
    await t.prefs({ composerScope: 'off' })
    const released = await read(t)
    t.expectThat.equal(released.inline === null || released.inline === '', true, 'the replacement also releases its styles')
  })
})
