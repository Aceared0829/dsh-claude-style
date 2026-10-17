import { QUIET_ATTR } from '../../constants'
import { buildElement } from '@dsh-claude-style/engine/dom'
import { findComposerCard, findComposerStats } from '@dsh-claude-style/engine/host'
import { formatCompactTokens } from '../../shared/format'
import { inPageBox, inPagePixels } from '../../shared/page-zoom'
import { createStatsCount } from './stats-count'
import { CACHE_HIT_STOPS, rampPosition, writeRamp } from './stats-ramp'
import { sessionStatsCacheHit, sessionStatsGrouped, sessionStatsSpeed } from './stats-format'
import type { HostSessionStatsProjection, HostTokenUsageProjection } from '@dsh-claude-style/contracts/services'
import type { HostText } from '@dsh-claude-style/engine/host'
import type { StatsReading } from './stats-count'
import type { StatsValueReader } from './stats-model'

/**
 * The session's numbers on a line of their own under the composer, for the
 * `inline` position of the `statsPosition` setting: the host's own words around
 * the host's own figures, none of the host's row's glyphs, and the context meter
 * the host draws at that line's end. The figures are plain text, and a reading
 * that moves counts to its new value (stats-count.ts): while an answer streams
 * the readings arrive back to back, and an entrance on every one would churn
 * the line for numbers that barely moved. The cache share's figure and the
 * percent sign after it take the colour band the ramp names while the label
 * before them keeps the line's own tone.
 *
 * The host's statistics row stays in the document, hidden, because the panel
 * reads the 「性能与用量」 level off its structure. The words come from the
 * host's own `chat` templates with each number swapped for a marker, so every
 * number stays its own figure. A line too wide for its card drops figures one
 * step at a time and never changes height, or the conversation above it would
 * jump with every step.
 *
 * The contract is the host's projection keys, `chat` keys and the statistics
 * row's structure: a host that reshapes the row leaves the figures absent
 * without an error. A host panel or slot for these figures retires this line.
 */

/** The mark on the line itself. */
export const INLINE_STATS_ATTR = 'data-dsh-claude-inline-stats'
/** On the line's measuring twin, which a fit lays out of flow for one reading. */
export const INLINE_PROBE_ATTR = 'data-dsh-claude-inline-probe'
/**
 * On the meter while the line has given up its own reading: the ring stands,
 * the number beside it goes (the ladder's third step).
 */
export const METER_TIGHT_ATTR = 'data-dsh-claude-meter-tight'
/** Stands in for one number while a template is split into its words. */
const MARK = '\u0001'
/** The last step of the ladder. */
const FIT_MAX = 5
/** Room a step must free up before the line takes the roomier step back. */
const FIT_SLACK_PX = 24

/** One segment of the line: the group of figures the ladder shows or gives up whole. */
interface Segment {
  wrap: HTMLElement
}

/** Every element of the line, in the order it appears. */
interface Line {
  root: HTMLElement
  counts: Segment
  speed: Segment
  input: Segment
  output: Segment
  total: Segment
  cache: Segment
  cell: {
    turns: HTMLElement
    between: Text
    steps: HTMLElement
    countsTail: Text
    speed: HTMLElement
    speedTail: Text
    input: HTMLElement
    inputTail: Text
    output: HTMLElement
    outputTail: Text
    total: HTMLElement
    cacheHead: HTMLElement
    cache: HTMLElement
    cacheTail: HTMLElement
  }
}

/** What each figure last showed, so a frame that moved nothing writes nothing. */
const shownFigures = new WeakMap<Element, string>()

/** One figure of the line: its element, and the words its template puts after it. */
function figure(className: string) {
  const group = buildFigure()
  const tail = document.createTextNode('')
  const wrap = buildElement('span', `dsh-claude-inline-figure ${className}`)
  wrap.append(group, tail)
  return { wrap, group, tail }
}

/** One figure's element: plain text a count rewrites in place. */
function buildFigure() {
  return buildElement('span', 'dsh-claude-digit-group')
}

/**
 * Write one figure only when its text changed: a count in flight rewrites every
 * frame, and most of the figures stand still between two readings.
 */
function writeFigure(element: HTMLElement, text: string) {
  if (shownFigures.get(element) === text) return
  shownFigures.set(element, text)
  element.textContent = text
}

/**
 * One direction arrow: which way the tokens went is said by the figure it
 * stands beside, so the glyph is decorative for a reader.
 */
