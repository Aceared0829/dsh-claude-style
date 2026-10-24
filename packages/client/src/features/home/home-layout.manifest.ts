import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'homeLayout',
  order: 30,
  contracts: ['composer.stack', 'shell.phase'],
  ungated: '两种首页布局都由这个常驻功能读取并切换，功能本身在两种布局下都要在场；设置行照旧更换布局',
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
    choiceLabels: { classic: 'homeClassic', studio: 'homeStudio' },
  }],
  cases: ['hero', 'studio', 'late-forms', 'hdsl', 'hdsl-noskin', 'hdsl-broken']
} satisfies FeatureManifest
