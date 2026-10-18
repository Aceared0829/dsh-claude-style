import { COMPOSER_SCOPE_ALL, COMPOSER_SCOPE_CONVERSATION, COMPOSER_SCOPE_HERO } from '../../constants'
import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'composer',
  order: 20,
  contracts: ['chat.scroller', 'composer.dialog-trigger', 'composer.input', 'composer.mobile-portrait', 'composer.mobile-stats', 'composer.placeholder', 'composer.seat', 'composer.stack', 'composer.variant', 'shell.phase'],
  pref: 'composerScope',
  prefValues: [COMPOSER_SCOPE_HERO, COMPOSER_SCOPE_CONVERSATION, COMPOSER_SCOPE_ALL],
  stylesheets: [
    { file: 'vars.css', rank: 78 },
    { file: 'card.css', rank: 80, gate: true },
    { file: 'inline.css', rank: 90, gate: true },
    { file: 'inline-bar.css', rank: 100, gate: true },
  ],
  settingsRows: [{
    tab: 'composer',
    rank: 10,
    pref: 'composerScope',
    title: 'composerTitle',
    choiceLabels: { off: 'scopeOff', hero: 'scopeHero', conversation: 'scopeConversation', all: 'scopeAll' },
  }],
  cases: ['composer', 'sync-fault', 'hero', 'late-forms']
} satisfies FeatureManifest
