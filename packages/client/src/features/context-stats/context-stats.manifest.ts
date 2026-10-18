import { COMPOSER_SCOPE_ALL, COMPOSER_SCOPE_CONVERSATION, STATS_POSITION_CONTEXT, STATS_POSITION_INLINE } from '../../constants'
import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'contextStats',
  order: 70,
  load: 'deferred',
  contracts: ['chat.call', 'chat.streaming', 'composer.dialog-trigger', 'composer.meter-fill', 'composer.stat', 'composer.stats'],
  pref: 'statsPosition',
  // Both positions are this feature's: the line of its own is what the inline
  // one adds, since the panel the meter owns carries the rows either way.
  prefValues: [STATS_POSITION_INLINE, STATS_POSITION_CONTEXT],
  stylesheets: [],
  settingsRows: [{
    tab: 'conversation',
    rank: 35,
    pref: 'statsPosition',
    title: 'statsPositionTitle',
    desc: 'statsPositionDesc',
    choiceLabels: {
      [STATS_POSITION_INLINE]: 'statsPositionInline',
      [STATS_POSITION_CONTEXT]: 'statsPositionContext',
    },
    // The figures hang off the meter the composer restyle stamps, and a
    // session's figures only exist in the conversation.
    requires: {
      pref: 'composerScope',
      values: [COMPOSER_SCOPE_CONVERSATION, COMPOSER_SCOPE_ALL],
      note: 'statsComposerRequired',
    },
  }],
  cases: ['context-stats', 'stats-compact', 'stats-inline'],
  description: {
    zh: {
      title: '会话数字',
      text: '会话统计与 Token 用量随宿主的数据实时更新，默认收进上下文计量那张弹层：里面是宿主自己的上下文行，后面接上这一段会话的数字明细——轮数与步数、输出速度、读入与写回的 tokens、缓存命中率。也可以选「独立成行」，把这些数字写在输入卡片下面单独一行、末尾就是那枚计量饼，按一下那一行同样开合这张弹层（悬停开合只归那枚饼）。数字接到新读数就从眼前的数连续计数到新值，答案流式输出期间接连更新时从当时的值接着走；写回的那一数还按流式文字估算着上涨，工具调用的参数不上页面，每出现一行调用另按一行计入，这一步结算时换成宿主给出的真实值；切换会话时也从上一段的数字计数过去，弹层里的数字同样这样计数；各段之间没有分隔符号、只靠间距分开，缓存命中那一截的色带只染数字与百分号，计量饼按占用自己取色。',
    },
    en: {
      title: 'Session numbers',
      text: 'The session statistics and the token usage follow the host\'s data live and stand in the context meter\'s popover by default: the host\'s own context rows, followed by this session\'s detail rows — turns and steps, the output speed, the tokens read in and written back, the cache-hit share. On its own line writes them on a line of their own below the input card with the meter\'s pie at its end, and pressing that line opens and closes the same popover (opening and closing on hover stays the pie\'s own path). A figure counts from the value on show to a new reading, carries on from where it stands when another reading lands mid-count, and counts to another session\'s numbers from the ones it was showing; the popover\'s rows count the same way; while an answer streams, the written-back figure climbs with the text that has arrived, by estimate, and each tool call counts once since a call\'s arguments never reach the page, with the host\'s own number replacing the estimate once that step settles; no separator glyph stands between the groups — the line\'s own gap is what sets them apart — and the cache share\'s band marks its figure and percent sign alone while the meter\'s pie takes the colour its occupancy falls on.',
    },
  },
} satisfies FeatureManifest
