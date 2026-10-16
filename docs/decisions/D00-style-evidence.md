# D00. 样式的证据：语法树检查、重要性台账与结构属性

- **状态**：待实施
- **分组**：构建与源码
- **关联**：取代 D51 与 D9；D4、D30、D36、D38、D40、D44、D49、D50、D66
- **现状**：语法树检查、令牌数据、排位、压缩与结构属性已实施（`scripts/css.mjs`、`scripts/source-tree.mjs`、`scripts/feature-sheets.mjs`、`packages/client/src/theme/tokens.json`、`packages/client/src/shared/chat-dom.ts`）。读皮肤自己部件关系的 `:has()` 已改成标记：十六条规则读 `data-dsh-claude-holds`，关系写在 `packages/client/src/core/parts-table.ts` 的 `HOLD_RELATIONS` 里，由盖部件的走查维护，构建拒绝在 `:has()` 里读属性的写法并核对这份关系表。整份文档的查找由 lint 记账（`packages/testing/document-lookups.json` 逐条登记，只许变短）。`importance` 场景只判定「去掉之后计算值不变」，不记录对手；够不到的选择器登记在 `packages/testing/importance-unreachable.json`，其中带 `either` 的分组两种结果都算数，没审计到的 `!important` 照留；构建不要求 `!important` 有证据。迁移完成之前，以现状为准修改代码。

## 决定

- 层叠顺序由样式表的排位声明：主题样式表在 `scripts/build.mjs` 的 `THEME_SHEETS`，功能样式表在各自清单里（D42），同一排位即构建失败；不使用层叠层。
- 样式表是普通 CSS，没有构建期占位，品牌标志读 `--dsh-claude-image-<名字>`（D38）。构建用 PostCSS 与 postcss-selector-parser 解析，规则在语法树上检查（`scripts/css.mjs`）。
- 作用域：每个选择器含 `body[data-dsh-claude-style]` 且不在 `:not()` 里，画 `<html>` 的规则经 `html:has(body[data-dsh-claude-style]…)` 进入；清单标 `scope: 'surface'` 的样式表换成 `body[data-dsh-claude-surface]`、不带输入框门控，单独发出（D49）。
- 令牌门：写 `--dsw-` 颜色令牌的选择器在作用域那一段挂配色门，写 `--dsw-font-*` 的挂字体门；Claude 一档的每个私有令牌在宿主一档都有别名（D30）。带门控的样式表在 `/* @composer-gate */` 以下的每条规则带上门控属性（D4）。
- 选择器读到的每个 `data-dsh-*` 属性都要有代码写入：构建读浏览器半边的 TypeScript 语法树（`scripts/source-tree.mjs`），追到写入处的字面值，追不到即构建失败。
- 一项一条规则、条数代码也要读的样式由 `scripts/feature-sheets.mjs` 按 `packages/client/src/constants.ts` 生成，与手写的走同样的检查；拼好的样式表经 esbuild 压缩（`scripts/shared/minify-css.cjs`），压缩报警告即构建失败。
- 设计令牌写在 `packages/client/src/theme/tokens.json`，结构由 schema 声明、Ajv 校验；令牌样式表与 `docs/STYLE.md` 的令牌表都由它生成，不手改。
- 依赖 DOM 结构的判断由脚本写成属性，样式只读属性；会反复翻转的属性挂在最近的公共祖先上，`<body>` 只放偏好镜像与安装时写一次的标记。
- `:has()` 只在选择器的最后一段，`:is()`、`:not()` 里每一层都一样。参数只读皮肤自己写下的 `data-dsh-*` 属性的 `:has()` 构建拒绝：这层关系由盖部件的代码写成祖先上的属性。
- 功能与共享层不做整份文档查找：宿主节点经 `core/host.ts` 的访问器或观察总线的清单读取（D40），lint 拒绝其余位置的整份文档查找。
- `!important` 要有证据：`importance` 场景在 `packages/testing/` 下生成台账 importance-ledger.json，按选择器与属性记下每一处 `!important` 压过的对手；源码里既不在这份台账、也不在够不到登记表里的 `!important` 构建拒绝。
- 对手分四类，读法是去掉之后用 CDP 的 `CSS.getMatchedStylesForNode` 看胜出者：另一条皮肤规则，改用排位或权重解决；宿主权重更高的规则，选择器写出宿主的同一结构再加上作用域；宿主的 `!important` 与内联样式，保留。
- 审计在走查的每个页面状态里逐条去掉 `!important`；条件不成立的 `@media`、`@supports` 不审；`DSH_IMPORTANCE_REFERENCE` 指定的旧样式表在同一页上逐元素比对，作为样子不变的证据。
- 走查经宿主的真实路径到达页面状态：脚本回合产生用量与文件操作，切换宿主语言，经场景的 `plugins` 装上对方插件；动画中间的状态按动画定格读取（D66）。仍够不到的选择器登记进 `packages/testing/importance-unreachable.json` 并写明缘由，登记表只许变短，不设「两种结果都算数」。
- 一张样式表的台账里，大多数 `!important` 压的是宿主元素上的内联样式或宿主的 `!important` 时，该区域改由皮肤用宿主的 React 渲染，宿主元素用一条规则隐藏，数据与动作走契约模块登记的宿主服务（D44）。

## 理由

- 宿主的样式几乎全在层叠层之外，层里的规则不论权重都输给层外的；按行扫描选择器会漏判，语法树上的检查与成熟解析库没有这个问题。
- 不在最后一段的 `:has()`、挂在 `<body>` 上会翻转的属性与刷新里的整份文档查找，都让每一次 DOM 变化付出与整页规模成正比的代价。
- 没有证据的 `!important` 会一直留着，新加一条也不付任何代价；台账写明每一条压的是谁，可以去掉的那些由类别直接给出去法。

## 代价

- 多了 PostCSS 与 postcss-selector-parser 两个开发依赖；读语法树用的是 TypeScript 7 标为 unstable 的同步 API，版本固定，升级时要一并核对。
- 结构属性要等脚本在同一帧、绘制之前写入，每多一层结构关系，盖部件的代码就多写一个属性。
- 台账的覆盖面取决于走查到达的状态；接管一个区域后，那里的键盘操作与读屏语义由皮肤自己实现。

## 重审条件

- 宿主把样式放进层叠层，或提供主题层级与令牌分层时，改用层叠层并接入宿主的层级。
- 浏览器对非末段 `:has()` 的失效处理实测不再明显慢于末段写法。
- 宿主提供主题 API 时，接管的区域改接宿主。
