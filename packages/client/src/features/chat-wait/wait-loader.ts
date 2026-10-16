import { motionReduced } from '../../core/prefs'
import { motionEase, motionMs } from '../../shared/motion'

/**
 * The waiting line's loader carries three motions at once, one lane each, and
 * this is the state machine that rotates them (chat-wait.css holds the lanes,
 * their motions, and what each motion's own moments are).
 *
 * The loader opens on the snippet's bouncing dots and then, every
 * `--dsh-claude-period-dot-rotate`, hands the row over to another of the three
 * — a motion never follows itself, so the turn is always a visible change: the
 * hopping dots, the dots walking three lines through one point, and the four
 * dots swapping the corners of a 45 : 55 rectangle.
 *
 * A change is a hand-over and never a cut: the lane leaving fades each of its
 * dots out over one of its own legs, starting where that motion next turns back
 * — off the floor for a bounce, off a far end for a walk, wherever it stands for
 * the swap, whose own cycle is the only thing that carries it out to a corner —
 * and the lane arriving fades each of its dots in over one of its own legs,
 * starting where that motion next carries it. No dot is ever moved to a pose its
 * motion does not carry, and no dot leaves or arrives at a moment its own motion
 * did not choose.
 *
 * Under the Reduced animation choice (D40) a change lands at once, with no fade:
 * each lane holds the frame its own motion stands on.
 */

/** A motion the loader's dots play. */
export type WaitLoaderMotion = 'bounce' | 'line' | 'orbit'

/** The lane, and how many dots, one motion is built from. */
const LANES: { motion: WaitLoaderMotion; lane: string; dots: number }[] = [
  { motion: 'bounce', lane: 'is-bounce', dots: 3 },
  { motion: 'line', lane: 'is-line', dots: 3 },
  { motion: 'orbit', lane: 'is-orbit', dots: 4 },
]

/** The lane in play, the one on its way out, and the one out of the page. */
const ACTIVE = 'is-active'
const LEAVING = 'is-leaving'
const RESTING = 'is-resting'

/** What the hand-over's own fades are called, so a stale one can be let go. */
const FADE = 'dsh-claude-wait-fade'

const DOT = 'dsh-claude-chat-wait-dot'

/**
 * A lane's own account of its motion: the shares of its keyframes at which one
 * of its dots arrives and leaves, and how long one of its fades takes as a share
 * of the motion's own turn. The stylesheet owns these beside the keyframes they
 * describe; the curve a fade runs on is chosen below, from the token sheet (D9).
 *
 * A lane may declare no leaving moment at all — the swapping lane does — and its
 * dots then fade where they stand.
 */
type LaneTiming = {
  arrives: number[]
  leaves: number[]
  fade: number
}

type LoaderState = {
  /** The motion in play, once the opening one has been laid down. */
  motion: WaitLoaderMotion
  /** The rotation running out, so the next motion is laid down. */
  timer: number | null
}

const loaders = new WeakMap<HTMLElement, LoaderState>()

/** The one entry of LANES a motion is built from. */
function laneEntry(motion: WaitLoaderMotion) {
  const entry = LANES.find((one) => one.motion === motion)
  if (entry === undefined) throw new Error(`chat-wait: no lane is built for ${motion} (chat-wait.css)`)
  return entry
}

/** One lane of one loader. */
function laneOf(loader: HTMLElement, motion: WaitLoaderMotion): Element {
  const lane = loader.querySelector(`.${laneEntry(motion).lane}`)
  if (lane === null) throw new Error('chat-wait: the loader is missing a lane (chat-wait.css)')
  return lane
}

/** The dots of one lane. */
function dotsOf(loader: HTMLElement, motion: WaitLoaderMotion): Element[] {
  return Array.from(laneOf(loader, motion).querySelectorAll(`.${DOT}`))
}

/**
 * Put every lane in its place in one pass, so no lane ever holds two of these at
 * once: the one arriving is the one in play, the one leaving keeps drawing until
 * its fades are done, and the rest are out of the page.
 */
