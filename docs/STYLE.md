# Style Guide · 设计令牌

Design tokens for `dsh-claude-style`, recreating the Claude Code Desktop aesthetic.

## Palette

| Token | Value | Use |
|---|---|---|
| ivory light | `#FCFCFB` | light canvas / layer 1 |
| sidebar light | `#FBFBF9` | light sidebar / layer 2 |
| ivory neutral | `#F9F9F6` | layer 3 / section bg |
| ivory border | `#E8E6DC` | border l1 |
| slate dark | `#141413` | text (light mode), canvas (dark mode) |
| warm gray | `#B0AEA5` | metadata |
| clay | `#D97757` | single accent — CTA / links |
| accent deep | `#C6613F` | accent hover |
| hairline | `#1414131a` | 1px warm border |
| divider | `rgba(20, 20, 19, .05)`, `rgba(255, 255, 255, .06)` in dark | 0.5px separator line |

Rules:

- Never pure white, never pure black, never cool grays. The reader's own message
  plate is the one fill that is not a step of the warm surface ladder and not the
  canvas either (`--dsw-specific-bubble`: the neutral the table header wears in
  light, a 6% white lift in dark) — the product's own light tint is a cool
  blue-grey, which reads blue beside this canvas.
- Accent usage stays under ~10% of visible elements.

