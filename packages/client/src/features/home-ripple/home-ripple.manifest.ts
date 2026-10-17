import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'homeRipple',
  order: 35,
  contracts: ['shell.dark-theme'],
  pref: 'homeRipple',
  stylesheets: [{ file: 'home-ripple.css', rank: 325 }],
  settingsRows: [{
    tab: 'appearance',
    rank: 26,
    pref: 'homeRipple',
    parent: 'homeLayout',
    title: 'homeRippleTitle',
    desc: 'homeRippleDesc',
    experimental: true,
  }],
  cases: ['hero'],
  description: {
    zh: {
      title: '水波纹字符背景',
      text: '新会话页的背景是一片等宽字体的数字与字母，每秒重绘两次，被缓缓漂移的云层遮住，只在云层稀薄处隐约可见。点击页面任意位置会荡开水波：波速在点击处最快、越远越慢，环越走越细；被波扫过的字符显现出来，波前染成蓝色，尾迹留下灰色并慢慢淡去。设置页「外观」页首页版面下有一个同名开关，默认关闭，标为实验性。',
    },
    en: {
      title: 'Ripple glyph background',
      text: 'The new-conversation page\'s background is a field of digits and letters in the monospace face, redrawn twice a second under a slowly drifting cloud and faintly visible only where the cloud is thin. A press anywhere on the page sends out waves: they travel fastest at the click and slow with distance, so each ring thins as it goes; the characters a wave passes show, blue at its front and grey in its wake, fading away. A switch of the same name under the home layout on the Appearance tab is off until it is turned on, and is marked experimental.',
    },
  },
} satisfies FeatureManifest
