/**
 * The host class names the skin reads, as data (D3): host CSS-module local name
 * → the skin's own part name.
 *
 * The host hashes its class names (`_2H3hWW_root`, `_root_38jqx_3`), so a
 * stylesheet cannot match one whole, and a substring match takes whatever else
 * holds that fragment — `title` also names `titleRow` and `subtitle`, `row`
 * also names `grow` and `arrow`, `rail` also names `trailing`, and another
 * plugin's class name can hold it too. core/parts.ts walks these tables and
 * writes the part names onto the element, so every rule matches one attribute
 * whole.
 *
 * Each entry is one exact local name. A local name that means different things
 * in different places is read in the region it belongs to: the composer's
 * `row` and the sidebar's `title` are their own regions' names.
 *
 * This file is data only, so the build reads it directly (scripts/css.mjs, the
 * part gate) and holds every part a stylesheet reads to the table here. A host
 * rename is one line in this file.
 */
import { ACCOUNT_MENU_ATTR, HERO_MENU_ATTR } from '../constants'
import { CONVERSATION_HEADER_SLOT_SELECTOR, CONVERSATION_SCROLL_SELECTOR, RIGHTBAR_COLUMN_SELECTOR, ROOT_SLOT_SELECTOR, SIDEBAR_SLOT_SELECTOR } from '@dsh-claude-style/contracts/dom'

/** Host CSS-module local name → the skin's part name. */
export type PartTable = Record<string, string>

/** The shell's three columns, read from the root slot down. */
export const FRAME_PARTS: PartTable = {
  sidebarCol: 'sidebar-column',
  centerCol: 'center-column',
  rightbarCol: 'rightbar-column',
}

/** The sidebar, from its slot anchor down. */
export const SIDEBAR_PARTS: PartTable = {
  logoRow: 'logo-row',
  brand: 'brand-button',
  brandIdentity: 'brand-identity',
  brandMark: 'brand-mark',
  brandName: 'brand-name',
  railMark: 'rail-mark',
  toggle: 'sidebar-toggle',
  panelIcon: 'panel-icon',
  newSession: 'new-session',
  newSessionLabelMask: 'new-session-mask',
  newSessionContent: 'new-session-content',
  newSessionShortcut: 'new-session-shortcut',
  separator: 'key-separator',
  panelList: 'panel-list',
  panelRow: 'panel-row',
  regionArea: 'region-area',
  footArea: 'foot-area',
  footerActions: 'footer-actions',
  footerButtons: 'footer-buttons',
  settingsArea: 'settings-area',
  sectionHeader: 'section-header',
  sectionLabel: 'section-label',
  sectionActions: 'section-actions',
  headerActionsHidden: 'section-actions-hidden',
  treeBody: 'tree-body',
  groupSection: 'group-section',
  projectRow: 'project-row',
  sessionRow: 'session-row',
  title: 'row-title',
  projectText: 'row-project-text',
  time: 'row-time',
  rowActions: 'row-actions',
  iconButton: 'row-icon-button',
  slot: 'row-slot',
  folder: 'row-folder',
  folderActive: 'row-folder-active',
  chevron: 'row-chevron',
  arrow: 'row-arrow',
  active: 'row-active',
  selected: 'row-selected',
  menuOpen: 'row-menu-open',
  searchSlot: 'search-slot',
  searchButton: 'search-button',
  triggerRow: 'settings-trigger',
  list: 'list',
  listArea: 'list-area',
}

/** The conversation's header, from its slot anchor down. */
export const HEADER_PARTS: PartTable = {
  header: 'conversation-header',
  headerLeading: 'header-leading',
  titleRow: 'title-row',
  titleCluster: 'title-cluster',
  crumbs: 'header-title',
  crumbSeg: 'header-crumb',
  headerActions: 'header-actions',
  headerUtilities: 'header-utilities',
  headerCorner: 'header-corner',
  tabs: 'view-tabs',
  tab: 'view-tab',
  tabActive: 'view-tab-active',
  label: 'header-label',
}

/**
 * The conversation's scrolling body: the transcript and the composer seat under
 * it, so the composer's own parts are read here too.
 */
export const CONVERSATION_PARTS: PartTable = {
  viewArea: 'view-area',
  scrollBody: 'scroll-body',
  composerSeat: 'composer-seat',
  composerStack: 'composer-stack',
  markdown: 'markdown',
  tableScroll: 'table-scroll',
  fileMention: 'file-mention',
  fileLink: 'file-link',
  linkIcon: 'link-icon',
  runningIcon: 'running-icon',
  runningContent: 'running-content',
  callRow: 'call-row',
  scroll: 'input-scroll',
  grow: 'input-grow',
  row: 'row',
  rows: 'rows',
  tools: 'tools',
  trailing: 'trailing',
  modes: 'modes',
  dock: 'composer-dock',
  overlayAnchor: 'composer-overlay-anchor',
  standardControls: 'composer-controls',
  activity: 'composer-activity',
  primary: 'composer-primary',
  trigger: 'trigger',
  chevron: 'trigger-chevron',
  rail: 'attachment-rail',
  image: 'attachment-image',
  preview: 'attachment-preview',
  close: 'attachment-remove',
  delete: 'attachment-remove',
  remove: 'attachment-remove',
  badge: 'badge',
  tag: 'tag',
  kindTag: 'kind-tag',
  kindTagIcon: 'kind-tag-icon',
  kindTagLabel: 'kind-tag-label',
  rowTag: 'row-tag',
  optionLine: 'option-line',
  attemptBadge: 'attempt-badge',
  keyBadge: 'key-badge',
  cardWorkspaceTrigger: 'card-workspace-trigger',
  composerHero: 'composer-hero',
  heroWorkspaceRow: 'hero-workspace-row',
  headline: 'hero-headline',
  titleGroup: 'hero-title-group',
  fishHitbox: 'hero-mark',
  previewBadge: 'hero-preview-badge',
  // The host's turn rail, which the skin stands in for (features/turn-nav reads
  // these before its own stamp lands, so the host name is the only anchor).
  frame: 'rail-frame',
  scroller: 'rail-scroller',
  // The attachment tiles and the composer's own parts the features read by name.
  imageItem: 'attachment-image-item',
  thumbnail: 'attachment-thumbnail',
  item: 'attachment-item',
  card: 'composer-card-box',
  workspaceLabel: 'workspace-chip-label',
  clearButton: 'clear-button',
  navList: 'nav-list',
  // The host's own `root` inside the conversation area: the hero page's root,
  // the composer's root and the model seat's root all answer to that name, so a
  // rule that wants one of them qualifies this part with the host's own marker.
  root: 'conversation-root',
}

