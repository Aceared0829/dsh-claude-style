/**
 * The preference defaults, shared by both halves (D46): the host half's Config
 * is generated from this table (packages/host/src/settings.ts, D60) and the
 * browser half reads it as the value each preference holds until the settings
 * form answers.
 */
export const PREFS_DEFAULT = Object.freeze({
  brand: 'claude',
  brandName: '',
  brandInk: 'original',
  brandAccent: '',
  motion: 'system',
  statusMotion: 'sweep',
  statusDetail: 'precise',
  collapseFooter: true,
  autoPopover: 'all',
  composerScope: 'all',
  modelPicker: true,
  modelDescriptions: true,
  peakrate: true,
  quickProviders: [],
  username: '',
  banLocale: 'en',
  homeLayout: 'studio',
  palette: 'claude',
  typeface: 'claude',
  mascot: 'brand',
  mascotScope: 'all',
  permissionsControl: true,
  statsPosition: 'context',
  workspaceView: true,
  dockCards: true,
  sidebarSearch: true,
  searchStyle: 'overlay',
  sidebarLayout: 'relaxed',
  turnNav: true,
  viewTabs: true,
  headerBand: true,
  chatAnimations: true,
  chatWait: true,
  chatSend: true,
  chatReveal: 'off',
  caretMotion: 'typing',
  messageEnter: 'flight',
})

