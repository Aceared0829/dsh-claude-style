import { DARK_THEME_ATTRIBUTE } from '@dsh-claude-style/contracts/dom'
import { observeSize } from '@dsh-claude-style/engine/bus'
import { buildElement } from '@dsh-claude-style/engine/dom'
import { requestFrame } from '@dsh-claude-style/engine/frame'
import { findHeroRoot } from '@dsh-claude-style/engine/host'
import type { FrameTask } from '@dsh-claude-style/engine/frame'
import { motionReduced } from '../../core/prefs'
import { createGlyphField } from './ripple-field'
import type { FieldPalette, GlyphField, Rgb } from './ripple-field'
import { RIPPLE } from './ripple-params'
import { createWaveField } from './ripple-wave'
import type { WaveField } from './ripple-wave'
import type { HostContext } from '@dsh-claude-style/engine/host'
import type { FeatureUi } from '../../core/feature'
import type manifest from './home-ripple.manifest'

/** The hero page's root while the field is mounted in it; the stylesheet gives the root a stacking context of its own. */
const RIPPLE_ATTR = 'data-dsh-claude-ripple'
/** The theme tokens the canvas is drawn with (theme/tokens.json). */
const INK_TOKEN = '--dsh-claude-ripple-ink'
const WAVE_TOKEN = '--dsh-claude-ripple-wave'
const FONT_TOKEN = '--dsh-claude-font-code'

/** The field on one hero root: the canvas, the grid it is sized for, and the two layers that fill it. */
interface Mounted {
  root: HTMLElement
  canvas: HTMLCanvasElement
  width: number
  height: number
  dpr: number
  waves: WaveField
  field: GlyphField
  /** What the page's tokens resolve to, or null until it has applied them. */
  palette: FieldPalette | null
  stopPresses: () => void
  stopFrames: () => void
  stopSize: () => void
  /** The pending idle wake-up, or 0. */
  timer: number
}

/**
 * A token's colour as channels, or null while the page has not applied the
 * token yet: the tokens stand behind the palette attribute, which is written
 * once the preferences have been read, so a page that opens on the home screen
 * mounts the field before its colours exist. The canvas context turns whatever
 * the page resolves the token to (a literal, or the host's own alias) into
 * `#rrggbb`; a value it cannot read is a mistake in the token table (D12).
 */
function colour(context: CanvasRenderingContext2D, style: CSSStyleDeclaration, token: string): Rgb | null {
  const value = style.getPropertyValue(token).trim()
  if (value === '') return null
  context.fillStyle = '#000001'
  context.fillStyle = value
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(context.fillStyle)
  if (match === null || context.fillStyle === '#000001') throw new Error(`home-ripple: ${token} is "${value}", not an opaque colour`)
  return [parseInt(match[1]!, 16), parseInt(match[2]!, 16), parseInt(match[3]!, 16)]
}

/**
 * The new-conversation page's background: a field of digits and letters, set
 * in the code face, that redraws a couple of times a second under a drifting
 * cloud and shows only where the cloud is thin. A press on the page starts
 * waves from it that reveal the characters they pass, blue at the front and
 * grey behind.
 *
 * The canvas is a child of the hero root, under the page's own content, and
 * never takes a press. It is mounted while the hero root exists and handed back
 * the moment it does not; the host's markup is not touched. While nothing
 * moves, the next draw is waited for on a timer set to the next change of
 * characters; frames run only while a wave or its afterglow is on the canvas.
 * The colours are read when a frame draws, and the size when the root resizes.
 */