/** The right sidebar's docked panels. */
export const RIGHTBAR_PARTS: PartTable = {
  guide: 'panel-guide',
  panel: 'panel',
  divider: 'dock-divider',
}

/**
 * The rows of a host menu card. The host portals its menus to `<body>` with no
 * marker of its own, so the region is the skin's own stamp on the card: only
 * the feature that recognises it (features/account, features/hero-menu) writes
 * one, and the rows are read the moment it lands.
 */
export const MENU_PARTS: PartTable = {
  itemWrap: 'menu-item',
  itemIcon: 'menu-item-icon',
  itemLabel: 'menu-item-label',
  itemName: 'menu-item-name',
  itemDesc: 'menu-item-desc',
  check: 'menu-check',
  viewport: 'menu-viewport',
  footer: 'menu-footer',
  submenu: 'menu-submenu',
  selected: 'menu-item-selected',
  divider: 'menu-divider',
}

/**
 * Names read on the whole page: the host's own text and badge roles, which its
 * sheets and the skin's both style wherever they stand. Read on `<body>` down,
 * so a heading inside a sidebar panel and one inside the transcript read alike,
 * and a badge inside a dialog reads like one in a chat row.
 *
 * These are the names the skin's typography and badge rules name; several the
 * host declared once and no longer renders (`mono`, `codeBlock`, `tagSystem`,
 * …) stay here, so a rule is exact today and one line restores it if the host
 * brings the name back.
 */
export const PAGE_PARTS: PartTable = {
  title: 'text-title',
  headline: 'text-headline',
  caption: 'text-caption',
  sectionLabel: 'section-label',
  triggerLabel: 'trigger-label',
  selectLabel: 'text-select-label',
  monoLabel: 'text-mono-label',
  mono: 'text-mono',
  codeBlock: 'text-code',
  linkIcon: 'link-icon',
  linkButton: 'link-button',
  panel: 'panel',
  overlay: 'overlay',
  navIcon: 'nav-icon',
  mask: 'mask',
  tagSystem: 'tag-system',
  tagUser: 'tag-user',
  tagContext: 'tag-context',
  tagMessage: 'tag-message',
  tagTool: 'tag-tool',
  tagSubtool: 'tag-subtool',
  kindTag: 'kind-tag',
  kindTagIcon: 'kind-tag-icon',
  kindTagLabel: 'kind-tag-label',
  rowTag: 'row-tag',
  optionLine: 'option-line',
  badge: 'badge',
  attemptBadge: 'attempt-badge',
  keyBadge: 'key-badge',
}

/** One region: the host subtree its parts are read in, and the parts themselves. */
export interface PartRegion {
  /** The host subtree the region's parts are read in; a host contract (D44). */
  within: string
  parts: PartTable
  /**
   * Parts read on the anchor's own element children alone — where the host puts
   * a slot's content. A local name as common as `root` cannot be read anywhere
   * inside the region: rows and tooltips have a `_root` of their own.
   */
  rootParts?: PartTable
}

/** Every region, in the order the walk enters them. */
export const PART_REGIONS: PartRegion[] = [
  { within: 'body', parts: PAGE_PARTS },
  {
    within: ROOT_SLOT_SELECTOR,
    parts: FRAME_PARTS,
    rootParts: { frame: 'layout-frame' },
  },
  {
    within: SIDEBAR_SLOT_SELECTOR,
    parts: SIDEBAR_PARTS,
    rootParts: { root: 'sidebar-root', collapsed: 'sidebar-collapsed', quietBars: 'sidebar-quiet', fading: 'sidebar-fading' },
  },
  { within: CONVERSATION_HEADER_SLOT_SELECTOR, parts: HEADER_PARTS },
  { within: CONVERSATION_SCROLL_SELECTOR, parts: CONVERSATION_PARTS },
  { within: RIGHTBAR_COLUMN_SELECTOR, parts: RIGHTBAR_PARTS },
  { within: `[${ACCOUNT_MENU_ATTR}], [${HERO_MENU_ATTR}]`, parts: MENU_PARTS },
]

/** Every part name the tables define, sorted: the whole vocabulary a sheet may read. */
export const PART_NAMES: string[] = (() => {
  const names = new Set<string>()
  for (const region of PART_REGIONS) {
    for (const part of Object.values(region.parts)) names.add(part)
    for (const part of Object.values(region.rootParts ?? {})) names.add(part)
  }
  return [...names].sort()
})()
