import { COMPOSER_SCOPE_ALL, COMPOSER_SCOPE_CONVERSATION, COMPOSER_SCOPE_HERO } from '../../constants'
import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'permissions',
  order: 60,
  reads: ['composer'],
  contracts: ['composer.access-trigger', 'composer.card'],
  pref: 'permissionsControl',
  stylesheets: [{ file: 'permissions.css', rank: 230 }],
  settingsRows: [{
    tab: 'composer',
    rank: 50,
    pref: 'permissionsControl',
    title: 'permissionsTitle',
    desc: 'permissionsDesc',
    // The segments are drawn into the restyled composer.
    requires: {
      pref: 'composerScope',
      values: [COMPOSER_SCOPE_HERO, COMPOSER_SCOPE_CONVERSATION, COMPOSER_SCOPE_ALL],
      note: 'composerRequired',
    },
  }],
  cases: ['permissions', 'permissions-locale', 'automode', 'automode-current', 'automode-hero', 'automode-roundtrip', 'no-auto-review', 'sync-fault', 'switches', 'switches-off']
} satisfies FeatureManifest
