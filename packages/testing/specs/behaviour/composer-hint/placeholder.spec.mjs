/**
 * The idle hint the composer shows while its field stands empty, read on the
 * built page: the host's own hint, which the skin rewrites in the shell's
 * language, and the stand-in the skin draws for a card whose host has taken its
 * hint away.
 *
 * @capability composer-hint
 * @features composer
 * @risk A reader on a Chinese interface types into a field hinted in English, or a card the host leaves without a hint stands without one at all.
 */
import { spec, host, surface } from '../../fixtures/behaviour.mjs'

const CARD = host('composer.card')
const FIELD = host('composer.input')
const HINT = host('composer.placeholder')
const LABEL = host('composer.placeholder-attribute')
const STAND_IN = surface.attribute('composer.hint-standin')

/** The field's label, the host's hint and the skin's stand-ins, all read off the card. */
function readHint(t) {
  return t.page.evaluate(([card, field, hint, label, standIn]) => {
    const element = document.querySelector(card)
    return {
      label: element.querySelector(field)?.getAttribute(label) ?? null,
      hint: element.querySelector(`${hint}:not([${standIn}])`)?.textContent ?? null,
      standIns: [...element.querySelectorAll(`[${standIn}]`)].map((node) => node.textContent),
    }
  }, [CARD, FIELD, HINT, LABEL, STAND_IN])
}

export default spec({ page: 'composer' }, ({ test }) => {
  test('the host\'s own hint carries the skin\'s words in the shell\'s language', async (t) => {
    t.expectThat.equal((await readHint(t)).hint, 'Type / for commands', 'the hint of the empty composer in English')
    await t.page.evaluate(() => window.__dshSmokeHost.setSmokeLocale('zh'))
    await t.settle()
    t.expectThat.equal((await readHint(t)).hint, '输入 / 以使用命令', 'the hint of the empty composer in Chinese')
    await t.page.evaluate(() => window.__dshSmokeHost.setSmokeLocale('en'))
    await t.settle()
    t.expectThat.equal((await readHint(t)).hint, 'Type / for commands', 'the hint once the interface is back in English')
  })

  test('a card the host leaves without a hint draws the skin\'s own, once, in the shell\'s language', async (t) => {
    // The attachment form of the host's card, as the host renders it: the page's
    // rail moves to the card's head, its own hint leaves the page, and the field
    // is emptied with the card's own sentence for that form written into it.
    await t.page.evaluate(([card, field, hint, label, standIn]) => {
      const element = document.querySelector(card)
      element.querySelector(`${hint}:not([${standIn}])`)?.remove()
      element.prepend(element.querySelector('[class*="_rail"]'))
      const input = element.querySelector(field)
      input.focus()
      document.execCommand('selectAll')
      document.execCommand('delete')
      input.setAttribute(label, 'Message or run a task, / commands, @ files or sessions')
    }, [CARD, FIELD, HINT, LABEL, STAND_IN])
    await t.settle()
    t.expectThat.equal((await readHint(t)).label, 'Message or run a task, / commands, @ files or sessions', 'the field of the attachment form')
    t.expectThat.equal((await readHint(t)).standIns, ['Type / for commands'], 'the hint a card with no hint of the host\'s draws')
    await t.page.evaluate(() => window.__dshSmokeHost.setSmokeLocale('zh'))
    await t.settle()
    t.expectThat.equal((await readHint(t)).standIns, ['输入 / 以使用命令'], 'the stand-in once the interface is in Chinese')
  })
})