**The DeepSeek brand's palettes.** The DeepSeek brand turns both palettes
blue. The single accent is DeepSeek's brand blue `#4D6BFE` — the colour of its
whale logo and of Deepy — with a darker step for text links on the light canvas
and a lighter one on the dark; the sidebar's whale and wordmark and the hero's
fish take it as their ink. The neutrals are the host's own cool family (its
`neutral-bluish` ramp) under a white carrying only a hint of sky in light and a
blue-black in dark. User bubbles take a blue tint as the host's own do, and
inline code keeps the body ink as the host draws it. The skin's Claude marks
(the account row's
picture without an avatar) become DeepSeek's
whale (`packages/assets/src/brand/deepseek-mark.svg`, the host's `FISH_LOGO_PATH`); the
violet top rung of the reasoning slider stays.

The table below is generated from `packages/client/src/theme/tokens.json` by `npm run build`;
edit the JSON, not the table. A DeepSeek cell shows the Claude value the brand
keeps where it states none of its own; `—` is a token that theme leaves unset.

<!-- generated:tokens (packages/client/src/theme/tokens.json) -->
| Token | Claude light | DeepSeek light | Claude dark | DeepSeek dark | Host alias | Use |
|---|---|---|---|---|---|---|
| `--dsw-alias-bg-base` | `#fcfcfb` | `#fafbff` | `#141413` | `#13161d` | host's own |  |
| `--dsw-alias-bg-layer-1` | `#fcfcfb` | `#fafbff` | `#1c1b1a` | `#1a1e27` | host's own |  |
| `--dsw-alias-bg-layer-2` | `#fbfbf9` | `#f7f9ff` | `#242320` | `#212631` | host's own |  |
| `--dsw-alias-bg-layer-3` | `#f9f9f6` | `#f4f7fe` | `#2e2c29` | `#2a303c` | host's own |  |
| `--dsw-alias-bg-overlay` | `#ffffff` | `#ffffff` | `#242320` | `#212631` | host's own |  |
| `--dsw-alias-border-l1` | `#e8e6dc` | `#e7ecf7` | `rgba(255, 255, 255, 0.09)` | `#212631` | host's own | the standard edge: card and panel outlines, dividers, field outlines |
| `--dsw-alias-border-l2` | `#dedcd2` | `#dde4f1` | `rgba(255, 255, 255, 0.18)` | `#2a303c` | host's own |  |
| `--dsw-alias-border-l3` | `#d0cdc1` | `#cfd8ea` | `rgba(255, 255, 255, 0.30)` | `#363d4b` | host's own |  |
| `--dsh-claude-divider` | `rgba(20, 20, 19, 0.05)` | `rgba(38, 49, 72, 0.05)` | `rgba(255, 255, 255, 0.06)` | `rgba(255, 255, 255, 0.06)` | `var(--dsw-alias-border-l1)` | a line that only separates: foot areas, settings rows, menu separators, the transcript's rule |
| `--dsw-alias-brand-primary` | `#d97757` | `#4d6bfe` | `#d97757` | `#4d6bfe` | host's own | the single accent: checks, focus rings, selected marks |
| `--dsw-alias-brand-text` | `#faf9f5` | `#fafbff` | `#faf9f5` | `#eef1f8` | host's own |  |
| `--dsw-alias-button-primary-fill` | `#d97757` | `#4d6bfe` | `#d97757` | `#4d6bfe` | host's own |  |
| `--dsw-alias-button-primary-hover` | `#c6613f` | `#3a57e8` | `#e08a6d` | `#6a84ff` | host's own |  |
| `--dsw-alias-button-elevated-fill` | `#ffffff` | `#ffffff` | `#242320` | `#212631` | host's own |  |
| `--dsw-alias-button-floating-fill` | `#ffffff` | `#ffffff` | `#242320` | `#212631` | host's own |  |
| `--dsw-alias-button-floating-hover` | `#ffffff` | `#ffffff` | `#2e2c29` | `#2a303c` | host's own |  |
| `--dsw-alias-button-info-fill` | `#d97757` | `#4d6bfe` | `#d97757` | `#4d6bfe` | host's own |  |
| `--dsw-alias-button-info-hover` | `#c6613f` | `#3a57e8` | `#e08a6d` | `#6a84ff` | host's own |  |
| `--dsw-alias-interactive-bg-active` | `rgba(217, 119, 87, 0.30)` | `rgba(77, 107, 254, 0.22)` | `rgba(217, 119, 87, 0.30)` | `rgba(77, 107, 254, 0.30)` | host's own |  |
| `--dsh-claude-hover-bg` | `rgba(0, 0, 0, 0.08)` | `rgba(38, 49, 72, 0.08)` | `rgba(255, 255, 255, 0.08)` | `rgba(255, 255, 255, 0.08)` | `var(--dsw-alias-interactive-bg-hover)` | hover wash |
| `--dsh-claude-field-ring` | `#2a78d6` | `#2a78d6` | `#2a78d6` | `#2a78d6` | `var(--dsw-alias-brand-primary)` | the ring around a field the reader is renaming in: the session title's own editor, drawn from the selection blue |
| `--dsh-claude-inline-code-bg` | `rgba(0, 0, 0, 0.05)` | `rgba(38, 49, 72, 0.05)` | `rgba(255, 255, 255, 0.05)` | `rgba(255, 255, 255, 0.05)` | `var(--dsw-alias-markdown-inline-code)` | inline code fill |
| `--dsh-claude-inline-code-fg` | `#943333` | `var(--dsw-alias-label-primary)` | `#e8a08a` | `var(--dsw-alias-label-primary)` | `var(--dsw-alias-label-primary)` | inline code ink |
| `--dsh-claude-link` | `#184f95` | `#3b56d9` | `#8ab4f8` | `#8fa4ff` | `var(--dsw-alias-link)` | markdown links |
| `--dsh-claude-link-underline` | `rgba(24, 79, 149, 0.6)` | `rgba(59, 86, 217, 0.6)` | `rgba(138, 180, 248, 0.6)` | `rgba(143, 164, 255, 0.6)` | `color-mix(in srgb, var(--dsw-alias-link) 60%, transparent)` | markdown link underline |
| `--dsw-alias-markdown-code-block` | `#ffffff` | `#ffffff` | `#1c1b1a` | `#1a1e27` | host's own |  |
| `--dsw-alias-markdown-code-block-banner` | `#ffffff` | `#ffffff` | `#242320` | `#212631` | host's own |  |
| `--dsw-alias-interactive-bg-hover` | `var(--dsh-claude-hover-bg)` | `var(--dsh-claude-hover-bg)` | `var(--dsh-claude-hover-bg)` | `var(--dsh-claude-hover-bg)` | host's own |  |
| `--dsw-alias-interactive-bg-hover-solid` | `#f0efe9` | `#eef3fc` | `#2e2c29` | `#2a303c` | host's own | the host's solid hover chip |
| `--dsw-alias-label-primary` | `#141413` | `#0f1115` | `#faf9f5` | `#eef1f8` | host's own |  |
| `--dsw-alias-label-primary-bluish` | `#141413` | `#0f1115` | `#faf9f5` | `#eef1f8` | host's own |  |
| `--dsw-alias-label-secondary` | `#6e6a60` | `#61666b` | `#b0aea5` | `#aeb5c4` | host's own |  |
| `--dsw-alias-label-tertiary` | `#8f8a7e` | `#81858c` | `#8f8d84` | `#8a92a3` | host's own |  |
| `--dsw-alias-label-caption` | `#a6a094` | `#adb2b8` | `#6b6a65` | `#666e7e` | host's own |  |
| `--dsw-alias-label-shimmer` | `color-mix(in srgb, #141413 30%, transparent)` | `color-mix(in srgb, #141413 30%, transparent)` | `color-mix(in srgb, #faf9f5 45%, transparent)` | `color-mix(in srgb, #faf9f5 45%, transparent)` | host's own | the highlight band's tint over running words: the host's own rows and the skin's band (shared/sweep-band.ts) alike |
| `--dsw-alias-label-deep-diving-shimmer` | `color-mix(in srgb, #141413 30%, transparent)` | `color-mix(in srgb, #141413 30%, transparent)` | `color-mix(in srgb, #faf9f5 45%, transparent)` | `color-mix(in srgb, #faf9f5 45%, transparent)` | host's own | the band's tint inside the running row, which the host points --dsw-alias-label-shimmer at; under Claude it is the same warm band as everywhere else |
| `--dsw-alias-state-business-primary` | `#d97757` | `#4d6bfe` | `#d97757` | `#6a84ff` | host's own |  |
| `--dsw-alias-state-business-tertiary` | `#e9dfd2` | `#e9eeff` | `#3a2a22` | `#253056` | host's own |  |
| `--dsw-alias-link` | `#c6613f` | `#3b56d9` | `#e08a6d` | `#8fa4ff` | host's own | text link at rest |
| `--dsw-shadow-lv2` | `0 4px 18px rgba(20, 20, 19, 0.10), 0 1px 3px rgba(20, 20, 19, 0.05)` | `0 4px 18px rgba(20, 20, 19, 0.10), 0 1px 3px rgba(20, 20, 19, 0.05)` | `0 4px 16px rgba(0, 0, 0, 0.30), 0 1px 3px rgba(0, 0, 0, 0.14)` | `0 4px 16px rgba(0, 0, 0, 0.30), 0 1px 3px rgba(0, 0, 0, 0.14)` | host's own |  |
| `--dsw-specific-input-major` | `#ffffff` | `#ffffff` | `#0f0e0d` | `#0e1117` | host's own |  |
| `--dsw-specific-selector` | `#fbfbf9` | `#f7f9ff` | `#2e2c29` | `#2a303c` | host's own |  |
| `--dsw-specific-sidebar-fill` | `#fbfbf9` | `#f7f9ff` | `#141413` | `#13161d` | host's own |  |
| `--dsw-alias-brand-primary-new-colorprimary-new-color` | `#d97757` | `#4d6bfe` | `#d97757` | `#4d6bfe` | host's own |  |
| `--dsh-claude-canvas` | `#fcfcfb` | `#fafbff` | `#141413` | `#13161d` | `var(--dsw-alias-bg-base)` | the page canvas, the search box |
| `--dsh-claude-sidebar-canvas` | `#fbfbf9` | `#f7f9ff` | `#141413` | `#13161d` | `var(--dsw-specific-sidebar-fill)` | the sidebar |
| `--dsh-claude-raised` | — | — | `#1e1e1d` | `#1b1f28` | `var(--dsw-alias-bg-overlay)` | popovers and menus raised above the dark canvas |
| `--dsh-claude-card` | `#fcfcfb` | `#fafbff` | `#1e1e1d` | `#1b1f28` | `var(--dsw-alias-bg-overlay)` | cards on the canvas in light and raised in dark: the account popover, the search palette |
| `--dsh-claude-inverse-fill` | `#141413` | `#141413` | `#faf9f5` | `#faf9f5` | `var(--dsw-alias-interactive-bg-hover)` | the model picker's group label fill: an inverted chip under Claude, a hover-plate chip under the host |
| `--dsh-claude-inverse-ink` | `#faf9f5` | `#faf9f5` | `#141413` | `#141413` | `var(--dsw-alias-label-primary)` | the model picker's group label ink |
| `--dsh-claude-ink-strong` | — | — | `#f5f4ef` | `#e9edf6` | `var(--dsw-alias-label-primary)` | active row ink |
| `--dsh-claude-session-ink` | — | — | `#8c8983` | `#8a91a0` | `var(--dsw-alias-label-secondary)` | session title at rest |
| `--dsh-claude-table-head` | `#f0f0ef` | `#eff3fb` | `#242320` | `#212631` | `var(--dsw-alias-bg-layer-2)` | table header row |
| `--dsh-claude-ripple-ink` | `#8a8a85` | `#8a92a6` | `#8c8a82` | `#8b93a7` | `var(--dsw-alias-label-secondary, #8a8a85)` | the new-conversation page's glyph field, and the wake a ripple leaves in it |
| `--dsh-claude-ripple-wave` | `#3b6ef0` | `#3b6ef0` | `#7fa6ff` | `#7fa6ff` | `var(--dsw-alias-link, #3b6ef0)` | the front of a ripple in the new-conversation page's glyph field |
| `--dsh-claude-scrollbar` | `rgba(208, 205, 193, 0.9)` | `rgba(206, 216, 233, 0.9)` | `rgba(58, 56, 51, 0.9)` | `rgba(54, 61, 75, 0.9)` | `var(--dsw-alias-border-l2)` | scrollbar thumb |
| `--dsh-claude-scrollbar-hover` | `rgba(143, 138, 126, 0.8)` | `rgba(129, 133, 140, 0.8)` | `rgba(107, 106, 101, 0.9)` | `rgba(104, 112, 128, 0.9)` | `var(--dsw-alias-label-caption)` | scrollbar thumb under the pointer |
| `--dsh-claude-link-hover` | `#a94f2f` | `#2c43b8` | `#f0a488` | `#b0c0ff` | `var(--dsw-alias-link)` | text link under the pointer |
| `--dsh-claude-logo-ink` | `#141413` | `#4d6bfe` | `#faf9f5` | `#4d6bfe` | `var(--dsw-alias-label-primary)` | sidebar brand art: the whale and the wordmark |
| `--dsw-specific-menu` | `#ffffff` | `#ffffff` | — | — | host's own |  |
| `--dsw-specific-bubble` | `#f0f0ef` | `#eaf0fe` | `rgba(255, 255, 255, 0.06)` | `#232a3a` | host's own | user message bubble |
| `--dsh-claude-chip` | `#f6f6f4` | `#f2f6fd` | — | — | `var(--dsw-specific-selector)` | segmented control and switch at rest |
| `--dsh-claude-meter-peak` | `#a4621d` | `#9a5a1a` | `#e2a45f` | `#e5ae67` | `var(--dsw-alias-state-warn-label)` | the peak rate badge: the expensive end of a provider's own billing clock |
| `--dsh-claude-meter-valley` | `#3d7550` | `#2e7554` | `#8cbf96` | `#7cc2a0` | `var(--dsw-alias-state-success-primary)` | the off-peak rate badge, and the dated promotions priced below it |
<!-- /generated:tokens -->

**Host token bindings.** The skin supplies its palette through the host's own
alias tokens, so a host control that reads more than one token for one surface
has to be given all of them. A filled primary button is that case: the host takes
the fill from `--dsw-alias-brand-primary`, but the hover from a monochrome step
of its own scale (light `#43454a`, dark `#ebeef2`) and the label from a
foreground token the skin leaves alone. `--dsw-alias-button-primary-fill` and
`--dsw-alias-button-primary-hover` therefore state both steps in each palette.
Two fills are palette-specific rather than carried over from the dark base:
`--dsw-alias-interactive-bg-hover-solid` (a solid chip, lighter than the canvas
in light) and `--dsw-alias-button-elevated-fill` (a surface above the canvas in
light, a raised gray in dark).

## Two palettes · 两套配色归属

The Colours and Typefaces rows each choose who paints: **Claude** (the default)
or **Follow the host**. Every rule that writes a host token carries the Claude
gate in its selector — `[data-dsh-claude-palette="claude"]` for colours,
`[data-dsh-claude-typeface="claude"]` for `--dsw-font-*` — and so does every
rule that paints the skin's canvas onto the host's frame (`<html>`, `<body>`,
`#root`, the sidebar and conversation
columns); the build refuses an ungated one. Under "follow the host" those rules
drop out: the host's own tokens stand, or another theme plugin's, such as a
wallpaper plugin that clears the canvas and turns the overlays to glass.

The skin's own surfaces read only its private tokens and host tokens. Under the
host palette each private token is an alias of a host token (the token table's
Host alias column), so those surfaces follow whoever paints the host's. A new
private colour token gets its Claude values and its host alias in
`packages/client/src/theme/tokens.json`; the build refuses a private token without an alias.
Cards take the host's overlay layer rather than its canvas: a plugin that
clears the canvas still gives its overlays a readable fill, and the shared
popover card blurs what lies behind it (`blur(16px) saturate(1.4)`).

Under the host typeface the skin's own faces fall back to the host's:
`--dsh-claude-font-serif`, `-prose` and `-brand` to `--dsw-font-family` (the host
carries no serif), `--dsh-claude-font-code` to `--ds-font-family-code`.

Two colours stay whoever paints: the reasoning slider's violet top rung
(`--dsh-claude-apex*`) and the account-hold page, which reproduces a Claude
screen. Translucent neutral hover tints and the usage panel's data colours stay
literal; they read on any canvas. Every other colour that paints a surface, a
text, a border or an accent reads a token.

## Windows titlebar · 桌面顶栏

On the Windows desktop the 40px caption row has no colour of its own: the
sidebar and the conversation run to the window's top edge, each in its own
fill (`--dsh-claude-sidebar-canvas`, `--dsh-claude-canvas`), and the sidebar's
0.5px `--dsw-alias-border-l1` hairline runs with them from the top edge to the
bottom. The conversation column and the fullscreen file panel lose the host's
16px top-left corner, so the hairline meets them straight. The three window
buttons sit on the page itself: no block of their own behind them, and they dim
with a modal's mask like everything else. Their hover plate is the system's, a
tint of the button glyph's colour.

## Right sidebar · 右侧栏

A panel docked in the right column is a card: 8px inside the column on every
side, a 16px radius, the skin's 1px `--dsw-alias-border-l1` hairline and the
host's own panel elevation (`--dsw-elevation-prominent` — a `.5px` stroke, a
3px/8px drop and a 20px halo). The frame's canvas shows through the gap, and
the host's `.5px` left border on the first dock column gives way to the
hairline.

