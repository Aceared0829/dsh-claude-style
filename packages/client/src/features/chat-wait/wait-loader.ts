import { motionReduced } from '../../core/prefs'
import { motionMs } from '../../shared/motion'

/**
 * The waiting line's loader has two motions, and the state machine that carries
 * its dots from one to the other (chat-wait.css reads the classes written
 * here). While the turn is thinking — the model's own clause, or a state
 * nothing can be read from — the three dots bounce the way the snippet has
 * them; while the turn writes or works they walk their own lines instead, three
 * lines 120° apart with one edge turned (chat-wait.css).
 *
 * A change is never a cut, and no dot waits its turn: the motion standing is
 * taken off the dots, each one travels from the pose it stood in to its own
 * place in the next motion — the opening frame that motion would have given it
 * — and the motion then picks up exactly there. That travel is
 * `--dsh-claude-duration-dot-handover`; under the Reduced animation choice the
 * change lands at once, the way every other motion on this skin does (D26).
 */

/** The motion the loader's dots play. */
export type WaitLoaderMotion = 'bounce' | 'line'

/** The class the stylesheet reads for one motion. */
const CLASSES: Record<WaitLoaderMotion, string> = {
  bounce: 'is-bounce',
  line: 'is-line',
}

/**
 * The class whose table in the stylesheet holds where each dot stands the
 * moment that motion takes over. The stylesheet owns those poses: they are the
 * motions' own opening frames, written once beside the keyframes.
 */
const ARRIVING: Record<WaitLoaderMotion, string> = {
  bounce: 'is-arriving-bounce',
  line: 'is-arriving-line',
}

/** Both motion classes, for the removals below. */
const MOTIONS = [CLASSES.bounce, CLASSES.line]
/** Both arriving classes, for the removals below. */
const ARRIVALS = [ARRIVING.bounce, ARRIVING.line]

/** The motion standing on one loader, and the travel on its way. */
const loaders = new WeakMap<HTMLElement, { motion: WaitLoaderMotion | null, timer: number | null }>()

/** Put one motion on the dots now: no travel, no timer left behind. */
function apply(loader: HTMLElement, motion: WaitLoaderMotion) {
  loader.classList.remove(...ARRIVALS, ...MOTIONS)
  loader.classList.add(CLASSES[motion])
}

/**
 * Carry one loader's dots to the motion the turn is in.
 *
 * @param loader - the loader leading the line.
 * @param motion - `bounce` while the turn is thinking, `line` while it writes
 *     or works.
 */
export function setWaitLoaderMotion(loader: HTMLElement, motion: WaitLoaderMotion) {
  let state = loaders.get(loader)
  if (state === undefined) {
    state = { motion: null, timer: null }
    loaders.set(loader, state)
  }
  if (state.motion === motion) return
  const first = state.motion === null
  state.motion = motion
  if (state.timer !== null) {
    window.clearTimeout(state.timer)
    state.timer = null
  }
  // The line is built and handed its first motion in one pass, before anything
  // is painted: there is no pose standing to carry over, so the first motion
  // simply starts (its own opening frame is the first frame a reader sees).
  if (first || motionReduced()) {
    apply(loader, motion)
    return
  }
  // The travel: the motion standing goes off the dots and the arriving table of
  // the next one comes on in the same task, so the stylesheet's transition
  // carries each dot from the pose it stood in (the running animation's own
  // value, which the browser still holds as this task's starting style) to its
  // place in the next motion.
  loader.classList.remove(...MOTIONS)
  loader.classList.add(ARRIVING[motion])
  state.timer = window.setTimeout(() => {
    state.timer = null
    if (loader.isConnected) apply(loader, motion)
  }, motionMs('--dsh-claude-duration-dot-handover'))
}

/** Let go of one loader: a row leaving the page takes no timer with it. */
export function releaseWaitLoader(loader: HTMLElement) {
  const state = loaders.get(loader)
  if (state === undefined) return
  if (state.timer !== null) window.clearTimeout(state.timer)
  loaders.delete(loader)
}
