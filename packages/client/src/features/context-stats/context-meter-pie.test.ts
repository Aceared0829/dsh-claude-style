import { expect, test } from 'vitest'
import { contextPieImage } from './context-meter-pie'

/**
 * The pie's image document: the two sectors' radii and angles, the seam that
 * splits between their strokes and the plate's two colours decide the shape
 * here rather than in a stylesheet, so a test can read them.
 */

const TONE = 'rgb(1, 2, 3)'
const REST = 'rgba(4, 5, 6, 0.2)'
const BOX_RADIUS = 8
const SEAM = 1.2

/** The SVG document a pie value carries. */
function imageOf(percent: number) {
  const value = contextPieImage(percent, TONE, REST)
  const match = /^url\("data:image\/svg\+xml,(.*)"\)$/.exec(value)
  if (match === null) throw new Error(`not a background image: ${value}`)
  return decodeURIComponent(match[1])
}

/** The `d` of the element painted in one colour; each part is painted once. */
function pathOf(percent: number, fill: string) {
  const image = imageOf(percent)
  const at = image.indexOf(`fill="${fill}"`)
  if (at === -1) throw new Error(`${fill} is not painted at ${percent}%`)
  const open = '<path d="'
  const from = image.lastIndexOf(open, at) + open.length
  const end = image.indexOf('"', from)
  if (from < open.length || end === -1) throw new Error(`no path at ${percent}%`)
  return image.slice(from, end)
}

/** The radius of the arc one part's path draws. */
function radiusOf(percent: number, fill: string) {
  const match = /A ([\d.]+) [\d.]+ 0 \d 1 /.exec(pathOf(percent, fill))
  if (match === null) throw new Error(`no arc at ${percent}%`)
  return Number(match[1])
}

/** Both seam strokes, in the order the document writes them. */
function strokesOf(percent: number) {
  const widths = [...imageOf(percent).matchAll(/stroke-width="([\d.]+)"/g)].map((match) => Number(match[1]))
  if (widths.length !== 2) throw new Error(`${widths.length} strokes at ${percent}%`)
  return widths
}

test('a reading with nothing taken is one whole plate, cut nowhere', () => {
  const image = imageOf(0)
  expect(image).toContain(`fill="${REST}"`)
  expect(image).not.toContain(TONE)
  expect(image).not.toContain('<mask')
})

test('a reading at its top is one whole plate in the occupied colour', () => {
  const image = imageOf(100)
  expect(image).toContain(`fill="${TONE}"`)
  expect(image).not.toContain(REST)
  expect(image).not.toContain('<mask')
})

test('an even split is two half discs of one radius, each cut from its own mask', () => {
  const image = imageOf(50)
  expect(image).toContain(`mask="url(#dsh-claude-pie-grey)"`)
  expect(image).toContain(`mask="url(#dsh-claude-pie-color)"`)
  expect(radiusOf(50, TONE)).toBe(BOX_RADIUS)
  expect(radiusOf(50, REST)).toBe(BOX_RADIUS)
  expect(strokesOf(50)).toEqual([SEAM, SEAM])
})

test('below the split the occupied sector keeps the box radius and the plate steps in', () => {
  // 20%: the pull is half the lift over 30 of the 35 points to the even split.
  const pull = 1.3 * 30 / 35
  expect(radiusOf(20, TONE)).toBe(BOX_RADIUS)
  expect(radiusOf(20, REST)).toBeCloseTo(BOX_RADIUS - pull, 2)
})

test('above the split the plate keeps the box radius and the occupied sector steps in', () => {
  const pull = 1.3 * 30 / 35
  expect(radiusOf(80, REST)).toBe(BOX_RADIUS)
  expect(radiusOf(80, TONE)).toBeCloseTo(BOX_RADIUS - pull, 2)
})

test('the two strokes share one seam by the split', () => {
  for (const percent of [10, 50, 90]) {
    const [grey, occupied] = strokesOf(percent)
    expect(grey + occupied).toBeCloseTo(SEAM * 2, 2)
  }
  // A tenth taken: the plate's cut takes nine tenths of the seam, the sector's
  // the rest, and the mirror holds at nine tenths taken.
  expect(strokesOf(10)[0]).toBeCloseTo(SEAM * 2 * 0.9, 2)
  expect(strokesOf(10)[1]).toBeCloseTo(SEAM * 2 * 0.1, 2)
  expect(strokesOf(90)[0]).toBeCloseTo(SEAM * 2 * 0.1, 2)
  expect(strokesOf(90)[1]).toBeCloseTo(SEAM * 2 * 0.9, 2)
})

test('a reading crossing the even split moves no edge', () => {
  for (const fill of [TONE, REST]) {
    expect(Math.abs(radiusOf(49.9, fill) - radiusOf(50.1, fill))).toBeLessThan(0.02)
  }
  for (const stroke of [0, 1]) {
    expect(Math.abs(strokesOf(49.9)[stroke] - strokesOf(50.1)[stroke])).toBeLessThan(0.02)
  }
})

test('the part that stands out is painted last', () => {
  const order = (percent: number) => {
    const image = imageOf(percent)
    return image.indexOf(`fill="${TONE}"`) < image.indexOf(`fill="${REST}"`) ? 'tone first' : 'plate first'
  }
  expect(order(20)).toBe('plate first')
  expect(order(80)).toBe('tone first')
})

test('every coordinate a reading can produce is a number', () => {
  for (let percent = 0; percent <= 100; percent += 0.5) {
    expect(imageOf(percent)).not.toMatch(/NaN|undefined/)
  }
})
