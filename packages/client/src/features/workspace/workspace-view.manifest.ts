import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'workspace',
  order: 150,
  contracts: [],
  pref: 'workspaceView',
  stylesheets: [{ file: 'workspace.css', rank: 120 }],
  settingsRows: [{
    tab: 'sidebar',
    rank: 30,
    pref: 'workspaceView',
    title: 'workspaceTitle',
    desc: 'workspaceDesc',
  }],
  cases: ['switches', 'popovers']
} satisfies FeatureManifest
