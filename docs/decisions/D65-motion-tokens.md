# D65. 动效令牌与共享预设：时长与曲线只写在令牌里

- **状态**：已实施
- **分组**：构建与源码
- **关联**：D9、D20、D26、D33、D42、D51

## 决定

- 令牌：`packages/client/src/theme/tokens.json` 新增 `motion` 一组，与配色、字体同一份数据（D51），每条带 `use`，按作用命名、不按数值命名：
  - 时长 `--dsh-claude-duration-<作用>`：即时、反馈、内容进场、浮层进场、退场、展开（菜单从触发点长出、整窗对话框从中心长出、设置页滑入、超时徽标滑上行）、换词与换词间隔、数字滚动、移动、滑动、渐隐、开关回弹、起飞、步进、弹入、升起（首页问候语）、错开，以及「减弱」时压到的一瞬（D26）。
  - 循环周期 `--dsh-claude-period-<作用>`：宿主扫光（状态行与过程组头部同档，跟宿主自己的 TextShimmer）、脉冲、闪动、光标闪烁、转圈、落点高亮、推理窗口停留。
  - 曲线 `--dsh-claude-ease-<名>`：标准、减速、缓入缓出、滑行、滚动、回弹、落定（transitions.dev 的 smooth-out，菜单、对话框、设置页、徽标与问候语都用它停到位）、宿主扫光。
  - 位移、模糊与缩放：`--dsh-claude-distance-nudge` / `-travel` / `-rise`、`--dsh-claude-blur-soft` / `-enter`、`--dsh-claude-scale-surface` / `-dropdown` / `-dropdown-exit` / `-dialog`。
  - 简写 `--dsh-claude-timing-feedback` / `-surface`：时长加曲线，直接写进 `transition` / `animation` 的简写。
  - 作用相同、只差几十毫秒或几个像素的写法合成同一档；一个作用只有一档。
- 生成：令牌样式表多出一个不挂门的块（这组值在所有配色与字体下都一样），`docs/STYLE.md` 多出一张由同一份数据重写的动效表；同一份数据还进构建产物里那个生成模块（D36）的 `MOTION`，`packages/client/src/shared/motion.ts` 从那里读，WAAPI 的时长与曲线、等一段动画播完的计时器都经它取（`motionMs`／`motionEase`／`motionValue`）。名字不是令牌表里的一项即抛出（D12），构建也拒绝。单元测试的配置用同一个生成函数把这份值写到 `.debug/vitest/generated.mjs`，模块在测试里读到的时长与页面上的一致。
- 预设：`packages/client/src/shared/motion.css`（主题样式表，排位 25）放同一种效果写过两次以上的关键帧：浮层进出 `dsh-claude-surface-in` / `-out`（起点位移与缩放可由使用处的 `--dsh-claude-surface-from`、`--dsh-claude-surface-scale` 改写）、宿主自己挂载的菜单从触发点长出 `dsh-claude-dropdown-in`、淡入淡出 `dsh-claude-fade-in` / `-out`、换词两半 `dsh-claude-swap-in` / `-out`（位移与模糊读 `--dsh-claude-swap-distance`、`--dsh-claude-swap-blur`）、脉冲 `dsh-claude-pulse`。皮肤自建的弹层卡片在 `shared/popover.css` 里以 `data-open` 上的过渡做同一个菜单效果：收起时 `transform` 只缩到 `-dropdown-exit`，淡出结束后由独立的 `scale` 属性一步补回 `-dropdown` 的起点，不另设「收起中」状态。由脚本驱动的换词仍是 `shared/swapping-text`，读同一组令牌。只属于一个功能的编排——卷帘门、推理窗口、发送起飞、三种数字变化、两种扫光、光标闪烁、落点高亮、推理等级闪动、开关回弹、设置页滑动、首页问候语升起、用量面板的占位交接、超时徽标、封号页的进出——留在功能里，只把数值改成读令牌。
- 检查：
  - `scripts/css.mjs` 在语法树上拒绝令牌样式表以外出现的非零时长与 `ease`、`ease-in`、`ease-out`、`ease-in-out`、`cubic-bezier()` 曲线，范围是 `transition*`、`animation*` 属性与所有自定义属性的值；`linear`、`step-start`、`step-end`、`steps()` 与 0 不算，它们是机械的计时，不是风格选择。
  - 同一份检查拒绝两组内容相同的 `@keyframes`，报出两处的名字；拒绝没有任何样式表或 TS 读到的动效令牌——令牌样式表本身声明了每一个令牌，不算读者，另一个令牌的值（简写）算；也拒绝浏览器半边向 `shared/motion.ts` 问一个令牌表里没有的名字。
  - `scripts/build-checks.mjs` 拒绝 `packages/client/src/` 的 TS 里写成字面字符串的同类曲线，WAAPI 的曲线经 `motionEase()` 取；`easing` 的取值在语法树上按类型读出，经常量与参数转手的同样算，注释不算（`scripts/source-tree.mjs`）。
- 「减弱」（D26）照旧由 `theme/chrome.css` 的一条规则把皮肤节点的时长压到 `--dsh-claude-duration-reduced`；预设关键帧的终态就是元素静止时的样子，压成一瞬也不留中间状态。功能自己需要 `animation: none` 的个别规则留在功能里，理由写在旁边。

## 理由

- 同一种效果写了多份（浮层进场四份、换词三份、脉冲两份），时长有十几种取值、曲线七条，数值散在三十来张样式表与十来个 TS 常量里，改一处找不全其余几处；一份数据生成全部，与 D51 的颜色令牌同一个道理。
- 检查把重复挡在合入之前：新写的动效只能挑已有的一档，或在令牌表里加一档，加档时表里看得见相近的那一档。
- transitions.dev 的片段本身按时长、曲线、位移、模糊、缩放五类令牌组织，往后照搬的效果能直接对上档位。

## 代价

- 合档改了一部分交互的手感：推理等级数值换词 0.28s→0.15s、模糊 4px→2px、位移 5px→4px；搜索面板进场 0.18s→0.15s、退场 0.14s→0.12s、位移 6px→4px、缩放 0.985→0.98；账户菜单进场位移 6px→4px；封号提示条进场 0.22s→0.15s、位移 6px→4px；颜色与背景反馈里的 0.1s、0.14s、0.18s、0.2s 统一到 0.12s；工作区、搜索与视图标签的显隐 0.16s→0.15s；侧栏图标转四分之一圈 0.25s→0.24s；推理等级滑块 0.18s→0.2s；发送替身落地淡出 0.16s→0.15s；推理窗口步进的曲线并入滑行曲线，过程组数字滚动的曲线并入文件行的滚动曲线；菜单与弹层卡片的展开从 0.15s 上移 4px 改为 0.25s 自触发点由 0.97 长出、不再上移，收起 0.15s→0.12s 且只缩到 0.99；开关回弹的曲线并入回弹曲线（1.35→1.45 的过冲）。
- 写动效多一步：先在令牌表里找档位；单元测试的配置多一段把生成模块写到 `.debug/vitest/` 的步骤。
- 规则写成 `var(--dsh-claude-…)`，比字面值长，在开发者工具里要对照令牌表读数。

## 重审条件

- 宿主公开自己的动效令牌（时长、曲线）时，令牌改为别名到宿主的那一套，像配色那样分出宿主一档。
