/**
 * @capability composer
 * @features composer
 * @risk A gap stop leaves the host's own room under the conversation's composer, or the default stop writes over it.
 */
import { spec } from '../../fixtures/behaviour.mjs'

/**
 * The host's bar root around the card pads the room under it (4px) from a
 * class rule of its stylesheet, the way the conversation draws it.
 */
async function seatBar(t) {
  await t.page.evaluate((cardSelector) => {
    const card = document.querySelector(cardSelector)
    const sheet = document.createElement('style')
    sheet.textContent = '.composer-bar-root { padding-bottom: 4px; }'
    document.head.append(sheet)
    const bar = document.createElement('div')
    bar.className = 'composer-bar-root'
    card.replaceWith(bar)
    bar.append(card)
  }, t.host('composer.card'))
  await t.settle()
}

/** The room between the card's bottom edge and the bar's around it. */
async function gap(t) {
  return t.page.evaluate((cardSelector) => {
    const card = document.querySelector(cardSelector)
    return Math.round(card.parentElement.getBoundingClientRect().bottom - card.getBoundingClientRect().bottom)
  }, t.host('composer.card'))
}

export default spec({ page: 'composer' }, ({ test }) => {
  test('each gap stop sets the room under the conversation composer, and the default keeps the host’s', async t => {
    await seatBar(t)
    t.expectThat.equal(await gap(t), 4, 'the default stop keeps the host’s own room')
    await t.prefs({ composerBottomGap: 'compact' })
    t.expectThat.equal(await gap(t), 0, 'the compact stop takes the room away')
    await t.prefs({ composerBottomGap: 'roomy' })
    t.expectThat.equal(await gap(t), 16, 'the roomy stop widens the room')
    await t.prefs({ composerBottomGap: 'theme' })
    t.expectThat.equal(await gap(t), 4, 'going back to the default hands the room back to the host')
  })

  test('a gap stop waits while the restyle leaves the conversation alone', async t => {
    await seatBar(t)
    await t.prefs({ composerBottomGap: 'roomy', composerScope: 'hero' })
    t.expectThat.equal(await gap(t), 4, 'the host’s room stands under a composer the skin does not restyle')
    await t.prefs({ composerScope: 'all' })
    t.expectThat.equal(await gap(t), 16, 'the stop applies once the restyle covers the conversation again')
  })
})
