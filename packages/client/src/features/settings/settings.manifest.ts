import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'settings',
  handle: 'settingsNav',
  order: 260,
  load: 'deferred',
  reads: ['quickProviders'],
  contracts: ['shell.windows-titlebar'],
  ungated: '设置页本身',
  stylesheets: [{ file: 'settings.css', rank: 310 }],
  cases: ['settings', 'late-forms', 'skin-center-handoff', 'skin-center-arrival'],
  description: {
    zh: {
      title: '设置页',
      text: '设置页同时出现在设置对话框（「Claude Style」标签页）与插件页，分为通用、外观、输入区、侧栏、对话、桌面端、动效七个分页；每一项接管宿主界面的功能都有自己的开关，关闭后宿主原来的界面原样回来，不需要刷新页面。只在另一项打开时才起作用的设置，在那一项关闭时变灰并写明原因。切换分页时，新的一页从它在分页条上所在的一侧滑入、穿过一点模糊，被换下的那一页朝另一侧滑出（约 0.25 秒）；按下开关时圆钮越过终点再弹回（约 0.35 秒），打开页面时各个开关都静止在原位。设置对话框里这一页的标题行右端是插件仓库的入口。',
    },
    en: {
      title: 'Settings page',
      text: 'The settings page appears both in the settings dialog (the "Claude Style" tab) and on the plugin page, in seven tabs: General, Appearance, Composer, Sidebar, Conversation, Desktop and Motion. Every feature that takes over part of the host\'s interface has its own switch; turning it off brings the host\'s original back at once, without a reload. A setting that only works while another one is on greys out while that one is off and says why. Changing tabs slides the pages the way the strip reads: the new tab comes in from its side through a short blur while the one it replaces leaves to the other side (about 0.25 s); a pressed switch carries its knob past the end and back (about 0.35 s), and a page that opens shows every switch at rest. In the settings dialog the heading row ends with a link to the plugin\'s repository.',
    },
  },
} satisfies FeatureManifest
