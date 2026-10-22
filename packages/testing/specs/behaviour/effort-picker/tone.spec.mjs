/**
 * The reasoning-effort button wears a colour that follows the rung in force: every
 * thinking level takes its own step along a ramp from the accent toward the violet
 * the card's apex wears, deepening as it climbs, and the Composer tab's
 * effort-accent row is what turns the colour on — with it off, every rung keeps
 * the resting ink.
 *
 * @capability effort-picker
 * @features effort
 * @risk The reader cannot tell the strongest rung from the ones below it without opening the card, so they work at a weaker or stronger effort than they meant.
 */
import { spec } from '../../fixtures/behaviour.mjs'
import { echoSelection } from '../../fixtures/model-seat.mjs'

/** The colour an element paints its text in, as the pixels the reader sees: a mixed colour and a token resolve to one serialization only through the canvas. */
function painted(t, selector) {
  return t.page.evaluate((s) => {
    const element = document.querySelector(s)
    if (element === null) return null
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.fillStyle = '#000000'
    context.fillStyle = getComputedStyle(element).color
    context.fillRect(0, 0, 1, 1)
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data
    return `rgb(${r}, ${g}, ${b})`
  }, selector)
}

/** How far a painted colour sits from the page's canvas, as the contrast ratio a reader's eye would see. */
function contrastWithPage(t, colour) {
  return t.page.evaluate((css) => {
    const parse = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number)
    const luminance = ([r, g, b]) => {
      const channel = (value) => {
        const c = value / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.fillStyle = '#000000'
    context.fillStyle = getComputedStyle(document.body).backgroundColor
    context.fillRect(0, 0, 1, 1)
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data
    const here = luminance(parse(css))
    const page = luminance([r, g, b])
    return Math.round(((Math.max(here, page) + 0.05) / (Math.min(here, page) + 0.05)) * 100) / 100
  }, colour)
}

/** Press the track `share` of the way along, and let the level settle. */
async function pick(t, share) {
  const track = await t.read.box(t.surface('effort.track'))
  await t.page.mouse.click(track.left + track.width * share, track.top + track.height / 2)
  await t.settle()
  return t.read.text(t.surface('effort.trigger'))
}

/** The effort page's card, open, with the stand-in's directory echoing a selection like the host's own store. */
async function open(t) {
  await echoSelection(t.page, 'max')
  await t.page.click(t.surface('effort.trigger'))
  await t.settle()
}

/** The four stops of the stand-in's ladder, weakest first; the last press stays just inside the track's right edge. */
const STOPS = [0, 1 / 3, 2 / 3, 0.97]

export default spec({ page: 'effort' }, ({ test }) => {
  test('every rung takes a colour of its own, the strongest the heaviest', async (t) => {
    const trigger = t.surface('effort.trigger')
    await open(t)
    const colours = []
    for (const share of STOPS) {
      await pick(t, share)
      colours.push(await painted(t, trigger))
    }
    t.expectThat.equal(new Set(colours).size, colours.length, `four rungs, four colours (${colours.join(', ')})`)
    // The ladder reads as strength: the strongest rung stands furthest from the
    // canvas it is drawn on, so the eye ranks the four without reading a word.
    const weight = async (colour) => contrastWithPage(t, colour)
    const weakest = await weight(colours[0])
    const strongest = await weight(colours[colours.length - 1])
    t.expectThat.equal(strongest > weakest, true, `the strongest rung is the heaviest (${strongest} against ${weakest})`)
  })

  test('the effort-accent row is what paints the colour, and off leaves every rung one ink', async (t) => {
    const trigger = t.surface('effort.trigger')
    await open(t)
    const topOn = await painted(t, trigger)
    const low = await pick(t, 0)
    const lowOn = await painted(t, trigger)
    t.expectThat.equal(lowOn !== topOn, true, `the weakest rung takes another colour (${low}: ${lowOn} against ${topOn})`)
    await t.prefs({ effortAccent: false })
    const lowOff = await painted(t, trigger)
    await pick(t, 1)
    const topOff = await painted(t, trigger)
    t.expectThat.equal(lowOff, topOff, 'with the row off both rungs keep the resting ink')
    t.expectThat.equal(topOff !== topOn, true, `the row is what painted the strongest rung (${topOn} on, ${topOff} off)`)
  })
})
