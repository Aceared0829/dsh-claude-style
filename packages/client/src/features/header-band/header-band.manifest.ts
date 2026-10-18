import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'headerBand',
  order: 255,
  contracts: [
    'api.window-controls', 'shell.fullscreen', 'shell.platform', 'shell.top-clearance', 'shell.windows-titlebar', 'shell.windows-menu',
    'shell.rightbar-toggle',
    'header.row', 'header.title', 'header.utilities', 'header.corner', 'header.element', 'header.view-tabs',
  ],
  pref: 'headerBand',
  stylesheets: [{ file: 'header-band.css', rank: 75 }],
  settingsRows: [{
    tab: 'conversation',
    rank: 60,
    pref: 'headerBand',
    title: 'headerBandTitle',
    desc: 'headerBandDesc',
    windowsOnly: true,
  }],
  cases: ['header-band', 'switches'],
  description: {
    zh: {
      title: '会话标题进入顶栏',
      text: '桌面端把会话标题与顶栏一行的控件抬进系统标题栏：放得下时标题靠左、控件靠右，放不下的一侧留在原来的行里，标题行的其余内容顺势左移；右侧栏打开时，收起它的那枚按钮出现在顶栏这一行的右端，面板里原来那一枚让位。',
    },
    en: {
      title: 'Header in the title bar',
      text: 'On the desktop the session title and the header\'s controls rise into the window\'s own caption row: whichever side fits is placed there — the title at the left, the controls at the right — and the rest of the title row closes up to the left. While the right panel is open, the button that collapses it stands at the row\'s right end, and the panel\'s own copy steps aside.',
    },
  },
} satisfies FeatureManifest
