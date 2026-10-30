/**
 * The card a plugin mounts into the sidebar footer keeps taking the plugin's
 * own repaints while it stands in the account surface — except across a press,
 * where a rewrite would take the node out from under the reader's finger. The
 * usage plugin is the case: its foot card rewrites its own figures on a poll,
 * and the takeover rebuilds that card from the plugin's node every pass.
 *
 * @capability account-menu
 * @features account
 * @risk A plugin that repaints its own footer card while the reader presses it has the press cancelled by the rewrite, so the card's own control never fires; a card frozen for the whole open instead shows the figure it had when the card opened.
 */
import { host, spec, surface } from '../../fixtures/behaviour.mjs'

/** The attribute the skin writes its part marks into. */
const PART = surface.attribute('skin.part')
/** The live copy the account surface stands in place of a plugin's footer widget. */
const EMBED = surface('account.embed')
/** The host's account trigger: the button the host marks as a menu anchor. */
const ACCOUNT_TRIGGER = host('shell.account-trigger')

/**
 * A plugin card mounted straight into the foot area, the way the usage plugin
 * mounts its own: a card whose words the plugin rewrites on a poll, and a button
 * inside it that counts its presses.
 */
const mountCard = (t) => t.page.evaluate((part) => {
  const foot = document.querySelector(`[${part}~="foot-area"]`)
  if (foot === null) throw new Error('the stand-in footer is missing')
  const settings = foot.querySelector(`[${part}~="settings-area"]`)
  const card = document.createElement('div')
  const button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('aria-label', 'Open usage settings')
  button.textContent = 'Today 1.26B tokens'
  window.__debugPresses = 0
  button.addEventListener('click', () => { window.__debugPresses += 1 })
  const meta = document.createElement('span')
  meta.className = 'debug-card-meta'
  meta.textContent = 'Updated 14:59'
  card.appendChild(button)
  card.appendChild(meta)
  foot.insertBefore(card, settings ?? null)
  window.__debugCard = card
  window.__debugMeta = meta
}, PART)

/** Read the account surface's copy of the card. */
const read = (t) => t.page.evaluate((embedSelector) => {
  const embed = Array.from(document.querySelectorAll(embedSelector))
    .find(el => /Updated/.test(el.textContent ?? ''))
  return {
    present: embed !== undefined,
    text: embed === undefined ? null : (embed.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }
}, EMBED)

/** The plugin's own poll: its words change, and the page hears about it. */
const repaint = (t, stamp) => t.page.evaluate((value) => {
  const meta = window.__debugMeta
  if (meta === null || meta === undefined) throw new Error('the stand-in card is gone')
  meta.textContent = value
  const marker = document.createElement('div')
  marker.style.display = 'none'
  document.body.appendChild(marker)
}, stamp)

export default spec({ page: 'desktop' }, ({ test }) => {
  test('a footer card the account surface mirrors keeps the plugin\'s repaints, and waits across a press', async (t) => {
    await mountCard(t)
    await t.settle()
    // The host's account menu is what the takeover injects into; opening it is
    // the row's own press.
    await t.page.evaluate((selector) => document.querySelector(selector)?.click(), ACCOUNT_TRIGGER)
    await t.settle()
    const opened = await read(t)
    t.expectThat.equal(opened.present, true, 'the card is gathered into the account surface')

    // The pointer rests on the card with no press in flight: the repaint lands.
    await repaint(t, 'Updated 19:01')
    await t.settle()
    const idle = await read(t)
    t.expectThat.equal(idle.text !== null && idle.text.includes('19:01'), true,
      `a repaint with no press in flight reaches the mirrored card (${idle.text})`)

    // A press held down across a repaint: the node is not replaced under it.
    await t.page.evaluate((embedSelector) => {
      const button = document.querySelector(`${embedSelector} button`)
      if (button === null) throw new Error('the mirrored card has no control')
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true }))
    }, EMBED)
    await repaint(t, 'Updated 19:02')
    await t.settle()
    const held = await read(t)
    t.expectThat.equal(held.text !== null && !held.text.includes('19:02'), true,
      `a held press is not replaced under the reader (${held.text})`)

    // Released: the held change lands on the next pass. A pass is what a page
    // change asks for, and the plugin's own next poll is one.
    await t.page.evaluate((embedSelector) => {
      const button = document.querySelector(`${embedSelector} button`)
      button?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, composed: true }))
      const marker = document.createElement('div')
      marker.style.display = 'none'
      document.body.appendChild(marker)
    }, EMBED)
    await t.settle()
    const released = await read(t)
    t.expectThat.equal(released.text !== null && released.text.includes('19:02'), true,
      `the change a press held back lands once it ends (${released.text})`)
  })
})
