import { COMPOSER_SCOPE_ALL, COMPOSER_SCOPE_CONVERSATION, COMPOSER_SCOPE_HERO } from '../../constants'
import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'composer',
  order: 20,
  contracts: ['chat.scroller', 'composer.attachment-rail', 'composer.dialog-trigger', 'composer.input', 'composer.mobile-portrait', 'composer.placeholder', 'composer.placeholder-attribute', 'composer.seat', 'composer.stack', 'composer.variant', 'header.conversation-tabs', 'shell.phase'],
  pref: 'composerScope',
  prefValues: [COMPOSER_SCOPE_HERO, COMPOSER_SCOPE_CONVERSATION, COMPOSER_SCOPE_ALL],
  stylesheets: [
    { file: 'vars.css', rank: 78 },
    { file: 'card.css', rank: 80, gate: true },
    { file: 'inline.css', rank: 90, gate: true },
    { file: 'inline-bar.css', rank: 100, gate: true },
    { file: 'dimensions-settings.css', rank: 101 },
  ],
  settingsRows: [{
    tab: 'composer',
    rank: 10,
    pref: 'composerScope',
    title: 'composerTitle',
    choiceLabels: { off: 'scopeOff', hero: 'scopeHero', conversation: 'scopeConversation', all: 'scopeAll' },
  }, {
    tab: 'composer',
    rank: 50,
    pref: 'composerWidth',
    parent: 'composerScope',
    title: 'composerWidthTitle',
    desc: 'composerWidthDesc',
    control: 'width',
  }, {
    tab: 'composer',
    rank: 51,
    pref: 'composerBottomGap',
    parent: 'composerScope',
    title: 'composerBottomGapTitle',
    desc: 'composerBottomGapDesc',
    control: 'bottom-gap',
  }],
  cases: ['composer', 'sync-fault', 'hero', 'late-forms']
} satisfies FeatureManifest
