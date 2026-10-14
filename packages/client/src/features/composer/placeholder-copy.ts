import { findComposerInput, findComposerPlaceholder } from '../../core/host'
import type { MatchList } from '../../core/bus'

/** The hero composer's own hint, which the skin's placeholder stands in for. */
const HERO_HINT = 'How can I help you today?'
/** The conversation composer's hint, which the same placeholder settles on. */
const DEFAULT_HINT = 'Type / for commands'
/** The mark that tells the skin's own placeholder from the host's (its teardown swears by it). */
const SYNTHETIC_ATTR = 'data-dsh-synthetic-placeholder'

/** Shipped idle composer hints (zh / en, hero / default) this skin replaces. */
const HINT_SOURCES = [
  '描述你想要构建的内容',
  '发消息或创建任务',
  'Describe what you want to build',
  'Message or run a task',
  HERO_HINT,
  DEFAULT_HINT,
]

/**
 * The composer's idle hint, in the skin's own words.
 *
 * The host draws its placeholder inside the draft editor, and the editor's
 * markup is rebuilt as the card changes form, so the hint is written on
 * every pass and after every input rather than once. The attachment form
 * draws no placeholder of its own, so the skin adds one
 * (`data-dsh-synthetic-placeholder`) and takes it away again when the draft
 * has text; the teardown removes whatever it left.
 *
 * @param cards - the composer cards, kept current by the bus (D40).
 * @param placeholders - the placeholders those cards carry, from the same source.
 */
export function createPlaceholderCopy(cards: MatchList<HTMLElement>, placeholders: MatchList<HTMLElement>) {
  /** Whether a placeholder's text is one of the hints this skin replaces. */
  function isShippedHint(text: string) {
    for (let j = 0; j < HINT_SOURCES.length; j++) {
      if (text.indexOf(HINT_SOURCES[j]) === 0) return true
    }
    return false
  }

  function rewriteHint(hero: boolean, active: boolean) {
    if (!active) return
    const targetHint = hero ? HERO_HINT : DEFAULT_HINT
    const hints = placeholders.all()
    for (let i = 0; i < hints.length; i++) {
      const node = hints[i]
      const text = node.textContent || ''
      if (isShippedHint(text) && text !== targetHint) node.textContent = targetHint
    }
  }

  function syncAttachmentPlaceholder(hero: boolean, active: boolean) {
    if (!active) {
      // The synthetic ones are ordinary placeholders too, so the registry in
      // hand names exactly what this sweep used to query the document for.
      for (const node of placeholders.all()) {
        if (node.hasAttribute(SYNTHETIC_ATTR)) node.remove()
      }
      return
    }
    const targetHint = hero ? HERO_HINT : DEFAULT_HINT
    const found = cards.all()
    for (let ci = 0; ci < found.length; ci++) {
      const card = found[ci]
      const input = findComposerInput(card)
      if (!input) continue
      const text = (input.textContent || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
      const isEmpty = text.length === 0
      let placeholder = findComposerPlaceholder(card)
      const grow = input.closest ? input.closest('[class*="_grow"]') : input.parentElement

      if (isEmpty) {
        if (!placeholder && grow) {
          placeholder = document.createElement('div')
          placeholder.setAttribute('data-composer-placeholder', '')
          placeholder.setAttribute(SYNTHETIC_ATTR, 'true')
          placeholder.textContent = targetHint
          grow.appendChild(placeholder)
        } else if (placeholder) {
          if (placeholder.style.display === 'none') placeholder.style.display = ''
          const curText = placeholder.textContent || ''
          if (isShippedHint(curText) && curText !== targetHint) placeholder.textContent = targetHint
        }
      } else {
        if (placeholder && placeholder.hasAttribute(SYNTHETIC_ATTR)) {
          if (placeholder.parentElement) placeholder.parentElement.removeChild(placeholder)
        }
      }
    }
  }

  return {
    /**
     * One pass: the visible hint follows the page (hero or conversation).
     * The restyle's off branch is what takes the skin's placeholders away
     * again, so this runs whether or not the restyle applies.
     */
    sync(hero: boolean, active: boolean) {
      rewriteHint(hero, active)
      syncAttachmentPlaceholder(hero, active)
    },
    /** A composer input or composition event: only the synthetic placeholder can have changed. */
    onInput(hero: boolean, active: boolean) {
      syncAttachmentPlaceholder(hero, active)
    },
    /** The placeholders the skin added stand in for the host's own, so they leave with it. */
    dispose() {
      for (const node of placeholders.all()) {
        if (node.hasAttribute(SYNTHETIC_ATTR)) node.remove()
      }
    },
  }
}
