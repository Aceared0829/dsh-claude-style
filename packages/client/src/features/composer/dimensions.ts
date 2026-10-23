import { COMPOSER_STACK } from '@dsh-claude-style/engine/host'
import type { Prefs } from '../../constants'

export const COMPOSER_DIMENSIONS = {
  composerWidth: { min: 480, max: 1600, step: 10, fallback: 730 },
  composerBottomGap: { min: 0, max: 80, step: 1, fallback: 16 },
} as const

type Dimension = keyof typeof COMPOSER_DIMENSIONS
type SavedStyle = { value: string, priority: string }

export function composerDimensionPixels(prefs: Prefs, key: Dimension) {
  const text = prefs[key].trim()
  const value = Number(text)
  const { min, max } = COMPOSER_DIMENSIONS[key]
  return text === '' || !Number.isFinite(value) || value < min
    ? null : Math.min(max, Math.round(value))
}

/** Keep each host declaration so reset, scope changes and teardown restore it. */
export function createComposerDimensions() {
  const saved = new Map<HTMLElement, Map<string, SavedStyle>>()

  function write(stack: HTMLElement, name: string, value: string | null) {
    let styles = saved.get(stack)
    if (value === null) {
      const before = styles?.get(name)
      if (before === undefined) return
      if (before.value === '') stack.style.removeProperty(name)
      else stack.style.setProperty(name, before.value, before.priority)
      styles!.delete(name)
      if (styles!.size === 0) saved.delete(stack)
      return
    }
    if (styles === undefined) {
      styles = new Map()
      saved.set(stack, styles)
    }
    if (!styles.has(name)) styles.set(name, {
      value: stack.style.getPropertyValue(name),
      priority: stack.style.getPropertyPriority(name),
    })
    if (stack.style.getPropertyValue(name) !== value) stack.style.setProperty(name, value)
  }

  function clearStack(stack: HTMLElement) {
    for (const name of [...(saved.get(stack)?.keys() ?? [])]) write(stack, name, null)
  }

  function sync(cards: readonly HTMLElement[], prefs: Prefs, active: boolean) {
    const stacks = new Set(active
      ? cards.map(card => card.closest<HTMLElement>(COMPOSER_STACK)).filter((stack): stack is HTMLElement => stack !== null)
      : [])
    for (const stack of saved.keys()) if (!stacks.has(stack)) clearStack(stack)
    const width = composerDimensionPixels(prefs, 'composerWidth')
    const gap = composerDimensionPixels(prefs, 'composerBottomGap')
    for (const stack of stacks) {
      write(stack, '--dsh-composer-card-max-width', width === null ? null : width + 'px')
      // CSS resolves the available room at every viewport or panel resize.
      // The host owns the card's two side clearances inside this outer box.
      write(stack, 'max-width', width === null ? null : `min(100%, calc(${width}px + 2 * var(--dsh-composer-side-clearance, 16px)))`)
      write(stack, 'width', width === null ? null : '100%')
      write(stack, 'margin-left', width === null ? null : 'auto')
      write(stack, 'margin-right', width === null ? null : 'auto')
      write(stack, 'padding-bottom', gap === null ? null : gap + 'px')
    }
  }

  return { sync, clear() { for (const stack of saved.keys()) clearStack(stack) } }
}