The card hangs on what paints the column: a docked tab's pane
(`[data-dockkit-host="dock"] > [data-dockkit-pane]`) or the column's own empty
host (`[data-dockkit-empty]`), which the pane inside it leaves transparent. A
panel pulled out of the sidebar becomes the host's own floating window
(`[data-dockkit-host="float"]`) and keeps that window's frame; a split column
gives each pane its own card, with the drag divider left on the seam between
them.

**Right sidebar card layout** (the Sidebar tab) chooses it: on is the card
above; off drops every rule that draws one, so the pane stands in the host's
own fill, flush with the column on all four sides, and a split's two panes meet
at the dock's own resting line. Every card rule is gated on
`<body data-dsh-claude-dock-look="card">`, so off is the host's own panel look
with nothing added.

**The start page.** The host centers its stack of entries in a box that never
grows, so a list taller than the pane was clipped at both ends, its first rows
out of reach. On the card the stack scrolls: `justify-content: flex-start`,
`margin-top: auto` on the first entry and `margin-bottom: auto` on the last.
The two auto margins absorb the free space exactly as `center` did while the
list fits, and fall to zero once it does not, so the stack starts at the top
and scrolls to its end.

## Typography

- **Serif display** — headings / editorial statements (`--dsh-claude-font-serif`).
- **Sans UI** — chrome, body (`--dsw-font-family`).
- **Mono** — code, technical labels (`--dsh-claude-font-code`).


## Shapes

- Radius: 4 / 8 / 16 px; 12px for a popover card and 6px for its rows (the
  popover table below); pills for CTAs (`9999px`). A shape copied from a host
  control keeps that control's own geometry rather than the scale above: the
  composer card's 18px (the host's 22px less 4), the inline composer's 14px and
  11px, the permission and workspace segments' 7px, the view tabs' 5px, the
  peak-rate and file pills' 999px.
- Borders: 1px, and in dark not a colour but a highlight. The three border
  tokens are one translucent white at `.09` / `.18` / `.30`, so a card, a panel,
  a code block or a keycap reads as a chamfer catching the top light over
  whatever fill it sits on rather than as a contour whose colour has to be
  re-picked per surface. The light rungs stay the warm opaque ladder. A copy of a
  host control keeps that control's own stroke: the inline composer's 1.6px stop
  square.
- Separator: `--dsh-claude-divider`, a rung below the lightest border, drawn at
  0.5px on every line that only separates — the sidebar's foot area, the search
  panel's foot, the context stats, the settings rows, a menu's separators, the
  file block's IN/OUT line and the transcript's `hr` (one device pixel on a
  retina display; elsewhere `0.5px` rasterises to one physical pixel). A card, a
  field and a popover keep their 1px border in l1, so an outline always reads
  heavier than a separator inside it. The split between the sidebar and the
  conversation stays 0.5px of l1 (`theme/chrome.css`); the Markdown table frame
  and the trajectory chip stay 0.5px of l2 (`theme/typography.css`,
  `features/chat-files`).
- Spacing: 4 px rhythm.
- Bottom edge: the transcript never fades behind the composer by shadow. The
  composer seat paints an opaque `var(--dsw-alias-bg-base)` bar across its own
  box (so the bar's height *is* the composer's height) and one
  `--dsh-composer-fade-h` (40px) gradient band above it, running to transparent.
  The same token is the transcript's bottom clearance, so the last turn rests
  exactly at the band's top edge. Never re-add background-coloured halo shadows
  to the card to hide the transcript: they have to be restated in every
  light / dark / focus / attachment rule, and every rule that resets the card's
  `box-shadow` inherits the job.
- Focus: the composer field lights up — its hairline takes the input box's own
  shadow colour (espresso `#141413` in light) with a 1px halo in the same tone
  and a deeper drop shadow. Dark inverts the face: on the near-black canvas a
  black edge carries no cue, so the hairline and halo become bright ivory —
  the field visibly lights up instead of deepening. The footer tray below
  follows the same hairline so the two tiers stay one outline. Accent is never
  used for focus strokes.

## Motion

Every duration, curve, distance, blur and scale the skin uses is a token here,
and a stylesheet or a Web Animations call reads the token rather than writing the
value (D9). One value per role, so a faster feedback or a calmer swap is one
edit; the build refuses a time or a curve written anywhere else.

- Feedback: a control answering hover, press or focus.
- Reveal: content entering the chat area at the host's own 120 ms.
- Surface: an entrance — a menu, a popover, a panel, a dialog, a toast.
- Exit: a dismissal, deliberately quicker than the entrance.
- Travel: something moving along its own track (a fold's door, the reasoning
  slider).
- The swap, its gap and the roll of a figure's digits come from the transitions
  this skin ports; `THIRD_PARTY_NOTICES.md` names each one.
- Loop periods are separate from durations: a sweep, a pulse, a blink, a breath.
- Open: a menu growing out of its trigger, a dialog out of the centre, a
  settings page sliding in — the transitions.dev surfaces, settling on their own
  curve and closing on the exit duration.
- The presets these tokens feed live in `packages/client/src/shared/motion.css`:
  a surface arriving or leaving, a menu growing out of its trigger, a plain
  fade, one half of a wording swap, the pulse a placeholder and the sidebar's
  ongoing light share, and the two paints
  the waiting line's words can wear (a highlight band and a colour wash). A
  feature that needs its own effect reads the tokens and keeps its own
  keyframes.

The table below is generated from `packages/client/src/theme/tokens.json` by `npm run build`;
edit the JSON, not the table.

