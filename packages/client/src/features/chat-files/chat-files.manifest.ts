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
      title: '文件操作行',
      text: '一个文件的读取、编辑与写入带着行尾的 `+n -m`、可展开的改动卡片或读取窗口，路径可点开文件；同一个文件在同一个过程组里的多次调用读成一行，行首的图标与标题跟着最后一次操作换新，行尾的数字是这些改动的累计值、随每次改动到达逐位翻页，展开这一行读到全部改动（只被读取过时读到这一次读取的窗口）；失败与中断的行保留裁决信息。',
    },
    en: {
      title: 'File operation rows',
      text: 'A read, edit or write of a file carries the `+n -m` tail and an expandable diff card or read window, and its path opens the file; the calls on one file inside one process group stand as a single row whose icon and title move on with the file\'s last operation and whose tail is their change total, turning character by character as each change lands, and opening that row reads every change — or the window it was last read at when nothing changed; a failed or interrupted row keeps its verdict.',
    },
  },
} satisfies FeatureManifest
