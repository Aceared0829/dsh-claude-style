import { COMPOSER_SCOPE_ALL, COMPOSER_SCOPE_CONVERSATION, COMPOSER_SCOPE_HERO } from '../../constants'
import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'model',
  order: 80,
  reads: ['composer', 'peakrate'],
  contracts: [],
  pref: 'modelPicker',
  stylesheets: [{ file: 'model-picker.css', rank: 260 }],
  settingsRows: [{
    tab: 'composer',
    rank: 30,
    pref: 'modelPicker',
    title: 'pickerTitle',
    desc: 'pickerDesc',
    // The menu is drawn into the restyled composer.
    requires: {
      pref: 'composerScope',
      values: [COMPOSER_SCOPE_HERO, COMPOSER_SCOPE_CONVERSATION, COMPOSER_SCOPE_ALL],
      note: 'composerRequired',
    },
  }, {
    // The catalog's own description lines, which the picker draws, under it.
    tab: 'composer',
    rank: 35,
    pref: 'modelDescriptions',
    parent: 'modelPicker',
    title: 'modelDescriptionsTitle',
    desc: 'modelDescriptionsDesc',
  }],
  cases: ['brand', 'composer', 'settings', 'sync-fault', 'model-meter']
} satisfies FeatureManifest