<!-- generated:motion (packages/client/src/theme/tokens.json) -->
| Token | Value | Use |
|---|---|---|
| `--dsh-claude-duration-instant` | `80ms` | the composer caret following the insertion point |
| `--dsh-claude-duration-feedback` | `120ms` | a control answering hover, press or focus: its colour, background, border, shadow, or a small turn or slide of its own parts |
| `--dsh-claude-duration-reveal` | `120ms` | content entering the chat area: an opened row's body, and each streamed piece of the answer |
| `--dsh-claude-duration-enter` | `320ms` | one message the reader sends growing into its row, and the same growth on the Motion tab's card |
| `--dsh-claude-duration-surface` | `150ms` | a floating surface or a group of controls appearing: popover cards, menus, panels, the search dialog, a toast, a strip fading in |
| `--dsh-claude-duration-exit` | `120ms` | a surface leaving on the reader's dismissal: a menu or a dialog closing, the overtime badge leaving |
| `--dsh-claude-duration-open` | `250ms` | a surface growing out of its anchor: a menu out of its trigger, a full-window dialog out of the centre, a settings page sliding in, the overtime badge sliding onto its line |
| `--dsh-claude-duration-swap` | `150ms` | each half of a wording swap: the old words leaving, the new ones arriving |
| `--dsh-claude-duration-swap-gap` | `50ms` | the offset the words arriving start after the words leaving, so the two halves of a wording swap travel together |
| `--dsh-claude-duration-clear-delay` | `50ms` | how long after a field empties the streak under its cleared words starts to rise |
| `--dsh-claude-duration-clear-text` | `400ms` | the two halves of clearing a field: the words leaving it, and the placeholder taking their place |
| `--dsh-claude-duration-clear` | `1000ms` | one whole clear: the words leaving, the placeholder arriving, and the streak's rise, peak and fall |
| `--dsh-claude-duration-roll` | `160ms` | a figure's characters rolling over to new digits |
| `--dsh-claude-duration-move` | `200ms` | something travelling along its own track: a fold's door, the reasoning slider's knob and fill |
| `--dsh-claude-duration-count` | `220ms` | a session number counting to its new reading |
| `--dsh-claude-duration-slide` | `240ms` | the segmented controls' sliding highlight, a sidebar icon's quarter turn, the wording box taking the width of the words arriving, and streamed content sliding up from the bottom edge |
| `--dsh-claude-duration-fade` | `300ms` | a slow cross-fade: the theme flip, the titlebar tabs' hover reveal, the reasoning knob's glow, a placeholder handing its place to what it stood for |
| `--dsh-claude-duration-bounce` | `350ms` | a switch's knob travelling across with its double bounce |
| `--dsh-claude-duration-flight` | `400ms` | the sent message flying from the composer to its row |
| `--dsh-claude-duration-step` | `500ms` | one step of the reasoning window's text rising two lines |
| `--dsh-claude-duration-pop` | `500ms` | something popping into place: the overtime badge's own pill |
| `--dsh-claude-duration-rise` | `500ms` | a line of the home greeting rising into place |
| `--dsh-claude-duration-stagger` | `70ms` | how far behind the piece before it a staggered piece starts: the greeting's second line |
| `--dsh-claude-period-dot-orbit` | `2400ms` | one turn of the waiting line's loader dots that swap corners: four quarter-turns of the two pairs, which leaves every dot where it started |
| `--dsh-claude-period-dot-rotate` | `10s` | how long one of the waiting line's loader motions stands before another takes its place, the next one picked so a motion never follows itself |
| `--dsh-claude-duration-reduced` | `0.01ms` | every skin animation and transition under the Reduced animation choice (D40) |
| `--dsh-claude-period-host-sweep` | `1500ms` | one pass of the highlight band across the waiting line's words and a running process group's header |
| `--dsh-claude-duration-host-sweep-delay` | `300ms` | how long the highlight band waits after its words appear before its first pass |
| `--dsh-claude-period-preview-swap` | `4000ms` | one turn of the settings page's waiting-line preview: one wording standing, leaving, and standing again |
| `--dsh-claude-period-preview-reveal` | `4000ms` | one turn of the settings page's new-text fade preview: the sample arriving character by character, then standing before the next wipe |
| `--dsh-claude-period-preview-caret` | `4000ms` | one turn of the settings page's caret preview: the sample line typed out, then standing whole before the next turn |
| `--dsh-claude-period-preview-enter` | `2600ms` | one turn of the Motion tab's message-entrance card: one message arriving, standing, and giving way to the next |
| `--dsh-claude-period-wash-hue` | `4000ms` | one turn of the hue rotation the waiting line's colour wash runs through |
| `--dsh-claude-period-wash-drift` | `5000ms` | one orbit of the colour washes around the waiting line's glyph box |
| `--dsh-claude-period-pulse` | `1600ms` | a placeholder breathing while its numbers are computed |
| `--dsh-claude-period-flash` | `1450ms` | one flash of the reasoning slider's top-rung matrix |
| `--dsh-claude-period-flow` | `4000ms` | one pass of the reasoning slider's top-rung particle flow |
| `--dsh-claude-period-blink` | `1000ms` | one blink of the composer caret |
| `--dsh-claude-period-breathe` | `2400ms` | one breath of the sidebar's ongoing-conversation light |
| `--dsh-claude-period-spin` | `850ms` | one turn of the sidebar's ongoing-conversation ring |
| `--dsh-claude-period-landed` | `1400ms` | the mark on the turn the conversation navigator landed on |
| `--dsh-claude-period-hold` | `840ms` | how long the reasoning window's text stands between two steps |
| `--dsh-claude-period-dot-bounce` | `500ms` | one bounce of the waiting line's loader dots under the Claude brand, and the period each dot's own start is measured against |
| `--dsh-claude-period-dot-line` | `1250ms` | one round trip of the waiting line's loader dots along their own lines, the motion the dots take while the turn is not thinking |
| `--dsh-claude-ease-standard` | `ease` | feedback and surfaces: the default curve |
| `--dsh-claude-ease-out` | `ease-out` | something arriving and settling: a fold's door, content entering the chat area, the landing mark |
| `--dsh-claude-ease-enter` | `cubic-bezier(0.34, 1.3, 0.64, 1)` | a message the reader sends growing into its row: the slight overshoot as it takes its full size |
| `--dsh-claude-ease-in-out` | `ease-in-out` | something that leaves and returns, or swaps in place: wording swaps, pulses, flashes |
| `--dsh-claude-ease-glide` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | travel along a track: the sliding highlight, the reasoning slider, the search dialog's entrance, the reasoning window's step, the wording box's width, the stream's slide |
| `--dsh-claude-ease-roll` | `cubic-bezier(0.4, 0, 0.2, 1)` | digits rolling over: the file rows' tail and the process group header's counts |
| `--dsh-claude-ease-spring` | `cubic-bezier(0.34, 1.45, 0.64, 1)` | a small overshoot as something lands: the overtime badge popping in, a switch's knob bouncing past its end |
| `--dsh-claude-ease-settle` | `cubic-bezier(0.22, 1, 0.36, 1)` | a surface or a page settling into place out of its anchor: menus and dialogs opening and closing, a settings page sliding, the overtime badge sliding onto its line, the greeting's lines rising |
| `--dsh-claude-ease-host-sweep` | `steps(48, end)` | the band across the waiting line's words and a running process group's header |
| `--dsh-claude-ease-harmonic` | `cubic-bezier(0.37, 0, 0.63, 1)` | a loader dot walking its line from one end to the other, and its size between an end and the middle: a sine's simple harmonic, at rest at either end and fastest halfway |
| `--dsh-claude-ease-damped-out` | `cubic-bezier(0.33, 1, 0.68, 1)` | a loader dot's fade in a hand-over that does most of its change early: a walking or swapping dot coming in, a bouncing one going out |
| `--dsh-claude-ease-damped-in` | `cubic-bezier(0.32, 0, 0.67, 0)` | a loader dot's fade in a hand-over that does most of its change late: a walking or swapping dot going out, a bouncing one coming in |
| `--dsh-claude-distance-nudge` | `4px` | the short offset a surface rises from, and a small row's wording swap travels |
| `--dsh-claude-distance-travel` | `8px` | the waiting line's wording swap, a settings page's slide, the overtime badge's sideways slide, and both directions of the waiting line's loader dots: the lift off their floor and the reach along their own lines |
| `--dsh-claude-distance-rise` | `12px` | how far below its place a line of the home greeting starts, and the overtime badge's upward slide |
| `--dsh-claude-blur-soft` | `2px` | the blur words and badges pass through while they swap or pop in, and a placeholder passes through as it hands its place over |
| `--dsh-claude-blur-enter` | `3px` | the blur a settings page or a line of the home greeting passes through as it slides or rises in |
| `--dsh-claude-scale-surface` | `0.98` | the scale a surface grows from as it rises |
| `--dsh-claude-scale-dropdown` | `0.97` | the scale a menu grows from out of its trigger |
| `--dsh-claude-scale-dropdown-exit` | `0.99` | the scale a menu shrinks to while it fades on closing |
| `--dsh-claude-scale-dialog` | `0.96` | the scale a full-window dialog grows from and returns to |
| `--dsh-claude-scale-dot-mid` | `0.55` | how small a loader dot is while it crosses the middle of its line; at either end it is the dot's own size, so the line motion never draws a dot larger than the bouncing one |
| `--dsh-claude-duration-resize` | `300ms` | a surface taking a new size: the model picker's second level following the list a query leaves |
| `--dsh-claude-timing-resize` | `var(--dsh-claude-duration-resize) var(--dsh-claude-ease-settle)` | shorthand: a size change, written after the property in a transition |
| `--dsh-claude-timing-feedback` | `var(--dsh-claude-duration-feedback) var(--dsh-claude-ease-standard)` | shorthand: a control's state change, written after the property in a transition |
| `--dsh-claude-timing-surface` | `var(--dsh-claude-duration-surface) var(--dsh-claude-ease-standard)` | shorthand: a surface appearing, written after the property or the keyframes' name |
<!-- /generated:motion -->

## Layers

A z-index the skin writes is one of two kinds (D9). Inside one box, siblings
are ordered with a literal from -1 to 9: a fill painted under its own content,
a label over its sliding pill, the composer's rows over one another. Anything
that has to clear what the host draws around it — the composer's own controls,
the window's title row, a floating card, a surface over the whole window —
stands on a layer token, and the build refuses any other number.

The table below is generated from `packages/client/src/theme/tokens.json` by `npm run build`;
edit the JSON, not the table.

<!-- generated:layers (packages/client/src/theme/tokens.json) -->
| Token | Value | Use |
|---|---|---|
| `--dsh-claude-layer-control` | `10` | a control kept over the composer card's own stacked rows: the send and stop buttons, the reasoning picker's trigger |
| `--dsh-claude-layer-picker` | `20` | a picker that hangs its card from inside the composer: the permission picker, whose card has to stand over the controls beside it |
| `--dsh-claude-layer-chrome` | `30` | the window's title row the skin draws into: the header band's title and actions, the titlebar's view tabs, over the host's own header |
| `--dsh-claude-layer-float` | `99999` | a floating card or menu over everything the host draws: the popover cards, the hero menu |
| `--dsh-claude-layer-takeover` | `2147483000` | a surface that covers the whole window: the account-hold page, the sent message's stand-in in flight |
<!-- /generated:layers -->

