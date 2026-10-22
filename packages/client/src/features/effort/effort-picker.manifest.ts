import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'effort',
  order: 90,
  reads: ['model'],
  contracts: [],
  pref: 'modelPicker',
  stylesheets: [{ file: 'effort-picker.css', rank: 270 }],
  settingsRows: [{
    // The colour speaks on the picker's own trigger, so the row stands under the
    // picker that draws it and goes with that switch (D72).
    tab: 'composer',
    rank: 37,
    pref: 'effortAccent',
    parent: 'modelPicker',
    title: 'effortAccentTitle',
    desc: 'effortAccentDesc',
  }],
  cases: []
} satisfies FeatureManifest
