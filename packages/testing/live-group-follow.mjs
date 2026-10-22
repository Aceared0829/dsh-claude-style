#!/usr/bin/env node
/**
 * live-group-follow.mjs — a running process group the skin shows while the
 * host's own disclosure stays closed, followed to its end through the stream,
 * with the edge fades the host would paint (D40, D71, D77).
 *
 * Registered in the lane's scenario table (packages/testing/scenarios.mjs).
 *
 * The standard tier caps one process group's body at min(400px, 50vh), and the
 * host follows that body only while its own disclosure stands open. The skin
 * shows a running group's body by a mark instead of opening that disclosure
 * (packages/client/src/features/chat-fold/process-fold.ts), so its follow
 * (features/chat-follow/process-follow.ts) is the one that has to keep the
 * window at its end, and the stylesheet paints the two edge fades itself
 * because the host computes its own only while open.
 *
 * The `think` script reasons in pieces for seconds inside one group, so the
 * window streams for long enough to be sampled. The scenario samples the body
 * every frame from the moment the mark shows it, then presses the header — the
 * reader opening the host's own disclosure — and reads the fades the host paints
 * there, which is what the stylesheet's have to match.
 */
import surface from './data/surface.json' with { type: 'json' }
import { bound } from './bounds.mjs'

/** The host's page markers this scenario reads, as packages/testing/lane.mjs names them. */
const HOST = {
  group: '[data-step-process]', // PROCESS_GROUP_SELECTOR
  body: '[data-step-process-body]', // PROCESS_BODY_SELECTOR
  header: 'button[data-process-activity]', // PROCESS_ACTIVITY_SELECTOR
  reasoning: '[data-variant="think"][data-state="running"]', // THINK_ROW_SELECTOR in its running phase
}
/** The mark the skin writes on a group it shows (packages/testing/data/surface.json). */
const SHOWN = surface.surface.find((entry) => entry.id === 'process.shown').attribute
/** How far behind its end the capped body may sit while it streams. */
const MAX_GAP_PX = bound('liveGroupGapPx')
/** The least the body's content has to grow while it is followed. */
const MIN_GROWTH_PX = 40
/** How deep the host's own edge band is (packages/client/src/features/chat-fold/fold.css). */
const EDGE_BAND_PX = 24

/**
 * The two bands a body's mask paints: the top band's depth and the bottom's. The
 * host's own open body carries a band on an edge it can still scroll from, and
 * none on an edge it has reached.
 */
function bandsOf(mask) {
  if (typeof mask !== 'string' || !mask.startsWith('linear-gradient')) return null
  const top = /rgb\(0, 0, 0\) (\d+(?:\.\d+)?)px/.exec(mask)
  const bottom = /calc\(100% - (\d+(?:\.\d+)?)px\)/.exec(mask)
  return { top: top === null ? 0 : Number(top[1]), bottom: bottom === null ? 0 : Number(bottom[1]) }
}