## Text selection

Selection is the one surface that leaves the palette on purpose — it is a
transient gesture, not part of the interface, so it uses the platform's two
solid paints and looks the same on both canvases:

| State | Background | Text |
|---|---|---|
| Window focused | `#3366D0` | `#FFFFFF` |
| Window unfocused | `#C7C7C6` | `#000000` |

Both are solid (never translucent) and `!important`, so they override whatever
colour the text underneath carries — links, inline code, syntax tokens. CSS
cannot read window focus: Chromium reaches the inactive paint through its own
internal `-internal-inactive-selection-*` properties, which a stylesheet cannot
address. `packages/client/src/features/composer/selection-mirror.ts` therefore mirrors `document.hasFocus()`
onto `data-dsh-window-blur` and the stylesheet switches on that attribute; the
selection itself survives the blur.

The window's chrome is not text. The sidebar column and the conversation header
take `user-select: none`: a press on a row or on the session title is a gesture
at the window — on the Windows desktop the caption row is the shell's own drag
region — and the drag that follows must not paint a selection across the labels
it passes. The transcript, the composer's draft and a text field inside the
chrome keep their own selection, which Chromium grants an editing host under a
locked ancestor.

The session title is the session's name, and a press on it renames the session.
The pointer over the title's last crumb raises a plate under the words — the
host's own crumb already carries the padding and the radius — with a tip under
the segment naming the press, in the label ink on the canvas tone the usage
panel's day tip uses. The segment carries the tip rather than the words because
the host clips a crumb's overflow for its ellipsis. The press opens a field over
the words' own line: canvas fill, a 1px ring in the selection blue, a 4px radius,
and 1px to either side of the words with 3px above and below them, so the ring
hugs the name the way Claude's own field does rather than laying a card over it.
The field stands in the page's own space, so the reader's zoom keeps it on the
title; a rename the host refuses keeps the field, ringed in the host's error
tone.

## Markdown material

A quote is a **container**, not a link: it keeps the prose face on a neutral bar
and wash (text `#B0AEA5`, light `#6E6A60`), and whatever sits inside it keeps its
own material — links stay blue, inline-code chips stay warm red, file mentions
stay link-blue. Never paint the quote itself with the link colour: the colour
inherits into the block's inline code and mentions, which is exactly the leak
that made every path inside a quote read as a link.

**Inline file mentions are links, not code.** The host resolves a file path
inside an inline code span to a button (`.fileMention`, hashed — match it with
`[class*="_fileMention"]`) and paints it with its link alias. The generic
inline-code chip rule is more specific than that class, so a mention inherits
the chip's warm red unless a rule names it. A mention takes the link blue, weight
500, and the link's underline (solid in the link tone at rest, solid and fully
opaque on hover, same thickness and offset — the same treatment the skin gives an
anchor); the chip itself is left alone — the same fill, hairline, radius and
padding as any other inline code. Plain inline code keeps its warm text. Note the
hover rule must set only `text-decoration-color`: the `text-decoration` shorthand
resets `text-decoration-thickness` to `auto` and thins the line mid-hover.

## Inline code

The chip hugs its glyphs. The host builds it as an `inline-flex` box that
inherits the prose line box — 23px for a 15px code size — which left ~5px of
empty wash above and below the text. The skin sets `line-height: 1.2` on inline
code (27px → 22px, with the 1px padding as the visible inset); lower values
start clipping descenders. The fill, hairline, radius and size are unchanged.

## Popovers · 多选一弹层

Every single-choice popover in the skin — the permission menu, the model picker,
the account drawer, and the host's own menu primitive under the hero row's
workspace and preset pickers — is meant to start from one recipe. New popovers
take it rather than inventing a card.

Two rules hold across all of them, both owned by `shared/popover.ts`. A
pointer opens a card only after a **100 ms dwell** — long enough that crossing a
28px trigger on the way somewhere else unfolds nothing — and the card closes
100 ms after the pointer leaves. One card keeps its own number with the reason
written where it is used: the model picker's levels close after 150 ms (the
pointer has to cross level 1 to reach level 2). And **only one card is on screen
at a time**: each popover registers its close path with `registerPopover(name,
close)` and calls `closeOtherPopovers(name)` on the way open, so opening the
model picker folds the permission menu, the account drawer and the host's hero
menu.

The context meter's popover is the host's own panel (it portals it, places it,
and dismisses it), so the skin drives its trigger on hover and paints nothing of
the shell itself. What it carries is described under "Context popover" below.

**Card**

| Property | Value |
|---|---|
| background | `var(--dsw-alias-bg-overlay)`; dark `#1e1e1d` |
| border | `1px solid var(--dsw-alias-border-l1)`; dark the same stroke, which the dark ladder makes a highlight. The edge stays the card's own border: the box the placement reads and the opening animation scales keeps the paint path it has always had, and no stroke is drawn inside it |
| radius | 12px |
| shadow | `0 8px 24px rgba(20,20,19,.12), 0 2px 6px rgba(20,20,19,.08)`; dark `0 8px 28px rgba(0,0,0,.65), 0 2px 8px rgba(0,0,0,.45)` |
| padding | 6px |
| layout | flex column, `gap: 6px`; a list body stacks its rows 3px apart |
| z-index | 99999, above the host's own menus (1100) |
| open | `opacity 0 → 1`, `translateY(4px) scale(.98) → none`, `.15s ease`, origin on the anchor's side |

**Row**

| Property | Value |
|---|---|
| min-height | 32px — a floor, not a cap: a two-line row grows |
| padding | `2px 7px` |
| radius | 6px |
| text | 13px / 20px, `var(--dsw-alias-label-primary)` |
| hover | `var(--dsh-claude-hover-bg, rgba(0, 0, 0, .08))` |
| icon | 16px, `var(--dsw-alias-label-secondary)` |
| two-line row | name 13px / 16px at 500; description 11px / 14px in `label-tertiary` |
| current row | trailing `IconCheckOutline16` in `var(--dsw-alias-brand-primary)` — the accent is what marks the choice |
| disabled | `opacity: .4`, `cursor: not-allowed` |

**Heading, separator, footer**

- heading row: 11px / 16px at 600, `letter-spacing: .04em`, uppercase, `label-tertiary`, `padding: 6px 7px 2px`
- separator: `0.5px` `var(--dsh-claude-divider)` — one rung below the lightest
  border — `margin: 2px 4px`, drawn as a top border on a zero-height box. One
  rule in the shared shell covers every separator in a card, the host's own menu
  separators included, so the line is one thickness wherever it appears and does
  not follow the card's opening scale
- pinned footer: `margin-top` / `padding-top` 4px, and the same `0.5px` divider
  line above it

**Host surfaces**

The host's dropdown menus are one shared primitive (primitives' `Menu`), and its
two class-name families hash in opposite directions: the primitive ships inside
the web shell as `_<local>_<hash>_<n>` (`_itemWrap_1nxmc_92`,
`_itemLabel_1nxmc_174`), while the client-ui packages hash as `<hash>_<local>`
(`daogkW_itemName`, `p_FcLG_cardWorkspaceTrigger`). A substring matcher therefore
takes the longest stable piece of whichever family it targets — `_itemWrap_`,
`_itemLabel_`, `_viewport_` on one side, `_itemName`, `_itemDesc` on the other —
never the bare local name.

The hero row's two pickers are that primitive, portaled to `<body>` with no
marker of their own. `packages/client/src/features/hero-menu/hero-menu.ts` stamps the open card with
`data-dsh-claude-hero-menu` and `features/hero-menu/hero-menu.css` restyles it; the
host's other menus (sidebar row menus, the settings permission row, submenus)
keep the host's own design on purpose. What that replaces: a 20px radius card
with 4px padding, 40px rows at 10px radius, and 14px text.

The stamp's value names the picker (`workspace` or `preset`), because the two
cards differ. The preset card keeps the popover table's 32px rows for its
two-line entries. The workspace card is Claude Code's folder menu: a 180px-min
card with 4px padding, 26px plain-text rows (no folder glyph in front of each
folder, no `＋` on the pinned add row) and the accent check on the current one.

**The account card** is that primitive too, and it carries the skin's rows
inside it. The host mounts it with nothing but its own three entries and places
it from that geometry; `features/account/surface.ts` injects the skin's container
a frame later, the card grows, and the host re-places it on the frame after the
list changed. Nothing may be painted in between: the card would fade in at the
height and the place it is about to leave — low, then jumping up mid-fade. So
while the account row is armed the card stays unpainted (the same armed window
that carries its one-shot entrance), and the feature stamps
`data-dsh-claude-account-ready` once the skin's rows are inside it and its
placement has been read twice with the same value. The entrance animation hangs
on that stamp, so it plays on the card the reader will actually see.

