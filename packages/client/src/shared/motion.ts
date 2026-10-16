import { MOTION } from 'virtual:dsh-claude-style/generated'

/**
 * The motion tokens as the browser half reads them (D9): the values come from
 * packages/client/src/theme/tokens.json through a generated module, so a
 * duration or a curve written here and one written in a stylesheet cannot
 * drift. A name the token table does not carry throws where it is read — a
 * misspelt name is a bug, not a fallback (D12).
 *
 * Timers that wait for something other than an animation (a poll interval, a
 * grace period since the last mutation) are not motion and are declared beside
 * the feature that keeps them.
 */

/** The value a motion token stands for. */
export function motionValue(token: string): string {
  const value = MOTION[token]
  if (value === undefined) throw new Error(`shared/motion: the token table carries no ${token}`)
  return value
}

/** A motion token as a number of milliseconds, for `duration` and `setTimeout`. */
export function motionMs(token: string): number {
  const value = motionValue(token).trim()
  const match = /^([\d.]+)(ms|s)$/.exec(value)
  if (match === null) throw new Error(`shared/motion: ${token} is "${value}", not a duration`)
  return match[2] === 's' ? Number(match[1]) * 1000 : Number(match[1])
}

/** A motion token as an easing curve, for `easing`. */
export function motionEase(token: string): string {
  const value = motionValue(token)
  if (!value.startsWith('cubic-bezier(') && !['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear'].includes(value)) {
    throw new Error(`shared/motion: ${token} is "${value}", not an easing curve`)
  }
  return value
}
