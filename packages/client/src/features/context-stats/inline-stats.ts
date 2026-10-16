import { QUIET_ATTR } from '../../constants'
import { buildElement } from '../../shared/dom'
import { findComposerCard, findComposerStats } from '../../core/host'
import { formatCompactTokens } from '../../shared/format'
import { buildDigitGroup, writeDigits } from './stats-digits'
import { CACHE_HIT_STOPS, rampPosition, writeRamp } from './stats-ramp'
import { sessionStatsCacheHit, sessionStatsGrouped, sessionStatsSpeed } from './stats-format'
import type { HostSessionStatsProjection, HostTokenUsageProjection } from '@dsh-claude-style/contracts/services'
import type { HostText } from '../../core/host'
import type { StatsValueReader } from './stats-model'

/**
 * The session's numbers on a line of their own under the composer, for the
 * `inline` position of the `statsPosition` setting: the host's own words around
 * the host's own figures, none of the host's row's glyphs, and the context meter
 * the host draws at that line's end. The figures are digit groups
 * (stats-digits.ts), so a number that moved re-enters instead of swapping in
 * place, and the cache share takes the colour band the ramp names.
 *
 * The setting decides one thing: `context`, the default, keeps every figure in
 * the meter's panel, and `inline` writes the same figures here as well. The
 * host's statistics row and its two detail dialogs are hidden under both values
 * and the panel keeps both of its sections, so a change of value needs no
 * reload. The row stays in the document because the panel reads the
 * 「性能与用量」 level (详细 / 简洁) off its structure, and that panel's 简洁
 * level shows four figures — total elapsed (model time plus tool time, which the
 * host never totals, so the skin words it), average first token, output speed and
 * cache hit — in an untitled 2×2 grid. The switch belongs to this feature.
 *
 * The words come from the host's `chat` namespace — the templates its own
 * statistics row is written from (`stats.counts`, `stats.cacheHit`,
 * `message.tokensPerSecond`, `message.turnUsage.count`) — with each number
 * replaced by a marker first, so one template yields the words before and after
 * its number and the number itself stays its own animated figure. The host's four
 * format rules (`formatDuration`, `formatTokensPerSecond`, `formatExactTokens`,
 * `formatCacheHitPercent`) are written again in the skin, one function per host
 * function, to the character the same output.
 *
 * A line wider than the card it stands under gives way one step at a time, in
 * this order: the cache share's words, then the turns and steps, then the
 * meter's own reading (its ring stays), then the two token figures in favour of
 * one total, and last the counts folded into k, M and B. The line never
 * squeezes its own figures — a line that cannot fit is shortened, so a narrow
 * window shows fewer figures instead of figures drawn over each other. The
 * ladder moves width alone: the line keeps the height the composer measured for
 * the card's bottom line, or the conversation above it would jump with every
 * step. A step's room is read off a twin line laid out beside the line for that
 * one reading, so the shown line keeps its own figures and their pop-in.
 *
 * The segments stand apart by the line's own gap, with no separator glyph
 * between them. The line is also the second way into the host's context panel
 * (stats-binding.ts): a press opens the panel and the next closes it, Enter and
 * Space do the same, Escape closes it, and the line's own `aria-expanded` says
 * which way it stands; hover opening stays with the meter. The line stands where
 * the host's statistics row stood, in that row's parent.
 *
 * The figures are the host's `sessionStats` and `tokenUsage` projections, read
 * through the session's keyed projection face — the seat the host's own
 * `useProjection` reads (session-stats.ts) — and refilled whenever the panel
 * opens and whenever the line is rewritten, so a new frame shows in place.
 *
 * The host's key names and value shapes are the contract here: the two
 * projection units' keys, the `chat` keys, the projection face, the structure of
 * the host's statistics row and the meter's current shape. A host that wraps
 * those rows one layer deeper or renames its three stat dialogs' marks leaves
 * both groups of figures silently absent — nothing throws and nothing is
 * reported. The cache share's colour depends on the meter's filled arc being the
 * circle the host gives a dash array (`composer.meter-fill`); a host that draws
 * the arc another way leaves the ring uncoloured while the reading and the line
 * stand as they are.
 *
 * A host that shows these figures in a panel of its own, gives its statistics row
 * a slot to hang from, or writes the levels and the reading ramps itself makes
 * this line unnecessary.
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
    cacheTail: Text
  }
}

/** One figure of the line: its digit group and the words its template puts after it. */
function figure(className: string) {
  const group = buildDigitGroup('')
  const tail = document.createTextNode('')
  const wrap = buildElement('span', `dsh-claude-inline-figure ${className}`)
  wrap.append(group, tail)
  return { wrap, group, tail }
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
 * @returns { render, fit, clear }.
 */
export function createInlineStats(read: StatsValueReader, chatText: () => HostText | null, meter: () => HTMLElement | null) {
  let line: Line | null = null
  /** The twin a roomier step is measured on, built on the first fit that asks. */
  let probe: Line | null = null
  /** The ladder step in force, and what the last fit measured. */
  let level = 0
  let fitted = false
  /** The card width the last fit answered for; -1 asks for one. */
  let fittedWidth = -1

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
    const turns = buildDigitGroup('')
    const between = document.createTextNode('')
    const steps = buildDigitGroup('')
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
    const cacheFigure = buildDigitGroup('')
    const cacheTail = document.createTextNode('')
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
  function writeLine(shown: Line, at: number, chat: HostText) {
    const stats = read<HostSessionStatsProjection>('sessionStats') ?? null
    const usage = read<HostTokenUsageProjection>('tokenUsage') ?? null
    const counts = stats === null ? null : templateParts(chat, 'stats.counts', ['turns', 'steps'])
    const speedParts = templateParts(chat, 'message.tokensPerSecond', ['tps'])
    const tokenParts = templateParts(chat, 'message.turnUsage.count', ['count'])
    const cacheParts = templateParts(chat, 'stats.cacheHit', ['percent'])
    const billed = usage === null ? 0 : usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
    const hit = usage === null ? null : sessionStatsCacheHit(usage.cacheReadTokens, billed)
    const hasCounts = stats !== null && (stats.turns > 0 || stats.steps > 0)
    const hasSpeed = stats !== null && stats.decodeMs > 0
    const hasTokens = usage !== null && (billed > 0 || usage.outputTokens > 0)
    const hasCache = hasTokens && hit !== null
    const merged = at >= 4
    if (!hasCounts && !hasSpeed && !hasTokens) return false

    show(shown.counts, hasCounts && at < 2)
    show(shown.speed, hasSpeed)
    // The prompt tokens ride where the speed is; without a speed the room the
    // speed would have taken is theirs.
    show(shown.input, hasTokens && !merged)
    show(shown.output, hasTokens && !merged)
    show(shown.total, hasTokens && merged)
    show(shown.cache, hasCache)
    shown.cell.cacheHead.hidden = at >= 1

    let changed = false
    if (hasCounts && counts !== null && stats !== null) {
      changed = writeDigits(shown.cell.turns, String(stats.turns)) || changed
      writeText(shown.cell.between, counts[1] ?? '')
      changed = writeDigits(shown.cell.steps, String(stats.steps)) || changed
      writeText(shown.cell.countsTail, counts[2] ?? '')
    }
    if (hasSpeed && stats !== null) {
      changed = writeDigits(shown.cell.speed, sessionStatsSpeed(stats.decodeTokens / (stats.decodeMs / 1_000))) || changed
      writeText(shown.cell.speedTail, speedParts[1] ?? '')
    }
    if (hasTokens && usage !== null) {
      // Every token figure folds into k / M / B at the ladder's last step.
      const readTokens = (value: number) => at >= FIT_MAX ? formatCompactTokens(value) : sessionStatsGrouped(value, chat)
      changed = writeDigits(shown.cell.input, readTokens(billed)) || changed
      writeText(shown.cell.inputTail, tokenParts[1] ?? '')
      changed = writeDigits(shown.cell.output, readTokens(usage.outputTokens)) || changed
      writeText(shown.cell.outputTail, tokenParts[1] ?? '')
      changed = writeDigits(shown.cell.total, readTokens(billed + usage.outputTokens)) || changed
      writeLabel(shown.cell.cacheHead, cacheParts[0] ?? '')
      if (hit !== null) changed = writeDigits(shown.cell.cache, hit) || changed
      writeText(shown.cell.cacheTail, cacheParts[1] ?? '')
      writeRamp(shown.cache.wrap, 'cache', hit === null ? null : rampPosition(Number(hit), CACHE_HIT_STOPS))
    }
    return changed
  }

  /**
   * How much room a line `width` px wide takes together with the meter. The
   * meter sits beside the shown line while there is room and drops below it
   * when there is not, so the shape is read off the shown line: side by side
   * the line and everything up to the meter's right edge have to fit, one above
   * the other the wider of the two does.
   */
  function neededWidth(shown: Line, width: number) {
    const lineBox = shown.root.getBoundingClientRect()
    const hostMeter = meter()
    if (hostMeter === null) return width
    const meterBox = hostMeter.getBoundingClientRect()
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
   * How much room ladder step `at` would take, read off the twin. The twin
   * stands out of flow beside the shown line for the one reading and is taken
   * off before anything paints, so the shown line keeps its figures as they
   * are: hiding one and showing it again, or folding it and writing it back,
   * would replay its pop-in on every fit. The meter takes the step's shape
   * for the reading and gets the line's back after it.
   */
  function probeWidth(shown: Line, at: number, chat: HostText) {
    if (probe === null) {
      probe = buildLine()
      probe.root.setAttribute(INLINE_PROBE_ATTR, '')
      // Its coming and going is no page change for the scheduler (D40).
      probe.root.setAttribute(QUIET_ATTR, '')
      probe.root.setAttribute('aria-hidden', 'true')
    }
    writeLine(probe, at, chat)
    tightenMeter(at)
    shown.root.before(probe.root)
    const needed = neededWidth(shown, probe.root.getBoundingClientRect().width)
    probe.root.remove()
    tightenMeter(level)
    return needed
  }

  /**
   * Shorten the line until it fits the card it stands under, or, when it
   * already fits, give back every step whose roomier shape fits with
   * FIT_SLACK_PX to spare. Shortening steps the shown line itself: each step
   * only takes figures away, and the step it stops on is the one that shows.
   * Giving back measures on the twin and writes the shown line once, so a
   * step the room does not allow leaves it untouched. Both walks end at a
   * ladder end, so a card too narrow for the last step leaves the line on it.
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
    if (card === null || chat === null) return level
    const available = card.clientWidth
    if (available <= 0) return level
    if (!force && fitted && available === fittedWidth) return level
    fittedWidth = available
    const shownWidth = () => neededWidth(shown, shown.root.getBoundingClientRect().width)
    const step = (next: number) => {
      setLevel(next)
      writeLine(shown, next, chat)
    }
    if (shownWidth() > available) {
      while (level < FIT_MAX && shownWidth() > available) step(level + 1)
    } else {
      let roomier = level
      while (roomier > 0 && probeWidth(shown, roomier - 1, chat) + FIT_SLACK_PX <= available) roomier -= 1
      if (roomier !== level) step(roomier)
    }
    fitted = true
    return level
  }

  /**
   * Write the line from the current projections, then fit it to the card. A
   * render that wrote nothing keeps the step it is on and measures nothing:
   * this runs on every projection frame while an answer streams.
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
    const changed = writeLine(line, level, chat)
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