## Context popover · 上下文弹层

The context meter's popover is the host's own panel: the skin opens it by
pressing the host's trigger (hover, with the shared 100 ms dwell and close
grace, gated on the "open popovers on hover" preference; a click still works),
and paints nothing of its shell or its dismissal. It mounts
instead of toggling `data-open`, so the feature stamps the panel and it takes
the cards' own short rise as a one-shot animation — same 4px, same `scale(.98)`,
same 0.15s — and a surface the skin opens arrives the same way wherever it is
the host's.

Its horizontal place is the one thing the skin takes over. ui-chat hangs the
panel from the anchor's LEFT edge and only then clamps it into the viewport
(`useStatDialog`, align `start`), so a trigger at the end of the composer row
leaves the panel against the window's right margin instead of under the ring.
`features/context-stats/stats-binding.ts` reads the meter's right edge and the
panel's own layout width — `offsetWidth`, not its rect: the entrance scales the
box, and a transformed rect is two per cent narrower than the one that settles —
and writes `--dsh-claude-context-panel-left` with the mark that turns it on;
`features/composer/inline-bar.css` reads it with `!important`, which outranks the
host's inline value. The reading is re-taken when the panel's box changes (a size
subscription on the observation bus) and when the viewport moves (`reposition('viewport')`).

What the skin appends to it is the session's numbers
(`features/context-stats/session-stats.ts`), read from the host's `sessionStats`
and `tokenUsage` projections — the same durable whole-log values the host's own
pills render — never by opening the host's stat dialogs. The labels and the
duration / token templates come from the host's `chat` locale namespace, so the
two surfaces read the same words; the host's small formatting rules
(`formatDuration`, `formatTokensPerSecond`, `formatExactTokens`,
`formatCacheHitPercent`) are mirrored so the figures match character for
character.

The cost is the session's own. The host half prices every settlement at its
own instant and route and answers the settled total over `SESSION_COST_PATH`;
the browser adds the tokens the streaming answer has grown by at the output
rate in force, so the figure moves with the written-back tokens and settles
with them. It writes four decimals and the symbol of the `billingCurrency`
setting (`¥0.0015`, `$0.0002`): the official CNY and USD tables are stored
apart, so the setting picks a table rather than converting one. A model the
official table does not carry is priced from the snapshot's catalogue — its
published CNY line when the vendor has one, its USD list price converted at the
snapshot's fixed rate otherwise; a model neither carries keeps the segment out
of the line. On the line it
stands between the written-back tokens and the cache share, and it is among the
figures the ladder gives up when the line needs the room for the total; in the
block it is the usage section's first row.

The segment keeps its width across a session switch: the session's figure is
replaced while the next one is being priced, so the amount sits in a box of an
amount's measure, right-aligned so a growing figure extends left, and the box
stands as the currency symbol and a dash in `label-tertiary` until the new
figure arrives. Without it the segment folds out of the line and back, and the
whole bottom line re-lays around it. The `billingCurrency` choice's Off takes
the segment out of the line altogether: nothing is drawn, and the browser asks
the host for neither the price table nor the session's total.

Which figures appear follows the host's statistics row. Its detailed form gets
the whole list. Its compact form carries only the output speed and the cache-hit
share on the composer line, so the block keeps the four that row leaves out —
the total time, the first-token average, the output speed and the cache-hit
share. The total is the one figure the host has no word for (its dialog names
the model's time and the tool calls' separately): it is their sum, labelled from
the skin's own copy (`contextTotalTime`).

The block: a 1px `var(--dsw-alias-border-l1)` rule and 10px above it, then per
section an 11px / 16px heading at 600 in `label-tertiary` and a two-column grid
(6px by 10px). A row is a stack: 12px / 16px label in `label-tertiary` over a
14px / 20px value at 500 in `label-primary`, the value in tabular figures so
numbers do not dance as they change. Rows follow the host's own rules — one
appears only when its input exists — and the block is rewritten on every
projection frame while the panel is open.

While the projections have answered nothing, the block holds the numbers' place
under the two real headings: bars at a row's own 37px (16 + 1 + 20) in the host's
solid hover fill, pulsing over 1.6s (still under the reduced animation choice).
The place is given up after 2s, so a host that serves no such projection ends at
the panel it drew itself rather than keeping placeholder bars.

**All five are aligned**: the account drawer was the outlier
(8px row radius, 2px and 4px card gap, 8px padding, 220 / 260px min-width,
z-index 1000 and 100000) and now follows the table above. The hero row's pickers are the host's own menu primitive, which differs in
two ways that CSS cannot change: it mounts instead of toggling a `data-open`
attribute, so it takes the same fade/scale as a one-shot `0.15s` animation; and
the host places it *below* its trigger, which is where the composer sits — so
`packages/client/src/features/hero-menu/hero-menu.ts` re-places it on the trigger the way the
skin's own composer pickers sit: right-aligned with the trigger and opening
upward by the same 6px air, flipping below only when the viewport leaves no room
above, and clamped to the 8px viewport margin (`POPOVER_MARGIN`). The host
re-runs its own placement from its anchor geometry on every frame while the card
is open, so the position is handed over in two custom properties on the card
(`--dsh-claude-hero-menu-x` / `--dsh-claude-hero-menu-y`, written by the same
pass that stamps it) which `features/hero-menu/hero-menu.css` reads with
`!important`; that declaration outranks the host's plain inline value.

## Context meter · 上下文计量

**The trigger is a pie.** Where the host draws a ring of two circles, the meter
draws two sectors on one centre: the share taken in the colour its occupancy fell
on, the rest of the plate in the quiet tone beside it. The smaller share keeps
the box's radius (8px) and the larger one steps in by up to 1.3px — half the
lift — so a lopsided split reads as the smaller part standing out to the edge,
15% and 85% mirror each other, and an even split is two half discs of one radius;
the step eases to nothing as the split comes even. The seam is one width, 1.2px,
shared between two strokes by the split: the occupied sector's stroke runs from
the whole width at nothing taken to nothing at everything taken, the plate's is
the mirror, and each is half the width at the even split. Each sector is cut by
the stroke around the other's path, so the seam follows the whole boundary — both
radii, the outer arc and the apex — and the two edges move with the split as the
reading crosses the middle. The part that stands out is painted last: the plate
above the even split, the reading's colour below it. The pie is 16px across, one
pixel more than the ring's 14px cell on each side, and concentric with it; the
ring keeps its cell and is hidden while the pie stands, so the trigger's layout
and the room the composer keeps for it are the host's. The occupied sector takes
the reading's own colour (the occupancy ramp, below), the plate the quiet tone
beside it.

**The line of numbers.** On its own line under the card, each figure is plain
text in the line's type (13px / 500, tabular figures), not a run of per-character
spans: a reading that moves is chased from the value on show, closing about two
thirds of the distance every 73ms and the rest within 220ms, a reading that lands
mid-count becomes the new destination, and another session's numbers are chased
from the ones on show too. Only the cache share's figure and the percent sign
after it wear the band; the words before them keep the line's tone. A card too
narrow drops figures in a fixed order, and the widest step folds each token
figure into k / M / B.

## Search · 搜索

**Sidebar box.** The box takes the brand's place in the logo row while the
pointer is over the sidebar: 28px tall, 8px radius, a 1px `#E8E6DC` hairline on
the ivory canvas fill (dark: `#2E2C29` on `#1E1E1D`), a 16px search glyph in the
secondary label, the "Search" label in the tertiary label at 14px, and the
host's search shortcut as 20px keycaps at the right end. The New session row's
own shortcut wears that same keycap: a 20px box with a 1px hairline, 4px radius
and 12px secondary ink, and the `+` the host writes between the two keys goes,
the way the box leaves it out. It is a button like the New session and Plugins
rows below it: the pointer cursor, and on hover the same plate those rows take
(`--dsh-claude-hover-bg`, dark `rgba(255, 255, 255, 0.08)`) laid over its
opaque fill. Box and brand share one grid cell and cross-fade over 0.16s, the
timing the workspace heading and its segmented control trade places with; the
box is excluded from the window drag region. Standalone gives the box a row of
its own under the brand row, shown without a hover; that row adds no inline
padding, so the box's hairline stands on the two edges of the column's own
inset and is exactly as wide as the New session plate below it. In the desktop
titlebar mode the brand row rises 6px, since the sidebar column starts under
the 40px titlebar — as far as it goes with the box still wholly below that
edge, which clips the column. A box narrower than 200px keeps its glyph and
label and leaves the keycaps out.

