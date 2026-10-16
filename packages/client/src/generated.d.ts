/**
 * The module scripts/build.mjs generates while bundling (D36): build output
 * the source imports by name instead of reading it from text placeholders.
 */
declare module 'virtual:dsh-claude-style/generated' {
  /** The skin's stylesheet: the generated token sheet and the src/ stylesheets in order, the composer gate stamped (D9). */
  export const STYLESHEET: string
  /** The surface sheets (`scope: 'surface'`), scoped to `body[data-dsh-claude-surface]` and mounted by the surface feature (D49). */
  export const SURFACE_STYLESHEET: string
  /** Vendor lockup markup by brand id (packages/assets/src/icons/combine/). */
  export const COMBINE_SVGS: Record<string, string>
  /** The vendor's own word each lockup draws, by brand id. */
  export const COMBINE_WORDS: Record<string, string>
  /** A hash of the bundle, written in after bundling (D3). */
  export const BUILD_ID: string
  /** The version of the package this bundle was built from; the account Remote wants a client build version. */
  export const CLIENT_VERSION: string
  /** The address each of Deepy's sheets plays from, by animation name */
  export const DEEPY_SHEET_URLS: Record<string, string>
  /** The crab's sheets as data URIs by animation name: its body and its ink mask. */
  export const CRAB_SHEET_URLS: Record<string, { body: string, ink: string }>
  /** The motion tokens, by token name (packages/client/src/theme/tokens.json, D9); read through shared/motion.ts. */
  export const MOTION: Record<string, string>
}

/**
 * The modules the feature chunks share with the bundle (D72), by the id each
 * chunk asks for: a source module's repository path, or a host package's name.
 */
declare module 'virtual:dsh-claude-style/chunk-modules' {
  export const CHUNK_MODULES: Record<string, unknown>
}

/** The feature registry scripts/build.mjs generates from the manifests (D72), in install order. */
declare module 'virtual:dsh-claude-style/features' {
  export const FEATURES: import('./core/feature').Feature[]
}

/**
 * The row controls scripts/build.mjs collects from the features' own settings
 * modules (D72), by feature id and the name the manifest's row gives them.
 */
declare module 'virtual:dsh-claude-style/settings-controls' {
  export const ROW_CONTROLS: Record<string, import('./core/feature').SettingsRowControls>
}
