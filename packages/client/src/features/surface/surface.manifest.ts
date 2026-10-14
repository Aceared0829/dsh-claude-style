import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'surface',
  order: 265,
  contracts: ['shell.sidebar-root', 'shell.sidebar-brand', 'shell.sidebar-toggle', 'shell.windows-menu', 'ds-bot.return', 'ds-bot.account', 'ds-bot.account-menu', 'ds-bot.agent-item', 'ds-bot.sidebar-top'],
  ungated: '只在装有 ds-bot 时出现：没有它，宿主只有一种界面，开关无处可切',
  stylesheets: [{ file: 'surface.css', rank: 380, scope: 'surface' }],
  // The stand-in page has no ds-bot; the lane's dsBot scenario walks the switch beside the real one (D66).
  cases: [],
  description: {
    zh: {
      title: '聊天 / 代码切换',
      text: '装着 [ds-bot](https://github.com/Fei2411/DeepSeek-Bot) 时，侧栏顶端多一个和 Claude 桌面端一样的聊天 / 代码切换：聊天是 ds-bot 的 Bot 界面，本主题整个让开，只留下这个切换与设置页；代码是宿主自己的界面，由本主题照常绘制。切换就是 ds-bot 自己的模式切换，两边各自记住的状态都不丢；在 ds-bot 里用它自己的入口切换时，本主题同样跟上。桌面端它待在窗口顶端那一行、侧栏的右端，网页上待在侧栏的第一行。',
    },
    en: {
      title: 'Chat / Code switch',
      text: 'With [ds-bot](https://github.com/Fei2411/DeepSeek-Bot) installed, the top of the sidebar carries a Chat / Code switch like the one in Claude\'s desktop app: Chat is ds-bot\'s Bot surface, and the theme steps aside entirely, leaving only the switch and its settings page; Code is the host\'s own interface, painted by the theme as usual. The switch drives ds-bot\'s own mode change, so neither side loses what it remembers, and switching through ds-bot\'s own controls brings the theme along too. On the desktop it sits in the window\'s top row at the sidebar\'s right end; on the web, in the sidebar\'s first row.',
    },
  },
} satisfies FeatureManifest