/** Sample the page once a frame: the marked group's body, its header, and the host's own edge marks. */
function watch(page) {
  return page.evaluate(({ marks, shown }) => {
    const frames = []
    window.__liveGroupFrames = frames
    const sample = () => {
      if (frames.length >= 6000) return
      const groups = [...document.querySelectorAll(marks.group)]
      const group = groups.find((candidate) => candidate.hasAttribute(shown)) ?? null
      const body = group === null ? null : group.querySelector(marks.body)
      const header = group === null ? null : group.querySelector(marks.header)
      const style = body === null ? null : getComputedStyle(body)
      frames.push({
        t: Math.round(performance.now()),
        mark: group !== null,
        expanded: header === null ? null : header.getAttribute('aria-expanded'),
        hidden: body === null ? null : body.getAttribute('hidden'),
        contentVisibility: style === null ? null : style.contentVisibility,
        bodyHeight: body === null ? null : Math.round(body.getBoundingClientRect().height),
        clientHeight: body === null ? null : body.clientHeight,
        scrollHeight: body === null ? null : body.scrollHeight,
        top: body === null ? null : Math.round(body.scrollTop),
        gap: body === null ? null : Math.round(body.scrollHeight - body.clientHeight - body.scrollTop),
        mask: style === null ? null : style.maskImage,
        scrollUp: body === null ? null : body.hasAttribute('data-scroll-up'),
        scrollDown: body === null ? null : body.hasAttribute('data-scroll-down'),
      })
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  }, { marks: HOST, shown: SHOWN })
}

/**
 * Press the marked group's header — the reader opening the host's own
 * disclosure — and keep the element for the readings that follow it.
 */
function openGroup(page) {
  return page.evaluate(({ marks, shown }) => {
    const group = [...document.querySelectorAll(marks.group)].find((candidate) => candidate.hasAttribute(shown)) ?? null
    const header = group === null ? null : group.querySelector(marks.header)
    if (!(header instanceof HTMLElement)) return null
    window.__liveGroupOpen = group
    const expanded = header.getAttribute('aria-expanded')
    header.click()
    return { expanded, at: window.__liveGroupFrames.length }
  }, { marks: HOST, shown: SHOWN })
}

function liveGroupFollowScenario({ check }) {
  return {
    script: 'think',
    prompt: 'think it through',
    delayMs: 300,
    viewport: { width: 1280, height: 600 },
    // The standard tier is the one that caps a running group's body.
    patch: [
      '- id: ui-chat',
      '  config:',
      '    transcriptView: standard',
    ],
    async duringTurn(context) {
      const { page } = context
      await watch(page)
      // The mark shows the body, and the reasoning inside it has outgrown the
      // cap far enough that its window is the thing being followed.
      await page.waitForFunction(({ marks, shown }) => {
        const group = [...document.querySelectorAll(marks.group)].find((candidate) => candidate.hasAttribute(shown))
        if (group === undefined) return false
        const body = group.querySelector(marks.body)
        return body !== null && body.scrollHeight - body.clientHeight > 60 && group.querySelector(marks.reasoning) !== null
      }, { marks: HOST, shown: SHOWN }, { timeout: 40000 })
      // A stretch of the stream the skin shows and follows, then the reader's
      // own press: from there the host's disclosure is open and its own fades
      // are on.
      await page.waitForTimeout(1200)
      context.notes.styled = await page.evaluate(() => window.__liveGroupFrames.length)
      context.notes.press = await openGroup(page)
      // The host computes its edges only while its disclosure is open: the body
      // it has brought to its end carries the up mark and not the down one.
      await page.waitForFunction((bodySelector) => {
        const group = window.__liveGroupOpen
        const body = group === null || group === undefined ? null : group.querySelector(bodySelector)
        return body !== null && body.hasAttribute('data-scroll-up') && !body.hasAttribute('data-scroll-down')
      }, HOST.body, { timeout: 20000 })
      context.notes.host = await page.evaluate((bodySelector) => {
        const group = window.__liveGroupOpen
        const body = group.querySelector(bodySelector)
        return {
          top: Math.round(body.scrollTop),
          scrollUp: body.hasAttribute('data-scroll-up'),
          scrollDown: body.hasAttribute('data-scroll-down'),
          mask: getComputedStyle(body).maskImage,
          gap: Math.round(body.scrollHeight - body.clientHeight - body.scrollTop),
          clientHeight: body.clientHeight,
          overflow: body.scrollHeight - body.clientHeight,
        }
      }, HOST.body)
    },
    async afterTurn(context) {
      context.notes.frames = await context.page.evaluate(() => window.__liveGroupFrames ?? [])
    },
    async assert({ session, notes }) {
      const frames = notes.frames ?? []
      const styled = frames.slice(0, notes.styled ?? 0).filter((frame) => frame.mark)
      const host = notes.host ?? {}
      const hostBands = bandsOf(host.mask ?? '')
      // The host's own rule for a body it has open: a band on an edge at least a
      // pixel can still be scrolled from, none on an edge it has reached.
      const wantedBands = (top, gap) => ({ top: top >= 1 ? EDGE_BAND_PX : 0, bottom: gap >= 1 ? EDGE_BAND_PX : 0 })
      const bandOff = styled.filter((frame) => {
        const bands = bandsOf(frame.mask)
        const wanted = wantedBands(frame.top, frame.gap)
        return bands === null || bands.top !== wanted.top || bands.bottom !== wanted.bottom
      })
      const gaps = styled.map((frame) => frame.gap)
      const grown = styled.length === 0 ? 0 : (styled.at(-1).scrollHeight ?? 0) - (styled[0].scrollHeight ?? 0)
      const folded = styled.filter((frame) => !(frame.hidden === 'until-found' && frame.expanded === 'false' && frame.contentVisibility === 'visible' && frame.bodyHeight > 0))
      const capped = styled.filter((frame) => (frame.scrollHeight ?? 0) > (frame.clientHeight ?? 0))
      return [
        check('蒙皮的标记显示着运行中的过程组：宿主的折叠状态仍为合上，body 照旧带 hidden="until-found"，却画出了盒子',
          styled.length > 20 && folded.length === 0 && capped.length > 20,
          `styled frames=${styled.length}, of them not drawn under a folded host=${folded.length}, capped=${capped.length}${folded.length === 0 ? '' : `：${JSON.stringify(folded.slice(0, 3))}`}`),
        check('限高窗口在流式输出期间跟到末尾',
          styled.length > 20 && grown >= MIN_GROWTH_PX && gaps.length > 0 && Math.max(...gaps) <= MAX_GAP_PX && styled.at(-1).gap <= MAX_GAP_PX,
          `grew ${grown}px, gap max=${gaps.length === 0 ? 'n/a' : Math.max(...gaps)} of ${gaps.length} frames, last=${styled.at(-1)?.gap}`),
        check('样式显示期间宿主自己的上下渐隐标记不出现：两条边由样式表画',
          styled.length > 0 && styled.every((frame) => frame.scrollUp === false && frame.scrollDown === false),
          JSON.stringify(styled.slice(-3).map((frame) => ({ up: frame.scrollUp, down: frame.scrollDown, mask: frame.mask })))),
        check('样式表画的渐隐走宿主自己打开时的那条规则：能滚的那条边一条 24px 的带，到头就没有',
          styled.length > 0 && bandOff.length === 0 && hostBands !== null &&
            hostBands.top === wantedBands(host.top, host.gap).top && hostBands.bottom === wantedBands(host.top, host.gap).bottom,
          `${bandOff.length} of ${styled.length} styled frames off the rule${bandOff.length === 0 ? '' : `：${JSON.stringify(bandOff.slice(0, 3).map((frame) => ({ top: frame.top, gap: frame.gap, mask: frame.mask })))}`}; host=${JSON.stringify(hostBands)} at top=${host.top} gap=${host.gap} (${host.mask})`),
        check('读者按下标题后，宿主自己的跟随把窗口带到末尾：上边能滚、下边到底',
          notes.press?.expanded === 'false' && host.scrollUp === true && host.scrollDown === false &&
            host.overflow > 0 && host.gap !== null && host.gap <= MAX_GAP_PX,
          JSON.stringify({ press: notes.press, host: { up: host.scrollUp, down: host.scrollDown, gap: host.gap, overflow: host.overflow, client: host.clientHeight } })),
        check('控制台没有异常', session.problems.length === 0, session.problems.slice(0, 3).join(' | ')),
      ]
    },
  }
}

export { liveGroupFollowScenario }
