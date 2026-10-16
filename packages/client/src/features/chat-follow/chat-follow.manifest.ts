import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'chatFollow',
  order: 190,
  reads: ['chatFold'],
  contracts: ['chat.call', 'chat.flow', 'chat.flow-block', 'chat.following-tail', 'chat.following-tail-attribute', 'chat.phase', 'chat.running', 'chat.scroller', 'chat.shimmer', 'chat.streaming', 'chat.think-row', 'chat.think-running', 'process.body', 'process.content', 'process.expanded-mode'],
  pref: 'chatAnimations',
  yieldsTo: 'dsh-chat-ux',
  stylesheets: [{ file: 'chat-follow.css', rank: 160 }],
  settingsRows: [{
    // The Motion tab's own row: what is left of the chat-area switch after the
    // waiting line and the sent message's entrance took switches of their own.
    tab: 'motion',
    rank: 10,
    pref: 'chatAnimations',
    title: 'chatAnimationsTitle',
    desc: 'chatAnimationsDesc',
  }],
  cases: ['chat-follow'],
  description: {
    zh: {
      title: '聊天区跟随',
      text: '思考行收起、工具调用行出现这些结构时刻，贴着底部的读者被交还给系统自己的跟随，内容成片到达时不再停在离底部几十像素的地方；「标准」与「简洁」档里封顶的过程组（思考与工具输出收在一个带滚动条的组体里）同样补到底部。补到底部走的是曲线：零散到达的字收得住尾巴，成片涌进的文字以一段稳速滑过去，再落到末尾。流式输出期间位置由宿主自己的跟随写到末尾，新长出的内容从屏幕下缘平滑滑上来，上方文字不再一帧跳上去，状态行停在原处不动；这段滑动由显卡完成，不占用页面的布局，多个会话同时输出时也不加重负担。你自己发出的消息不走这条曲线：宿主把它滚进视野的那一下照旧一步到位。读者自己滚动离开底部之后，插件不再插手，直到他自己回到底部。',
    },
    en: {
      title: 'Chat-area follow',
      text: 'At the structural moments — a thinking row folding, a tool call row arriving — a reader sitting at the bottom is handed back to the host\'s own follow, instead of being left tens of pixels short by the burst of content; a process group capped in the Standard and Compact tiers (thinking and tool output kept in one scrolling body) is caught up the same way. Catching up runs on a curve: a trickle of characters settles softly and a burst glides at one steady speed before landing. While content streams, the host\'s own follow keeps the position at the end and the newly grown content slides up from the bottom edge instead of the text above it jumping in a single frame, with the status line standing still; the slide runs on the graphics card and takes no layout, so several sessions streaming at once cost no more for it. A message you send does not go through it: the host\'s scroll to bring it into view lands at once. Once the reader scrolls away from the bottom himself, the plugin stays out of it until he returns.',
    },
  },
} satisfies FeatureManifest
