import { BAN_LOCALE_EN, BAN_LOCALE_ZH } from '../../constants'
import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'ban',
  order: 130,
  load: 'deferred',
  contracts: ['api.window-controls', 'shell.fullscreen', 'shell.platform', 'shell.top-clearance', 'shell.windows-titlebar'],
  // The page's language is the switch: `off` is the third value of that row,
  // which stands under the footer takeover whose popover holds the account row.
  pref: 'banLocale',
  prefValues: [BAN_LOCALE_EN, BAN_LOCALE_ZH],
  stylesheets: [{ file: 'ban-screen.css', rank: 250 }],
  settingsRows: [{
    tab: 'sidebar',
    rank: 15,
    pref: 'banLocale',
    parent: 'collapseFooter',
    title: 'banLocaleTitle',
    desc: 'banLocaleDesc',
    choiceLabels: { off: 'banLocaleOff', zh: 'banLocaleZh', en: 'banLocaleEn' },
  }],
  cases: ['desktop', 'settings'],
  description: {
    zh: {
      title: '封号彩蛋',
      text: '点账号弹层顶上的账号行，会打开一张仿 Claude「账号已暂停」的整页彩蛋，整页从中心略小处放大淡入；页上的每个按钮和 Esc 都把它关掉，关掉时它缩回去淡出，什么都不会真的发生。设置页「侧栏」里选它的语言或关掉它，关掉后账号行只显示名字。',
    },
    en: {
      title: 'Account-hold easter egg',
      text: 'The account row at the top of the account popover opens a full-page replica of Claude\'s account-hold page, growing out of the centre as it fades in. Every control on it, and Esc, closes it — it shrinks back as it fades — and nothing it names actually happens. The Sidebar tab picks its language or turns it off, leaving the account row a plain name.',
    },
  },
} satisfies FeatureManifest
