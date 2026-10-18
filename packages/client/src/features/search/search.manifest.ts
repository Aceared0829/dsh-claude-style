import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'search',
  order: 160,
  load: 'deferred',
  contracts: ['shell.sidebar-search', 'shell.sidebar-brand'],
  pref: 'sidebarSearch',
  stylesheets: [{ file: 'search.css', rank: 130 }],
  settingsRows: [{
    tab: 'sidebar',
    rank: 20,
    pref: 'sidebarSearch',
    title: 'searchTitle',
    desc: 'searchDesc',
  }, {
    // The box's own style, under the switch that turns the box on.
    tab: 'sidebar',
    rank: 25,
    pref: 'searchStyle',
    parent: 'sidebarSearch',
    title: 'searchStyleTitle',
    desc: 'searchStyleDesc',
    choiceLabels: { icon: 'searchStyleIcon', overlay: 'searchStyleOverlay', standalone: 'searchStyleStandalone' },
  }],
  cases: ['search', 'switches']
} satisfies FeatureManifest
