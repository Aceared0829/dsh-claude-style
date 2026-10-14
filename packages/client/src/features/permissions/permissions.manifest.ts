import { COMPOSER_SCOPE_ALL, COMPOSER_SCOPE_CONVERSATION, COMPOSER_SCOPE_HERO } from '../../constants'
import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'permissions',
  order: 60,
  reads: ['composer'],
  contracts: ['composer.access-trigger', 'composer.card'],
  pref: 'permissionsControl',
  stylesheets: [{ file: 'permissions.css', rank: 230 }],
  switchRow: {
    tab: 'composer',
    rank: 50,
    title: { key: 'permissionsTitle', fallback: 'Redraw the permission control' },
    desc: { key: 'permissionsDesc', fallback: 'Use the skin\'s own permission control; Off restores the host\'s permission menu.' },
    // The segments are drawn into the restyled composer.
    requires: {
      pref: 'composerScope',
      values: [COMPOSER_SCOPE_HERO, COMPOSER_SCOPE_CONVERSATION, COMPOSER_SCOPE_ALL],
      note: { key: 'composerRequired', fallback: 'No effect while Composer restyle is Off.' },
    },
  },
  cases: ['permissions', 'permissions-locale', 'automode', 'automode-current', 'automode-hero', 'automode-roundtrip', 'no-auto-review', 'sync-fault', 'switches', 'switches-off'],
  description: {
    zh: {
      title: '权限控件',
      text: '输入区的权限菜单在经典首页换成一排分段按钮，工作台首页与对话页是一枚按钮加一张档位卡片，与输入区其余选择器同一形制；档位以宿主的目录为准，别的插件加的档位也在里面；新会话页上显示新会话会用的那一档。',
    },
    en: {
      title: 'Permission control',
      text: 'The composer\'s permission menu becomes a row of segments on the classic home; the studio home and conversations carry one trigger with its tier card, shaped like the composer\'s other pickers. The presets are the host\'s own catalog, a plugin\'s preset included; the new-conversation page shows the one a new session will start in.',
    },
  },
} satisfies FeatureManifest
