import { CARET_MOTION_TYPING } from '../../constants'
import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'caret',
  order: 240,
  contracts: ['composer.input', 'composer.textarea'],
  pref: 'caretMotion',
  prefValues: [CARET_MOTION_TYPING],
  yieldsTo: 'dsh-chat-ux',
  stylesheets: [{ file: 'caret.css', rank: 220 }],
  settingsRows: [{
    tab: 'motion',
    rank: 20,
    pref: 'caretMotion',
    title: 'caretTitle',
    control: 'caret-preview',
    stillWhenReduced: true,
  }],
  cases: ['caret']
} satisfies FeatureManifest
