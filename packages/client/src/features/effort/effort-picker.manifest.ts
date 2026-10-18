import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'effort',
  order: 90,
  reads: ['model'],
  contracts: [],
  pref: 'modelPicker',
  stylesheets: [{ file: 'effort-picker.css', rank: 270 }],
  cases: []
} satisfies FeatureManifest
