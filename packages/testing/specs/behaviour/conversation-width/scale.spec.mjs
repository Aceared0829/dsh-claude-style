/**
 * @capability conversation-width
 * @features conversation-width, composer
 * @risk A scaled column leaves the composer or the messages' column at the host's width, scales the card's margin with it, or keeps the scale after the full width is picked again.
 */
import { spec } from '../../fixtures/behaviour.mjs'

/** The width the host declares for the column, and the card's margin over it. */
const COLUMN = 600
const MARGIN = 32

/**
 * The host's conversation body around the scroller: the phase root holds it,
 * and it declares the column's width and the card's widest. A line in the
 * scroller stands for the messages' column, drawn to the column's width.
 */
async function seatConversation(t) {
  await t.page.evaluate(([cardSelector, scrollSelector, phase, content, columnWidth, cardWidth, column, margin]) => {
    const scroller = document.querySelector(cardSelector).closest(scrollSelector)
    const root = document.createElement('div')
    root.setAttribute(phase, 'active')
    const body = document.createElement('div')
    body.setAttribute(content, '')
    body.style.setProperty(columnWidth, `${column}px`)
    body.style.setProperty(cardWidth, `calc(var(${columnWidth}) + ${margin}px)`)
    scroller.replaceWith(root)
    root.append(body)
    body.append(scroller)
    const line = document.createElement('div')
    line.id = 'messages-column'
    line.style.width = `var(${columnWidth})`
    scroller.prepend(line)
  }, [t.host('composer.card'), t.host('chat.scroller'), t.host('shell.phase'), t.host.attribute('chat.content'), t.host('chat.content-width'), t.host('composer.card-max-width'), COLUMN, MARGIN])
  await t.settle()
}

async function widths(t) {
  return t.page.evaluate((cardSelector) => ({
    column: Math.round(document.getElementById('messages-column').getBoundingClientRect().width),
    card: Math.round(document.querySelector(cardSelector).getBoundingClientRect().width),
  }), t.host('composer.card'))
}

export default spec({ page: 'composer' }, ({ test }) => {
  test('each scale draws the column and the composer at that share of the host’s width, keeping the card’s margin', async t => {
    await seatConversation(t)
    t.expectThat.equal(await widths(t), { column: COLUMN, card: COLUMN + MARGIN }, 'the full width is the host’s own')
    await t.prefs({ conversationWidth: '0.75' })
    t.expectThat.equal(await widths(t), { column: COLUMN * 0.75, card: COLUMN * 0.75 + MARGIN }, 'three quarters scales the column and keeps the card’s margin')
    await t.prefs({ conversationWidth: '0.5' })
    t.expectThat.equal(await widths(t), { column: COLUMN * 0.5, card: COLUMN * 0.5 + MARGIN }, 'a half scales the column and keeps the card’s margin')
    await t.prefs({ conversationWidth: '1' })
    t.expectThat.equal(await widths(t), { column: COLUMN, card: COLUMN + MARGIN }, 'going back to the full width hands the column back to the host')
  })
})