function arrowSpan(glyph: string) {
  const span = buildElement('span', 'dsh-claude-inline-arrow', glyph)
  span.setAttribute('aria-hidden', 'true')
  return span
}

/** Write a text node only when its words changed. */
function writeText(node: Text, text: string) {
  if (node.data !== text) node.data = text
}

/** The same for the one label that has to be an element, so the ladder can hide it. */
function writeLabel(element: HTMLElement, text: string) {
  if (element.textContent !== text) element.textContent = text
}

/** One template's words, its numbers replaced by MARK and split on them. */
function templateParts(chat: HostText, key: string, names: string[]) {
  const params: Record<string, string> = {}
  for (let i = 0; i < names.length; i++) params[names[i]] = MARK
  return chat(key, params).split(MARK)
}

/**
 * The line's writer.
 *
 * @param read - one projection's current whole value.
 * @param chatText - the host's `chat` translate seat, or null when it is absent.
 * @param meter - the host's context meter, stamped by the composer pass.
 * @returns { render, fit, reset, clear, root }.
 */
export function createInlineStats(read: StatsValueReader, chatText: () => HostText | null, meter: () => HTMLElement | null) {
  let line: Line | null = null
  /** The twin a fit measures on, built on the first fit that asks. */
  let probe: Line | null = null
  /** The ladder step in force, and what the last fit measured. */
  let level = 0
  let fitted = false
  /** The card width the last fit answered for; -1 asks for one. */
  let fittedWidth = -1

  /** The figures counting from what the reader sees to the newest reading. */
  const count = createStatsCount((reading: StatsReading) => {
    const chat = chatText()
    if (line !== null && chat !== null) writeLine(line, level, chat, reading.stats, reading.usage)
  })

  /** Build the line once, in the order its segments appear. */
  function buildLine(): Line {
    const root = buildElement('span', 'dsh-claude-inline-stats')
    root.setAttribute(INLINE_STATS_ATTR, '')
    /** One segment: the group of figures the ladder shows or gives up whole. */
    const segment = (): Segment => {
      const wrap = buildElement('span', 'dsh-claude-inline-seg')
      root.appendChild(wrap)
      return { wrap }
    }

    // The counts, from the one template that carries two numbers.
    const counts = segment()
    const turns = buildFigure()
    const between = document.createTextNode('')
    const steps = buildFigure()
    const countsTail = document.createTextNode('')
    counts.wrap.append(turns, between, steps, countsTail)

    // The output speed, then the tokens read into the prompt beside it.
    const speed = segment()
    const speedFigure = figure('dsh-claude-inline-speed')
    speed.wrap.appendChild(speedFigure.wrap)
    const input = segment()
    input.wrap.append(arrowSpan('↑'))
    const inputFigure = figure('dsh-claude-inline-input')
    input.wrap.appendChild(inputFigure.wrap)

    // The tokens written back, then — for the tightest step that still shows
    // figures — one total in their place, and the cache share.
    const output = segment()
    output.wrap.append(arrowSpan('↓'))
    const outputFigure = figure('dsh-claude-inline-output')
    output.wrap.appendChild(outputFigure.wrap)
    const total = segment()
    const totalFigure = figure('dsh-claude-inline-total')
    total.wrap.appendChild(totalFigure.wrap)
    const cache = segment()
    const cacheHead = buildElement('span', 'dsh-claude-inline-label')
    const cacheFigure = buildFigure()
    // The words the template puts after the number (a percent sign) are an
    // element so the figure's own band can reach them; the label before the
    // number stays on the line's tone.
    const cacheTail = buildElement('span', 'dsh-claude-inline-tail')
    cache.wrap.append(cacheHead, cacheFigure, cacheTail)

    return {
      root,
      counts,
      speed,
      input,
      output,
      total,
      cache,
      cell: {
        turns,
        between,
        steps,
        countsTail,
        speed: speedFigure.group,
        speedTail: speedFigure.tail,
        input: inputFigure.group,
        inputTail: inputFigure.tail,
        output: outputFigure.group,
        outputTail: outputFigure.tail,
        total: totalFigure.group,
        cacheHead,
        cache: cacheFigure,
        cacheTail,
      },
    }
  }

  /** Put the line back where it belongs when the host re-rendered that area. */
  function place(root: HTMLElement) {
    const row = findComposerStats()
    if (row === null || row.parentElement === null) return false
    if (root.parentElement !== row.parentElement) row.parentElement.insertBefore(root, row)
    return true
  }

  /** Take the line off the page, and the meter's step with it. */
  function clear() {
    count.reset()
    if (line !== null && line.root.parentElement !== null) line.root.parentElement.removeChild(line.root)
    const hostMeter = meter()
    if (hostMeter !== null) hostMeter.removeAttribute(METER_TIGHT_ATTR)
    level = 0
    fitted = false
    fittedWidth = -1
  }

  /** Show or hide one segment. */
  function show(segment: Segment, on: boolean) {
    segment.wrap.hidden = !on
  }

  /** Every figure that has data, in the words the host's templates give it, on ladder step `at`. */
  function writeLine(shown: Line, at: number, chat: HostText, stats: HostSessionStatsProjection | null, usage: HostTokenUsageProjection | null) {
    const counts = stats === null ? null : templateParts(chat, 'stats.counts', ['turns', 'steps'])
    const speedParts = templateParts(chat, 'message.tokensPerSecond', ['tps'])
    const tokenParts = templateParts(chat, 'message.turnUsage.count', ['count'])
    const cacheParts = templateParts(chat, 'stats.cacheHit', ['percent'])
    const billed = usage === null ? 0 : usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
    // A count in flight feeds this writer fractions of a reading; the reader
    // sees the whole numbers the host's own formatters produce.
    const hit = usage === null ? null : sessionStatsCacheHit(Math.round(usage.cacheReadTokens), Math.round(billed))
    const hasCounts = stats !== null && (stats.turns > 0 || stats.steps > 0)
    const hasSpeed = stats !== null && stats.decodeMs > 0
    const hasTokens = usage !== null && (billed > 0 || usage.outputTokens > 0)
    const hasCache = hasTokens && hit !== null
    const merged = at >= 4
    if (!hasCounts && !hasSpeed && !hasTokens) return

    show(shown.counts, hasCounts && at < 2)
    show(shown.speed, hasSpeed)
    // The prompt tokens ride where the speed is; without a speed the room the
    // speed would have taken is theirs.
    show(shown.input, hasTokens && !merged)
    show(shown.output, hasTokens && !merged)
    show(shown.total, hasTokens && merged)
    show(shown.cache, hasCache)
    shown.cell.cacheHead.hidden = at >= 1

    if (hasCounts && counts !== null && stats !== null) {
      writeFigure(shown.cell.turns, String(Math.round(stats.turns)))
      writeText(shown.cell.between, counts[1] ?? '')
      writeFigure(shown.cell.steps, String(Math.round(stats.steps)))
      writeText(shown.cell.countsTail, counts[2] ?? '')
    }
    if (hasSpeed && stats !== null) {
      writeFigure(shown.cell.speed, sessionStatsSpeed(stats.decodeTokens / (stats.decodeMs / 1_000)))
      writeText(shown.cell.speedTail, speedParts[1] ?? '')
    }
    if (hasTokens && usage !== null) {
      // Every token figure folds into k / M / B at the ladder's last step.
      const readTokens = (value: number) => at >= FIT_MAX ? formatCompactTokens(Math.round(value)) : sessionStatsGrouped(Math.round(value), chat)
      writeFigure(shown.cell.input, readTokens(billed))
      writeText(shown.cell.inputTail, tokenParts[1] ?? '')
      writeFigure(shown.cell.output, readTokens(usage.outputTokens))
      writeText(shown.cell.outputTail, tokenParts[1] ?? '')
      writeFigure(shown.cell.total, readTokens(billed + usage.outputTokens))
      writeLabel(shown.cell.cacheHead, cacheParts[0] ?? '')
      if (hit !== null) writeFigure(shown.cell.cache, hit)
      writeLabel(shown.cell.cacheTail, cacheParts[1] ?? '')
      writeRamp(shown.cache.wrap, 'cache', hit === null ? null : rampPosition(Number(hit), CACHE_HIT_STOPS))
    }
  }

  /**
   * How much room a line `width` px wide takes together with the meter. The
   * meter sits beside the shown line while there is room and drops below it
   * when there is not, so the shape is read off the shown line: side by side
   * the line and everything up to the meter's right edge have to fit, one above
   * the other the wider of the two does.
   */
  function neededWidth(shown: Line, width: number) {
    // Both boxes and the width against them in the pixels the card's own width
    // is given in (shared/page-zoom.ts).
    const lineBox = inPageBox(shown.root.getBoundingClientRect())
    const hostMeter = meter()
    if (hostMeter === null) return width
    const meterBox = inPageBox(hostMeter.getBoundingClientRect())
    const beside = Math.abs(meterBox.top - lineBox.top) < lineBox.height
    return beside ? width + meterBox.right - lineBox.right : Math.max(width, meterBox.width)
  }

  /** The meter's shape on ladder step `at`: it gives up its reading at the third. */
  function tightenMeter(at: number) {
    const hostMeter = meter()
    if (hostMeter !== null) hostMeter.toggleAttribute(METER_TIGHT_ATTR, at >= 3)
  }

  /** Put the line on one rung of the ladder. */
  function setLevel(next: number) {
    level = next
    tightenMeter(next)
  }

  /**
   * How much room ladder step `at` would take, written with the reading the
   * count is moving to and read off the twin. The twin stands out of flow beside
   * the shown line for the one reading and is taken off before anything paints:
   * the shown line keeps the numbers it is showing, and the room is measured for
   * the ones the count is heading for, so the step the line stops on fits before
   * the figures get there. The meter takes the step's shape for the reading and
   * gets the line's back after it.
   */
  function probeWidth(shown: Line, at: number, chat: HostText, reading: StatsReading) {
    if (probe === null) {
      probe = buildLine()
      probe.root.setAttribute(INLINE_PROBE_ATTR, '')
      // Its coming and going is no page change for the scheduler (D40).
      probe.root.setAttribute(QUIET_ATTR, '')
      probe.root.setAttribute('aria-hidden', 'true')
    }
    writeLine(probe, at, chat, reading.stats, reading.usage)
    tightenMeter(at)
    shown.root.before(probe.root)
    const needed = neededWidth(shown, inPagePixels(probe.root.getBoundingClientRect().width))
    probe.root.remove()
    tightenMeter(level)
    return needed
  }

  /**
   * Shorten the line until it fits the card it stands under, or, when it
   * already fits, give back every step whose roomier shape fits with
   * FIT_SLACK_PX to spare. Both walks measure the twin, which carries the
   * reading the count is moving to: the figures on show may still be counting
   * up to it. Both walks end at a ladder end, so a card too narrow for the last
   * step leaves the line on it.
   *
   * @param force - measure again even when the card has not changed width:
   *     the render path passes it, a scroll does not, so scrolling a card of
   *     one width stops paying for the twin probes.
   */
  function fit(force = false) {
    const shown = line
    if (shown === null || shown.root.parentElement === null) return level
    const card = findComposerCard()
    const chat = chatText()
    const goal = count.goal()
    if (card === null || chat === null || goal === null) return level
    const available = card.clientWidth
    if (available <= 0) return level
    if (!force && fitted && available === fittedWidth) return level
    fittedWidth = available
    const measure = (at: number) => probeWidth(shown, at, chat, goal)
    if (measure(level) > available) {
      while (level < FIT_MAX && measure(level) > available) setLevel(level + 1)
    } else {
      let roomier = level
      while (roomier > 0 && measure(roomier - 1) + FIT_SLACK_PX <= available) roomier -= 1
      if (roomier !== level) setLevel(roomier)
    }
    // The step that stands is written onto the shown line with the numbers it
    // shows, so the figures that remain are the ones the reader is watching.
    const displayed = count.current()
    writeLine(shown, level, chat, displayed.stats, displayed.usage)
    fitted = true
    return level
  }

  /**
   * Write the line from the current projections, then fit it to the card. A
   * render that found the same reading keeps the count it is on and measures
   * nothing: this runs on every projection frame while an answer streams.
   */
  function render() {
    const chat = chatText()
    if (chat === null) {
      clear()
      return
    }
    const stats = read<HostSessionStatsProjection>('sessionStats') ?? null
    const usage = read<HostTokenUsageProjection>('tokenUsage') ?? null
    if (stats === null && usage === null) {
      clear()
      return
    }
    if (line === null) line = buildLine()
    if (!place(line.root)) {
      clear()
      return
    }
    const changed = count.to({ stats, usage })
    if (changed || !fitted) fit(true)
  }

  return {
    render,
    /** Measure again after a viewport or composer change, without rewriting the figures. */
    fit,
    clear,
    /**
     * The line's own element while it stands on the page: the panel's second
     * trigger, which the feature binds to the host's meter (session-stats.ts).
     */
    root() {
      return line === null || line.root.parentElement === null ? null : line.root
    },
  }
}
