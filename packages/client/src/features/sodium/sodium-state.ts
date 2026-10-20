import { notifyAll } from '@dsh-claude-style/engine/notify'

/**
 * The rules the sodium rewrite holds right now (D78), for the settings row:
 * the page's live answer, read whether the settings page is open or not.
 */
export interface RuleInEffect {
  /** The member the rule belongs to, and the lowest release its shape was checked on. */
  readonly member: string
  readonly since: string
  /** The sheet's path in its package, as the loader tags it. */
  readonly sheet: string
  /** The rule's own declarations, which name the rule for a reader. */
  readonly declarations: string
}

let current: readonly RuleInEffect[] = []
const listeners: (() => void)[] = []

/** The rules in effect; the same array until they change. */
export function rulesInEffect() {
  return current
}

export function publishRules(next: readonly RuleInEffect[]) {
  current = next
  notifyAll(listeners)
}

/** Hear the rules change; returns the unsubscriber. */
export function subscribeRules(listener: () => void) {
  listeners.push(listener)
  return () => {
    const at = listeners.indexOf(listener)
    if (at !== -1) listeners.splice(at, 1)
  }
}