function place(loader: HTMLElement, to: WaitLoaderMotion, from: WaitLoaderMotion | null) {
  for (const { motion, lane: name } of LANES) {
    const lane = laneOf(loader, motion)
    lane.classList.toggle(ACTIVE, motion === to)
    lane.classList.toggle(LEAVING, motion === from)
    lane.classList.toggle(RESTING, motion !== to && motion !== from)
  }
}

/** The shares a lane declares for one of the hand-over's names. */
function sharesOf(style: CSSStyleDeclaration, name: string): number[] {
  return style.getPropertyValue(name).trim().split(/\s+/).filter((one) => one !== '').map(Number)
}

function timingOf(lane: Element): LaneTiming {
  const style = getComputedStyle(lane)
  const fade = Number(style.getPropertyValue('--dsh-claude-dot-fade'))
  if (!Number.isFinite(fade) || fade <= 0) throw new Error('chat-wait: a loader lane declares no fade length (chat-wait.css)')
  return {
    arrives: sharesOf(style, '--dsh-claude-dot-arrives'),
    leaves: sharesOf(style, '--dsh-claude-dot-leaves'),
    fade,
  }
}

/**
 * How far through its own keyframes a motion stands at `time`, as the share of
 * them it has reached: an `alternate` motion plays them backwards every other
 * turn.
 */
function shareAt(turn: number, alternate: boolean, time: number): number {
  const passed = Math.floor(time / turn)
  const through = (time - passed * turn) / turn
  return alternate && passed % 2 === 1 ? 1 - through : through
}

/**
 * How long until the motion next stands at one of these shares. The window is a
 * whole cycle, which is the longest a dot of any motion can be from one of its
 * own moments. A lane that declares no such moment fades where it stands.
 */
function waitFor(turn: number, alternate: boolean, from: number, shares: number[]): number {
  if (shares.length === 0) return 0
  const step = 1
  const cycle = turn * (alternate ? 2 : 1)
  for (let waited = 0; waited <= cycle; waited += step) {
    const share = shareAt(turn, alternate, from + waited)
    if (shares.some((one) => Math.abs(share - one) <= step / turn)) return waited
  }
  throw new Error(`chat-wait: a loader motion never reaches ${shares.join('/')} (chat-wait.css)`)
}

/**
 * Fade one dot in or out over one of its own legs, from the moment its motion
 * next reaches the pose that fade belongs to.
 *
 * @param dot - the dot to fade.
 * @param ease - the token its curve is read from: a dot gathering speed away
 *     from a turning point is the one slowing into it, taken the other way.
 * @param lane - what its lane declares about its own motion.
 * @param leaving - whether this dot is on its way out.
 * @returns the fade, so a caller can wait for it or let it go.
 */
function fadeDot(dot: Element, ease: '--dsh-claude-ease-damped-in' | '--dsh-claude-ease-damped-out', lane: LaneTiming, leaving: boolean): Animation {
  const motion = dot.getAnimations().find((one) => one instanceof CSSAnimation)
  const effect = motion === undefined ? null : motion.effect
  const time = motion === undefined ? null : motion.currentTime
  if (motion === undefined || effect === null || time === null) {
    throw new Error('chat-wait: a loader dot carries no motion to hand over (chat-wait.css)')
  }
  const timing = effect.getTiming()
  const turn = typeof timing.duration === 'number' ? timing.duration : 0
  if (turn <= 0) throw new Error('chat-wait: a loader motion has no turn to fade over (chat-wait.css)')
  const alternate = timing.direction === 'alternate'
  // The motion's own clock: its delay is the phase it was handed, negative.
  const active = Number(time) - Number(timing.delay ?? 0)
  return dot.animate(
    leaving ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }],
    {
      duration: turn * lane.fade,
      delay: waitFor(turn, alternate, active, leaving ? lane.leaves : lane.arrives),
      easing: motionEase(ease),
      // Held at both ends: a dot stays at the pose it stands at until its own
      // moment comes, and keeps the value it reached afterwards.
      fill: 'both',
      id: FADE,
    },
  )
}

