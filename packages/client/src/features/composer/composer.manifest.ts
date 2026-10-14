import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'composer',
  order: 20,
  contracts: ['chat.scroller', 'composer.dialog-trigger', 'composer.input', 'composer.mobile-stats', 'composer.placeholder', 'composer.seat', 'composer.stack', 'composer.variant', 'shell.phase'],
  pref: 'composerScope',
  stylesheets: [
    { file: 'card.css', rank: 80, gate: true },
    { file: 'inline.css', rank: 90, gate: true },
    { file: 'inline-bar.css', rank: 100, gate: true },
  ],
  cases: ['composer', 'sync-fault', 'hero', 'late-forms'],
  description: {
    zh: {
      title: '输入区',
      text: '新会话页与对话页的输入卡片按 Claude Code Desktop 的样子重画：附件排成一行缩略图，上下文用量是工具栏里的一个圆环，点卡片的空白处就能开始输入，卡片变高时停在底部的对话跟着上移；空输入框的提示换成 Claude 的那一句。皮肤画的弹层卡片——模型、推理等级、权限、账号、新会话页的两个菜单——从各自的按钮处略小地长出来（约 0.25 秒），收起时更快、只略微收拢就淡出（约 0.12 秒）。设置页「输入区」可以选只改新会话页、只改对话页、两处都改或关闭。',
    },
    en: {
      title: 'Composer',
      text: 'The input card on the new-conversation page and in conversations is redrawn after Claude Code Desktop: attachments sit in one row of tiles, the context usage is a ring in the toolbar, a press anywhere on the card starts typing, and a conversation resting at the bottom moves up with the card as it grows; an empty composer shows Claude\'s own hint. The skin\'s popover cards — the model, reasoning, permission and account cards and the new-conversation page\'s two menus — grow out of their buttons from a little smaller (about 0.25 s) and close faster, shrinking only slightly as they fade (about 0.12 s). The Composer tab chooses the home page alone, the conversation alone, both, or neither.',
    },
  },
} satisfies FeatureManifest