export function install(ctx: HostContext, ui: FeatureUi<typeof manifest>) {
  let mounted: Mounted | null = null
  let colourContext: CanvasRenderingContext2D | null | undefined

  function readPalette(canvas: HTMLCanvasElement): FieldPalette | null {
    const style = getComputedStyle(canvas)
    // The canvas itself holds a webgl context, so the colours are parsed on a canvas of their own.
    colourContext ??= canvas.ownerDocument.createElement('canvas').getContext('2d')
    if (colourContext === null) throw new Error('home-ripple: the colour canvas has no 2d context')
    const context = colourContext
    const ink = colour(context, style, INK_TOKEN)
    const wave = colour(context, style, WAVE_TOKEN)
    if (ink === null || wave === null) return null
    return {
      ink,
      wave,
      dark: document.body.hasAttribute(DARK_THEME_ATTRIBUTE),
      fontFamily: style.getPropertyValue(FONT_TOKEN).trim(),
    }
  }

  /** Size the canvas to the root, and build the grid and the two layers for that size. */
  function layout(current: Mounted) {
    const width = current.root.clientWidth
    const height = current.root.clientHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (width === current.width && height === current.height && dpr === current.dpr) return
    const columns = Math.ceil(width / RIPPLE.cellWidth)
    const rows = Math.ceil(height / RIPPLE.cellHeight)
    current.width = width
    current.height = height
    current.dpr = dpr
    // The canvas covers whole cells, so the last column and row may reach past the root's edge.
    current.canvas.width = Math.round(columns * RIPPLE.cellWidth * dpr)
    current.canvas.height = Math.round(rows * RIPPLE.cellHeight * dpr)
    current.canvas.style.width = `${columns * RIPPLE.cellWidth}px`
    current.canvas.style.height = `${rows * RIPPLE.cellHeight}px`
    current.field.dispose()
    current.waves = createWaveField(columns, rows)
    current.field = createGlyphField(current.canvas, columns, rows, current.waves)
  }

  function mount(root: HTMLElement) {
    const canvas = buildElement('canvas', 'dsh-claude-ripple-canvas')
    root.appendChild(canvas)
    root.setAttribute(RIPPLE_ATTR, '')
    const waves = createWaveField(0, 0)
    const current: Mounted = {
      root,
      canvas,
      width: -1,
      height: -1,
      dpr: 0,
      waves,
      field: createGlyphField(canvas, 0, 0, waves),
      palette: null,
      stopPresses: () => {},
      stopFrames: () => {},
      stopSize: () => {},
      timer: 0,
    }
    let previous = performance.now()
    let frameWanted = false

    /** Ask for a frame now; a pending timer is dropped, since the frame decides the next wake-up. */
    function wake() {
      window.clearTimeout(current.timer)
      current.timer = 0
      if (frameWanted) return
      frameWanted = true
      current.stopFrames = requestFrame(task)
    }

    /** Wait on a timer for the next change of characters. */
    function sleep(now: number) {
      const period = 1000 / RIPPLE.changeRate
      current.timer = window.setTimeout(wake, period - (now % period) + 1)
    }

    const task: FrameTask = {
      write(now) {
        frameWanted = false
        const still = motionReduced()
        current.waves.advance(still ? 0 : (now - previous) / 1000)
        previous = now
        if (current.canvas.width > 0 && current.field.needsDraw(now, still)) {
          // A page without its tokens has no colours yet; it is asked again on the next wake-up.
          current.palette = readPalette(canvas)
          if (current.palette !== null) current.field.draw(now, current.palette, still)
        }
        if (current.field.busy() && !still) wake()
        else sleep(now)
      },
    }

    function onPress(event: PointerEvent) {
      if (event.button !== 0 || motionReduced()) return
      const box = canvas.getBoundingClientRect()
      const column = Math.floor((event.clientX - box.left) / RIPPLE.cellWidth)
      const row = Math.floor((event.clientY - box.top) / RIPPLE.cellHeight)
      previous = performance.now()
      current.waves.disturb(column, row)
      wake()
    }
    root.addEventListener('pointerdown', onPress, { passive: true })
    current.stopPresses = () => { root.removeEventListener('pointerdown', onPress) }
    // The size callback hears the root's size once on subscribing, which builds the first grid.
    current.stopSize = observeSize(root, () => {
      layout(current)
      wake()
    })
    return current
  }

  function unmount() {
    if (mounted === null) return
    window.clearTimeout(mounted.timer)
    mounted.stopFrames()
    mounted.stopSize()
    mounted.stopPresses()
    mounted.field.dispose()
    mounted.canvas.remove()
    mounted.root.removeAttribute(RIPPLE_ATTR)
    mounted = null
  }

  /** Each pass follows the hero root: mount on it, move with it, leave when the page does. */
  function sync() {
    const root = findHeroRoot()
    if (mounted !== null && (mounted.root !== root || !mounted.canvas.isConnected)) unmount()
    if (mounted === null && root !== null) mounted = mount(root)
  }

  ui.homeRipple = { sync }

  return () => {
    unmount()
    delete ui.homeRipple
  }
}
