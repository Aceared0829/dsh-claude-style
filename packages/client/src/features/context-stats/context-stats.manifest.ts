import { COMPOSER_SCOPE_ALL, COMPOSER_SCOPE_CONVERSATION, STATS_POSITION_CONTEXT, STATS_POSITION_INLINE } from '../../constants'
import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'contextStats',
  order: 70,
  load: 'deferred',
  contracts: ['chat.call', 'chat.streaming', 'composer.dialog-trigger', 'composer.meter-fill', 'composer.stat', 'composer.stats'],
  pref: 'statsPosition',
  // Both positions are this feature's: the line of its own is what the inline
  // one adds, since the panel the meter owns carries the rows either way.
  prefValues: [STATS_POSITION_INLINE, STATS_POSITION_CONTEXT],
  stylesheets: [],
  settingsRows: [{
    tab: 'conversation',
    rank: 35,
    pref: 'statsPosition',
    title: 'statsPositionTitle',
    choiceLabels: {
      [STATS_POSITION_INLINE]: 'statsPositionInline',
      [STATS_POSITION_CONTEXT]: 'statsPositionContext',
    },
    // The figures hang off the meter the composer restyle stamps, and a
    // session's figures only exist in the conversation.
    requires: {
      pref: 'composerScope',
      values: [COMPOSER_SCOPE_CONVERSATION, COMPOSER_SCOPE_ALL],
      note: 'statsComposerRequired',
    },
  }, {
    tab: 'conversation',
    rank: 36,
    pref: 'billingCurrency',
    title: 'billingCurrencyTitle',
    desc: 'billingCurrencyDesc',
    choiceLabels: { CNY: 'billingCurrencyCny', USD: 'billingCurrencyUsd' },
    requires: {
      pref: 'composerScope',
      values: [COMPOSER_SCOPE_CONVERSATION, COMPOSER_SCOPE_ALL],
      note: 'statsComposerRequired',
    },
  }],
  cases: ['context-stats', 'stats-compact', 'stats-inline']
} satisfies FeatureManifest
