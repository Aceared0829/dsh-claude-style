import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'chatFiles',
  order: 220,
  contracts: ['chat.call', 'chat.think-running', 'process.content'],
  pref: 'chatAnimations',
  yieldsTo: 'dsh-chat-ux',
  stylesheets: [{ file: 'chat-files.css', rank: 190 }],
  cases: ['chat-files', 'peer-chat-ux'],
  description: {
    zh: {
      title: '文件变更行',
      text: 'run_code 程序里派发出去的写入与编辑带上行尾的 `+n -m` 与可展开的改动卡片，路径可点开文件；同一个文件在同一个过程组里的多次改动读成一行，行尾的数字是这些改动的累计值、随每次改动到达滚动，展开这一行读到的是全部改动；失败与中断的行保留裁决信息。',
    },
    en: {
      title: 'File change rows',
      text: 'A write or edit dispatched from inside a run_code program carries the `+n -m` tail and an expandable diff card, and its path opens the file; several changes to one file inside one process group stand as a single row whose tail is their total, rolling as each change lands, and opening that row reads every change; a failed or interrupted row keeps its verdict.',
    },
  },
} satisfies FeatureManifest
