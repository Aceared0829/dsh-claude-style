import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'viewTabs',
  order: 250,
  contracts: ['api.window-controls', 'shell.fullscreen', 'shell.platform', 'shell.top-clearance', 'shell.windows-titlebar'],
  pref: 'viewTabs',
  stylesheets: [{ file: 'view-tabs.css', rank: 60 }],
  settingsRows: [{
    tab: 'conversation',
    rank: 50,
    pref: 'viewTabs',
    title: 'viewTabsTitle',
  }],
  cases: ['view-tabs', 'switches']
} satisfies FeatureManifest
