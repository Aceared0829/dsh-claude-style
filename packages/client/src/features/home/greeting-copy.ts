import { HOME_LAYOUT_STUDIO } from '../../constants'
import { getUsername } from '../../shared/identity'
import { readPrefs } from '../../core/prefs'
import { pickHeroGreeting, pickStudioGreeting } from './greetings'

/**
 * The hero headline's greeting: the studio dashboard shows one fixed line,
 * while the classic hero draws from the clock slot's welcomes, renewed each
 * time the page comes back to the hero so a session left and reopened reads
 * a different line.
 */
export function createGreetingCopy() {
  /** The classic hero's draw, renewed on every return to the hero page. */
  let draw = Math.random()
  let wasHero = false

  return {
    /** One pass: the headline reads the greeting the layout and the clock pick. */
    sync(hero: boolean) {
      if (hero && !wasHero) draw = Math.random()
      wasHero = hero
      const greeting = readPrefs().homeLayout === HOME_LAYOUT_STUDIO
        ? pickStudioGreeting(getUsername())
        : pickHeroGreeting(getUsername(), draw)
      // The host renders one title group per hero variant; the first span of
      // each is the greeting (a preview badge may sit before it).
      const groups = document.querySelectorAll('[data-dsh-claude-part~="hero-title-group"]')
      for (let i = 0; i < groups.length; i++) {
        const spans = groups[i].children
        for (let j = 0; j < spans.length; j++) {
          const span = spans[j]
          const cls = span.getAttribute('class') || ''
          if (cls.includes('previewBadge')) continue
          if (span.textContent !== greeting) span.textContent = greeting
          break
        }
      }
    },
  }
}
