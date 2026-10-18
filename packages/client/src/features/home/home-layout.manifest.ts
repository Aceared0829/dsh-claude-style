import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'homeLayout',
  order: 30,
  contracts: ['composer.stack', 'shell.phase'],
  pref: 'homeLayout',
  stylesheets: [
    { file: 'home-panel.css', rank: 320 },
    { file: 'home-overview.css', rank: 330 },
    { generated: 'heat-levels', rank: 335 },
    { file: 'home-models.css', rank: 340 },
  ],
  settingsRows: [{
    tab: 'appearance',
    rank: 25,
    pref: 'homeLayout',
    title: 'homeTitle',
    desc: 'homeDesc',
    choiceLabels: { classic: 'homeClassic', studio: 'homeStudio' },
  }],
  cases: ['hero', 'studio', 'late-forms', 'hdsl', 'hdsl-noskin', 'hdsl-broken']
} satisfies FeatureManifest
