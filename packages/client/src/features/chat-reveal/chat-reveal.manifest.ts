import { CHAT_REVEAL_ON } from '../../constants'
import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'chatReveal',
  order: 210,
  contracts: ['api.highlight', 'api.highlight-constructor', 'chat.streaming', 'chat.streaming-attribute'],
  pref: 'chatReveal',
  prefValues: [CHAT_REVEAL_ON],
  yieldsTo: 'dsh-chat-ux',
  stylesheets: [{ generated: 'reveal-steps', rank: 180 }],
  cases: ['chat-reveal'],
  description: {
    zh: {
      title: '新文字淡入',
      text: '流式回答里新出现的字符先淡后实，并按到达次序略作错开；整段一次到达的内容、几千字的突发与刚被折叠重排过的文字保持本色。设置页的「动效」页有「淡入」与「直接出现」两档，各带一张预览卡，默认「直接出现」。',
    },
    en: {
      title: 'New text fades in',
      text: 'Characters arriving in a streaming answer start faint and settle, staggered slightly by arrival order; a block arriving whole, a burst of thousands of characters and text that just reflowed from a fold stay solid. The Motion tab offers Fade in and Appears at once, each with a preview card, shipped on Appears at once.',
    },
  },
} satisfies FeatureManifest
