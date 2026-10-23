import { COMPOSER_SCOPE_ALL, COMPOSER_SCOPE_CONVERSATION, STATS_POSITION_CONTEXT, STATS_POSITION_FOOTER, STATS_POSITION_INLINE } from '../../constants'
import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'contextStats',
  order: 70,
  load: 'deferred',
  contracts: ['chat.call', 'chat.call-tool', 'chat.call-tool-attribute', 'chat.streaming', 'composer.dialog-trigger', 'composer.meter-fill', 'composer.stat', 'composer.stats', 'composer.stack'],
  // The ring of the same directory draws the row's reading, and the panel this
  // feature owns hangs from it (features/context-stats/meter-ring.ts).
  reads: ['meterRing'],
  pref: 'statsPosition',
  // The panel carries the full reading in every position.
  prefValues: [STATS_POSITION_INLINE, STATS_POSITION_CONTEXT, STATS_POSITION_FOOTER],
  stylesheets: [{ file: 'footer-layout.css', rank: 106, gate: true }],
  settingsRows: [{
    tab: 'composer',
    // The two figures' rows stand with the composer's other billing display,
    // under the group's peak-rate row (peakrate.manifest.ts, rank 45).
    rank: 46,
    pref: 'statsPosition',
    title: 'statsPositionTitle',
    choiceLabels: {
      [STATS_POSITION_INLINE]: 'statsPositionInline',
      [STATS_POSITION_CONTEXT]: 'statsPositionContext',
      [STATS_POSITION_FOOTER]: 'statsPositionFooter',
    },
    // The figures hang off the meter the composer restyle stamps, and a
    // session's figures only exist in the conversation.
    requires: {
      pref: 'composerScope',
      values: [COMPOSER_SCOPE_CONVERSATION, COMPOSER_SCOPE_ALL],
      note: 'conversationComposerNote',
    },
  }, {
    tab: 'composer',
    rank: 48,
    pref: 'statsFooterAlign',
    parent: 'statsPosition',
    title: 'statsFooterAlignTitle',
    choiceLabels: { left: 'statsFooterAlignLeft', center: 'statsFooterAlignCenter', right: 'statsFooterAlignRight' },
    requires: {
      pref: 'statsPosition',
      values: [STATS_POSITION_FOOTER],
      note: 'statsFooterAlignRequired',
    },
  }, {
    tab: 'composer',
    rank: 47,
    pref: 'billingCurrency',
    title: 'billingCurrencyTitle',
    desc: 'billingCurrencyDesc',
    choiceLabels: { off: 'billingCurrencyOff', CNY: 'billingCurrencyCny', USD: 'billingCurrencyUsd' },
    requires: {
      pref: 'composerScope',
      values: [COMPOSER_SCOPE_CONVERSATION, COMPOSER_SCOPE_ALL],
      note: 'conversationComposerNote',
    },
  }],
  cases: ['context-stats', 'stats-compact', 'stats-inline']
} satisfies FeatureManifest
