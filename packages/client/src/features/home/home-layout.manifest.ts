import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'homeLayout',
  order: 30,
  contracts: ['composer.stack', 'shell.phase'],
  pref: 'homeLayout',
  stylesheets: [
    { file: 'home-panel.css', rank: 320 },
    { file: 'home-overview.css', rank: 330 },
    { generated: 'heat-levels', rank: 335 },
    { file: 'home-models.css', rank: 340 },
  ],
  settingsRows: [{
    tab: 'appearance',
    rank: 25,
    pref: 'homeLayout',
    title: 'homeTitle',
    desc: 'homeDesc',
    choiceLabels: { classic: 'homeClassic', studio: 'homeStudio' },
  }],
  cases: ['hero', 'studio', 'late-forms', 'hdsl', 'hdsl-noskin', 'hdsl-broken'],
  description: {
    zh: {
      title: '首页版面',
      text: '「经典」是居中的问候语与输入卡片；「工作室」把问候语移到左上角、输入卡片贴着窗口底边，中间是用量面板：近期的用量热力图、各模型的用量与费用。新会话页的问候语按时段换着说，带上你的名字，每次回到这一页换一句。两种布局里，首页打开时品牌标志先升起、问候语晚一拍跟上，都穿过一点模糊落到原位；用量面板先画出数字的占位，数字算好时占位淡去、数字从模糊里显出来。',
    },
    en: {
      title: 'Home layout',
      text: 'Classic is the centred greeting over the input card. Studio moves the greeting to the top left, pins the input card to the window\'s bottom edge and fills the space between with a usage panel: a heat map of recent usage and the usage and cost of each model. The new-conversation page greets you by name with a line that changes with the time of day, and a different one each time the page comes back. In both layouts, the home page opening raises the brand mark and then, a beat behind, the greeting, each out of a short blur; the usage panel draws placeholders for its figures first, and when the figures are ready the placeholders fade while the figures come out of the blur.',
    },
  },
} satisfies FeatureManifest