**Palette.** A modal card set 8vh from the top, 760px wide at most, 16px radius,
on the same ivory fill (dark `#1E1E1D`) under the host's mask. From the top: a
17px borderless input with a 28px close button; the category chips (32px tall,
8px radius, 14px, tertiary at rest and primary when current) sharing one
sliding highlight at `rgba(20, 20, 19, 0.06)`; the list, capped at
`min(520px, 62vh)`, with 13px tertiary section captions and 40px rows (8px
radius, 15px title, an 18px glyph in the secondary label, a 13px tertiary detail
after the title and an optional 13px tertiary excerpt line under it, the match
inside it in the primary label at weight 500 with no fill); a hairline-topped footer
of hints with 20px keycaps. The input text, the chips' text, the captions and
the row glyphs all start on one vertical line 24px in from the card edge. The
highlighted row takes `rgba(20, 20, 19, 0.05)` (dark `rgba(250, 249, 245, 0.07)`)
and shows the Enter glyph; the others hide it. The card fades in and settles
from 6px above at 98.5% scale over 0.18s; on close card and mask fade out
together over 0.14s before the modal unmounts.

## Chat / Code switch · 聊天 / 代码切换

With ds-bot installed, the switch is two 28×22 options on a 2px-padded plate
with a 7px radius, each option 5px: chat bubbles and `</>`, 16px glyphs in the
1.3px stroke the sidebar's glyphs use. It is painted on both sides of the switch
by whoever paints the host's tokens — the theme on the Code side, ds-bot on the
Chat side — so the plate is a translucent tint (`rgba(20, 20, 19, 0.06)`, dark
`rgba(255, 255, 255, 0.08)`), the options take the tertiary label at rest and
the primary on hover, and the checked one is cut from the conversation canvas
(`--dsw-alias-bg-base`) with a 1px `rgba(20, 20, 19, 0.10)` drop (dark: a
`rgba(255, 255, 255, 0.14)` fill and no drop). On the desktop it stands in the
caption row, its right edge 12px inside the sidebar column's, centred in the
row, and leaves the screen while the column is too narrow to keep 8px clear of
the controls at the row's left end; on the web it is a cell of the sidebar's
first row, before the collapse toggle. It moves nothing: there is no
transition, since the press hands the whole page to the other side.

## The waiting line · 模型正在做什么的那一行

The host's running row, its divider and its live region stay as the host draws
them. Its whale tail is DeepSeek's own character, so under the Claude brand the
skin hides it and leads the line with its own loader: three 4px dots of the
accent in force in an 18 × 14 box, resting on the floor, and the motion they
play follows what the turn is doing (`features/chat-wait/wait-loader.ts`). While
the model thinks they bounce — each rising the skin's 8px and flattening against
the floor as it leaves, half a second a bounce with the second dot starting two
fifths of the period behind the first and the third three fifths. While the turn
writes or works they leave that bounce and walk three lines through one point,
120° apart with the second line run the other way: each dot is a damped simple
harmonic along its own line, the whole line taken in 1.25s, dwelling at either
end at the dot's own size and shrinking to 0.55 as it crosses the middle, so no
frame of the line motion draws a dot larger than the bouncing one. The two never
cut: the lane leaving fades each of its dots out over one of its own legs,
starting where that motion next turns back — off the floor for a bounce, off a
far end for a walk — and the lane arriving fades each of its dots in over one of
its own legs, starting where that motion next carries it, so no dot is ever moved
to a pose its motion does not carry; a motion stands for 2s before the next may
take it over. Under the
other brands the host's whale stands. The host's own
shimmering words step aside for the skin's line beside it: the wording in the
secondary label at 14px on a 24px line,
the turn's clock 8px later in the caption at 13px with tabular figures, and the
"No response yet" badge 8px after that (11px on a 16px line, 0 6px padding, a 5px
radius, the warning label over 16% of itself). The line takes the row's own
width and gives way inside it: the words are carried whole, so a clause the row
has no room for is clipped where the room ends and the copy draws an ellipsis,
with the loader, the clock and the badge keeping their places. The wording wears
one of two paints, whichever the Motion tab's Waiting-line animation holds: a
highlight band swept across it the way the host's own rows sweep — 1.5s a pass
with the band resting the last third of it, in the host's shimmer tint — or a
colour wash, the seven radial washes of `packages/client/src/shared/motion.css`
over a grey ramp, orbiting the glyph box (5s an orbit while the hue turns a full
circle over 4s), which is the effect transitions.dev ships as its Pro gradient
text. A wording that changes runs both halves of the swap at once and is over in
0.2s: the old one
leaves upward with a 2px blur while the new one, parked one gap, enters from 4px
below; under Reduced motion the band is left out, the wash holds its still frame,
and the wording is written at once. The Motion tab's preview cards
wear these same two paints (`packages/client/src/features/settings/settings.css`)
and take turns between a state word and the host's own word for a wait, so a card
shows the wording swap as well as the paint.

With the chat area's own follow on, the row is pinned while the conversation
follows its tail, at the place that follow's glide comes to rest — the
composer's own height, the fade band above it and the host's 16px transcript
padding — the canvas painted behind it, since the transcript's tail would
otherwise show through. The pin stands only while the host reports the tail (or
the stream glide holds the position) and steps aside for the reader's own
scrolling.

## Home layouts · 首页版面

The new-conversation page has two arrangements. `homeLayout` (settings: Home
layout) writes `data-dsh-claude-home-layout` onto `<body>` and
`packages/client/src/features/home/home-panel.css` branches on it. Both are the host's own
hero markup — the greeting, the workspace row, the dock and the composer card
inside `…_composerStack …_composerHero` — so only the arrangement differs.

| | Classic | Studio |
|---|---|---|
| greeting | centred, 44.2px serif, brand mark on its line | top left, one fixed line naming the user ("What's up next, …?") in the 20px sans UI face, a 21px brand mark on its line |
| composer card | vertically centred in the scroll body | the conversation's single-line inline form, resting on the window's bottom edge (16px foot) |
| between them | — | the usage panel |
| permission control | the segment group | the conversation's trigger and its card |
| workspace / preset row | the card's footer tray | hairline chips directly above the card |
| column width | the hero's centred box | a 720px composer column; the greeting and the panel form a 480px block against its left edge |

The studio composer is stamped `data-composer-variant="inline"` (composer.ts's
pass reads the same preference), so the home card is drawn by the conversation's
single-line stylesheet. The classic tray rules in `features/composer/card.css` are scoped
away from studio with `:not([data-dsh-claude-home-layout="studio"])`. That is
deliberate: they set `order: 1` / `order: 2` on the same boxes, and a competing
rule would have to be out-specified rather than merely reordered — scoping them
removes the contest.

**The usage panel.** It is a `conversation.input.dock` entry (the host's list
seat between the greeting and the card; a list seat keys its entries by `id`),
and it renders only in the hero phase — the host mounts that same seat inside a
conversation, where the todo, queue and goal bars hang on it. The seat is scoped
to a session, so the cold start screen (no session yet, the card waiting for a
workspace) has none; there the skin mounts the same component on a
`display: contents` element of its own (`.dsh-claude-home-seat`) and drops it
once the host's dock arrives. A window too short for the whole panel shrinks the
panel, never the page: the greeting keeps the top edge, the chips and the card
keep the bottom, and the panel scrolls between them with a 32px fade over its
bottom edge that lifts over the last 32px of travel.

The cold start card waits for a workspace: the host marks it with a dashed ring
and makes every control on it inert, so a press anywhere opens the workspace
picker. In the studio form the ring sits on the single-line input box itself
(the host's dashed stroke and colours, flat, no drop shadow), and the permission
trigger fills the card's empty mode strip on the preset a new session starts in
— disabled, like the rest of the card's controls.

The panel is Claude Code's dashboard shape: a flat warm-gray wash (a
`color-mix` of the label tone at 4% over the card tone, which flips with the
theme on its own), an Overview/Models tab pair on the left of its head, and the
All/30d/7d range pills on the right. The active tab and range pill are a gray
chip one step below that wash — half the radius the 20px control would round to,
so it reads as a rounded rectangle rather than a full pill. Overview carries six
stat cells in a 3×2 grid under Claude Code's names (Sessions, Messages, Total
tokens, Active days, Peak hour, Favorite model) whose tiles sit one clear step
deeper than the panel (15% of the label tone) and set a 12px label over a 13px
bold figure — the figure stays barely above its own label, which is also what
lets a long model id such as deepseek-v4.1-flash sit on one line; the favourite
model is a name, not a figure, and keeps the regular weight. Messages are the
settled calls. Once the picked range's total passes one
book, the yardstick line appears under the grid: sixty-five books from Tao Te
Ching (7.6k tokens) to In Search of Lost Time (1.6M), the public-domain ones
measured by feeding their full text to the o200k_base tokenizer (the English
original or the standard English translation; Faust in German) and the rest
estimated (1.3 tokens a word for English, 0.96 tokens a character for modern
Chinese prose). The line states the rounded multiple as a share of the book
("~2× the tokens in Moby-Dick"), never as an excess over it.
The book is drawn afresh each time the page comes back to the new-conversation
hero, and a range that has not reached it steps down to the longest book it has
passed, so the range pills keep the same book whenever the totals allow. The heat
grid takes one
equal column per week (twenty-six weeks), square cells from a 3px gutter, in
Claude Code's blue data ramp (`#3b6ecf` mixed in at the shares `HOME_HEAT_RAMP`
in `packages/client/src/constants.ts` lists, over the neutral empty cell); because the columns are fractions of the panel's own width, the newest
week can never fall past the edge. Hovering a cell shows Claude Code's day tip at
once: a solid pill in the label ink with the canvas tone for text (so it inverts
with the theme), 13px medium, reading the day in the shell's language and the
tokens that day spent ("Sep 9 — 15.9k tokens"), the same figure the cell's heat
is bucketed from; the pill is centred on its cell except where its own width
would carry it past the panel's edge, and there it lines up with that cell's
outer edge so it stays inside the panel, and it stands above its cell except
where the cell holds more room below it, and there it hangs under the cell so it
never reaches over the grid's top edge across the stat cells; the pill's own
width and height are read off the cell the
pointer is on (`packages/client/src/features/home/heat-tip.ts`).
Models is Claude Code's own shape: one column
per day of the chart's thirty-day window, stacked from the axis up with each
model's slice in its rank's colour (ranks past the ramp share its last, grey
step), four gridlines with their token labels in a 34px left gutter and every
third column's date under it in the shell's language ("Aug 26"), and beneath it
the ranked list — swatch, model name, the input/output split, and the share of
the models shown — folding past six rows behind one "show more" row, which turns
into "show less" once the list is open. The chart
and the list write counts Claude Code's way: one decimal at most, no trailing
".0", a lowercase k ("109M", "963.6k"). The list reads the roll-up's per-model
buckets; the chart reads its per-day per-model map, so a day with nothing
attributed to a model draws no stack. Each column is sized to its day's total
against the axis top and each slice to its share of the day, so the column's
rounding sits on the top of the stack. A range window filters the
tiles (the peak hour included), the yardstick line and the model list; the heat
grid and the chart keep their own windows.

