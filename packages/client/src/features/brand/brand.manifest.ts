import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'brand',
  order: 15,
  contracts: [],
  ungated: '只画读者自己提供的品牌名、标志图与主色；什么都没提供时页面与所选品牌一致',
  stylesheets: [{ file: 'brand.css', rank: 115 }],
  cases: ['custom-brand'],
  description: {
    zh: {
      title: '自定义品牌',
      text: '在所选品牌之上换上你自己的品牌名、标志图与文字标志，侧栏顶部、折叠栏、新会话页与账号行的兜底头像都跟着换；图可以保留原色，也可以按文字颜色着色。另可指定一个主色，按钮、选中标记、链接与焦点环随之变色。',
    },
    en: {
      title: 'Custom brand',
      text: 'Puts your own brand name, mark and wordmark over the chosen brand: the top of the sidebar, the collapsed rail, the new-conversation page and the account row\'s fallback picture all take them, with the images in their own colours or inked in the text colour. An accent colour of your own can recolour buttons, selected marks, links and focus rings.',
    },
  },
} satisfies FeatureManifest
