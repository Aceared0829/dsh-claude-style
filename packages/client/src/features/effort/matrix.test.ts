import { afterEach, expect, test } from 'vitest'
import { MOTION_ATTR, MOTION_FULL, MOTION_REDUCED } from '../../constants'
import { createEffortMatrix } from './matrix'

/**
 * The top rung's dot matrix writes each particle's phase and cycle inline with
 * `!important`, because the stylesheet's animation shorthand is `!important`
 * too. Under the reader's reduced-motion choice nothing may move, and an inline
 * `!important` duration outranks that stylesheet rule (D40) — so the writes are
 * what the tests hold: absent standing still, present when the reader lets the
 * skin play.
 */
const cleanups: (() => void)[] = []
afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()!()
  document.body.removeAttribute(MOTION_ATTR)
})

/** A track with a layout width, and the matrix inside it. */
function mount() {
  const track = document.createElement('div')
  track.style.width = '240px'
  const matrix = document.createElement('div')
  track.append(matrix)
  document.body.append(track)
  cleanups.push(() => track.remove())
  return { track, matrix }
}

const particles = (matrix: HTMLElement) => [...matrix.querySelectorAll<HTMLElement>('.dsh-claude-effort-matrix-sq')]

test('a playing reader gets every particle\'s cycle and phase', () => {
  document.body.setAttribute(MOTION_ATTR, MOTION_FULL)
  const { track, matrix } = mount()
  expect(createEffortMatrix(track, matrix).ensure()).toBe(true)
  const cells = particles(matrix)
  expect(cells.length).toBeGreaterThan(0)
  for (const cell of cells) {
    expect(cell.style.getPropertyValue('animation-duration')).toMatch(/s$/)
    expect(cell.style.getPropertyPriority('animation-duration')).toBe('important')
    expect(cell.style.getPropertyValue('animation-delay')).toMatch(/s$/)
  }
})

test('a reader who asked for reduced motion gets no inline cycle at all', () => {
  document.body.setAttribute(MOTION_ATTR, MOTION_REDUCED)
  const { track, matrix } = mount()
  expect(createEffortMatrix(track, matrix).ensure()).toBe(true)
  const cells = particles(matrix)
  expect(cells.length).toBeGreaterThan(0)
  for (const cell of cells) {
    expect(cell.style.getPropertyValue('animation-duration')).toBe('')
    expect(cell.style.getPropertyValue('animation-delay')).toBe('')
  }
})

test('the choice reaching the matrix after it was built rebuilds it still', () => {
  document.body.setAttribute(MOTION_ATTR, MOTION_FULL)
  const { track, matrix } = mount()
  const built = createEffortMatrix(track, matrix)
  expect(built.ensure()).toBe(true)
  expect(particles(matrix)[0].style.getPropertyValue('animation-duration')).not.toBe('')
  document.body.setAttribute(MOTION_ATTR, MOTION_REDUCED)
  // The same track and size: only the motion choice changed, and the signature
  // has to carry it or the built particles would keep their cycles.
  expect(built.ensure()).toBe(true)
  expect(particles(matrix)[0].style.getPropertyValue('animation-duration')).toBe('')
})