Two sources, in this order: the host half's usage route, then the session list's
own projection block (`tokenUsage`, `modelSelection`, `sessionListMetadata`).
The second answers in a few milliseconds and carries per-model totals without the
four buckets, which is what the list falls back to when the first cannot answer.
The first reads the cost-meter ledger for the days it knows — its
`<provider>:<model>` split becomes the per-model cells, one model across providers
merged into one — takes the dates past the ledger's newest day from the accurate
per-event fold, and keeps the two apart by date rather than adding them; the
sessions behind the ledger's days and the logs written on the folded ones are one
union. Both carry each day's session ids, which a range window unions into one
distinct session count. Only the fold knows the settlement hours: it keeps one
hour histogram per day, which a range window sums into its own peak hour, and the
ledger's own days carry none — the ledger's figures land first, and the peak hour
of the folded days lands a moment later. The panel names
which one it drew from, and a figure neither can answer is a dash.

The skeleton keeps the frame's geometry — six fixed-size stat cells, a heat grid
of a fixed cell count, and on the models tab the chart's frame with three
stand-in rows — and the heat grid's empty cell **is** the zero step, so "no data"
and "a day with no usage" stay different things: a missing value draws a
placeholder, a zero day draws the grid's own base tone.

## The composer crab · 输入卡片上的螃蟹

Claude Code's pixel crab is the mascot under the Claude brand (or when picked in
the Mascot row). It stands where Deepy does — the composer card's top edge on
both home layouts, the input area or the panel that replaces its card in a
conversation (unless Where it appears keeps it to the home page) — and follows
the same states with the same keys. It is drawn on a 52×36 grid of cells at 2px
a cell, crisp (`pixelated`, 104×72px): feet on the bottom row, on the edge of
what it stands on; the right claw four cells in from the grid's right edge, so
it stands 8px inside the card's right edge, where the 18px corner starts to
round, and the four spare cells take a lean, a note or a sparkle. The resting
crab — shell 16×12 cells, claws 4×4, eyes 2×2, four legs 2×4 — is 48×32px
(columns 24–47, rows 20–35) and only it takes the pointer. The shell is the clay
accent `#d97757` in both themes, the side-on back `#b9603f`, the eyes `#141413`;
the props (the laptop, the thought bubble, letters, notes, the hard hat) are an
ink mask filled with the tertiary label ink. Every frame lasts 80ms, Claude
Code's pace. Its laptop frames are Claude Code's own routine; the rest are drawn
by `scripts/draw-crab.py` after the same character. With the animation choice
resolved to "reduced" each state holds its still frame; a click or a pull still
plays its reaction.

| State | Animation | Still frame |
|---|---|---|
| idle, every 20–40 s a look around, a claw wave or Claude Code's whole laptop routine | `idle`, `idle-look`, `idle-wave`, `idle-laptop` | 0 |
| the model reasons or has not answered: eyes up to a thought bubble | `thinking` | 18 |
| the model writes or tools run: 1 / 2 / 3+ sessions at work (typing / headphones / typing in a hard hat) | `typing` / `music` / `building` | 0 / 0 / 0 |
| subagents running: 1 / 2+ (headphones / conducting) | `music` / `conducting` | 0 / 0 |
| a compaction runs: squashed | `compacting` | 3 |
| an approval, a question or a plan review waits: an exclamation mark | `notification` | 0 |
| a tool call or a turn failed (4.8 s): crossed eyes, a shake | `error` | 4 |
| a turn or a compaction finished (5.2 s): hops, claws up | `happy` | 3 |
| a quiet minute / the next pointer move or key | `sleeping` / `waking` | 0 / 11 |
| a click on the left / right half, four quick clicks, a pull | `poke-left` / `poke-right`, `tickle`, `drag` | 0 |

## Deepy · 小鲸鱼

Under the DeepSeek brand (or when picked in the Mascot row) the mascot is
Deepy, the pixel whale of the Deepy theme pack: a 52×52 grid of logical pixels drawn at 2px a pixel (a 104px
square), its ground line — row 48.5, the middle of its shadow — on the top edge
of what it stands on. Every sheet's crop box reaches 3px past that ground line,
and the whale paints over the host's cards, so its box is lifted by those 3px:
the sprite's last row lands on the card's top edge, and the shadow's tail stays
off the card instead of being stamped across it. Its box is 8px in from the
right end of the card it stands over. On the home page that is the composer card
(both layouts); in a conversation it is the whole input area, and the panel that
replaces the card while the reader is asked for something (those panels start
6–8px above their card). Every frame lasts 50ms. The sheets carry five device
pixels to a logical pixel and are scaled down smoothly, so the whale stays crisp
from 1× to 2× screens without `image-rendering: pixelated`, which would drop
rows on a downscale. The body is Deepy's blue `#4E6FFF` with a navy `#142660`
outline and a white belly in both themes; on the dark canvas the outline and the
soft shadow recede and the blue body carries the shape. Only the resting body
(columns 12–44, rows 30–48) takes the pointer. With the animation choice
resolved to "reduced" each state holds its still frame; a click or a pull still
plays its reaction.

| State | Animation | Still frame |
|---|---|---|
| idle, every 20–40 s a look around or a spout | `idle`, `idle-look`, `idle-spout` | 0 |
| the model reasons or has not answered | `thinking` | 20 |
| the model writes or tools run: 1 / 2 / 3+ sessions at work | `typing` / `music` / `building` | 16 / 0 / 0 |
| subagents running: 1 / 2+ | `music` / `conducting` | 0 / 6 |
| a compaction runs | `compacting` | 20 |
| an approval, a question or a plan review waits | `notification` | 12 |
| a tool call or a turn failed (4.8 s) | `error` | 24 |
| a turn or a compaction finished (5.2 s) | `happy` | 44 |
| a quiet minute (no work, no pointer move or key) / the next pointer move or key | `sleeping` / `waking` | 10 / 29 |
| a click on the face / the tail, four quick clicks, a pull | `poke-left` / `poke-right`, `tickle`, `drag` | 0 |

## Implementation notes

- Every rule is scoped under `body[data-dsh-claude-style]`.
- Dark tokens are the base; light overrides use `:not([data-ds-dark-theme])`.
- A surface's stylesheet sits beside its feature under `packages/client/src/features/<feature>/`;
  the look no single feature owns is in `packages/client/src/theme/`, and the parts several
  features share (the popover card and rows, the sliding highlight) are in
  `packages/client/src/shared/`. The host selector discipline and the style checks the build
  runs are in `docs/adr/` (D3, D9, D30).
- The page's scale (settings › General) is the `zoom` the theme sheet puts on the body, so a
  length written into the page is read in a smaller space than the one a bounding rect is
  measured in: code that turns a measured box into a written length goes through
  `packages/client/src/shared/page-zoom.ts`. The host's own floating cards write a measured box
  whole: `packages/client/src/shared/page-scale.ts` gives each one a space one pixel to one
  pixel with the window (D81), and a rule that caps a card against the window reads
  `--dsh-claude-page-height` / `--dsh-claude-page-width` rather than `vh` / `vw`.

