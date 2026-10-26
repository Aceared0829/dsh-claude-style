import { CONVERSATION_COMPOSER_REQUIRES, STATS_POSITION_CONTEXT, STATS_POSITION_FOOTER, STATS_POSITION_INLINE } from '../../constants'
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
  stylesheets: [{ file: 'footer-layout.css', rank: 106, gate: true }, { file: 'billing-table.css', rank: 108, gate: true }],
  settingsRows: [{
    tab: 'composer',
    // The meter's face and its number open the statistics rows, after the
    // model picker's block: the face is what the reader looks at, the figures
    // what they read.
    rank: 46,
    pref: 'contextDisplay',
    title: 'contextDisplayTitle',
    desc: 'contextDisplayDesc',
    control: 'context-display',
    requires: CONVERSATION_COMPOSER_REQUIRES,
  }, {
    tab: 'composer',
    rank: 47,
    pref: 'contextNumbers',
    title: 'contextNumbersTitle',
    desc: 'contextNumbersDesc',
    requires: CONVERSATION_COMPOSER_REQUIRES,
  }, {
    tab: 'composer',
    // The figures' rows follow the meter's own, the footer alignment refining
    // the place this row sets.
    rank: 48,
    pref: 'statsPosition',
    title: 'statsPositionTitle',
    choiceLabels: {
      [STATS_POSITION_INLINE]: 'statsPositionInline',
      [STATS_POSITION_CONTEXT]: 'statsPositionContext',
      [STATS_POSITION_FOOTER]: 'statsPositionFooter',
    },
    // The figures hang off the meter the composer restyle stamps, and a
    // session's figures only exist in the conversation.
    requires: CONVERSATION_COMPOSER_REQUIRES,
  }, {
    tab: 'composer',
    rank: 49,
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
    rank: 50,
    pref: 'billingCurrency',
    title: 'billingCurrencyTitle',
    desc: 'billingCurrencyDesc',
    choiceLabels: { off: 'billingCurrencyOff', CNY: 'billingCurrencyCny', USD: 'billingCurrencyUsd' },
    requires: CONVERSATION_COMPOSER_REQUIRES,
  }, {
    tab: 'composer',
    // Directly under the currency: both answer what a session costs, and the
    // table's own unit is that currency.
    rank: 51,
    pref: 'billingTable',
    title: 'billingTableTitle',
    desc: 'billingTableDesc',
    control: 'billing-table',
    requires: CONVERSATION_COMPOSER_REQUIRES,
  }],
  cases: ['context-stats', 'stats-compact', 'stats-inline']
} satisfies FeatureManifest