/** Let go of the fades a hand-over left on the loader. */
function dropFades(loader: HTMLElement) {
  for (const dot of loader.querySelectorAll(`.${DOT}`)) {
    for (const one of dot.getAnimations()) if (one.id === FADE) one.cancel()
  }
}

/** The curve each lane's fades run on, read from the token sheet (D9). */
function easesOf(motion: WaitLoaderMotion, leaving: boolean): '--dsh-claude-ease-damped-in' | '--dsh-claude-ease-damped-out' {
  if (motion === 'bounce') return leaving ? '--dsh-claude-ease-damped-out' : '--dsh-claude-ease-damped-in'
  return leaving ? '--dsh-claude-ease-damped-in' : '--dsh-claude-ease-damped-out'
}

/**
 * Hand the loader over: the lane leaving fades its dots out where its own motion
 * turns back, the lane arriving fades its dots in where its own motion carries
 * them, and the two cross.
 *
 * @param from - the lane in play, or null for the opening motion, which has no
 *     lane to leave.
 */
function handOver(loader: HTMLElement, state: LoaderState, from: WaitLoaderMotion | null, to: WaitLoaderMotion) {
  const arriving = laneOf(loader, to)
  dropFades(loader)
  // The lane arriving comes back into the page before anything is timed against
  // it, which is also what starts its motion from the top — and so every dot's
  // own moment below is a known way off.
  place(loader, to, from)
  const arrivingTiming = timingOf(arriving)
  for (const dot of dotsOf(loader, to)) fadeDot(dot, easesOf(to, false), arrivingTiming, false)
  if (from !== null) {
    const leaving = laneOf(loader, from)
    const leavingTiming = timingOf(leaving)
    const fades = dotsOf(loader, from).map((dot) => fadeDot(dot, easesOf(from, true), leavingTiming, true))
    // The lane leaving stays in the page until its last dot has gone, then steps
    // out of it, which is what stops a motion nothing draws. A hand-over that has
    // since taken this lane back owns it, so the step out is skipped then.
    void Promise.allSettled(fades.map((one) => one.finished)).then(() => {
      if (!loader.isConnected || state.motion !== from) return
      const lane = laneOf(loader, from)
      lane.classList.remove(LEAVING)
      lane.classList.add(RESTING)
    })
  }
  state.motion = to
}

/** Pick the motion that follows the one in play: any of the others, at random. */
function nextMotion(motion: WaitLoaderMotion): WaitLoaderMotion {
  const others = LANES.filter((one) => one.motion !== motion)
  return others[Math.floor(Math.random() * others.length)].motion
}

/** Arm the rotation: when it runs out, one of the other motions takes over. */
function rotate(loader: HTMLElement, state: LoaderState) {
  if (state.timer !== null) window.clearTimeout(state.timer)
  const period = motionMs('--dsh-claude-period-dot-rotate')
  state.timer = window.setTimeout(() => {
    state.timer = null
    if (!loader.isConnected) return
    handOver(loader, state, state.motion, nextMotion(state.motion))
    rotate(loader, state)
  }, period)
}

/**
 * Set one loader going: one of its motions at random at once, then a new one
 * every `--dsh-claude-period-dot-rotate`, never the one already standing.
 *
 * @param loader - the loader leading the line.
 */
export function startWaitLoader(loader: HTMLElement) {
  if (loaders.has(loader)) return
  const opening = LANES[Math.floor(Math.random() * LANES.length)].motion
  const state: LoaderState = { motion: opening, timer: null }
  loaders.set(loader, state)
  handOver(loader, state, null, opening)
  // Under the Reduced choice the loader holds one frame and never takes another
  // up: a rotation would be a visible jump with nothing moving the dots.
  if (!motionReduced()) rotate(loader, state)
}

/** Let go of one loader: a row leaving the page takes no timer with it. */
export function releaseWaitLoader(loader: HTMLElement) {
  const state = loaders.get(loader)
  if (state === undefined) return
  if (state.timer !== null) window.clearTimeout(state.timer)
  loaders.delete(loader)
}
