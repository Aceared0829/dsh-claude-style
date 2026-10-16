import { QUIET_ATTR, READER_HOLD_ATTR } from '../client/src/constants'
import { motionReduced } from '../client/src/core/prefs'
import { adoptSkin } from '@dsh-claude-style/engine/skin'

/**
 * Hand the engine the skin's own vocabulary before any test runs.
 *
 * The unit tests drive the browser half's own modules, and those run on the
 * engine: the observation bus leaves the skin's quiet writes out of a batch and
 * the scroll owner marks the container a reader holds. Both attributes belong to
 * the skin, so they come over the same seam the entry hands over (D73) — the
 * engine's own tests hand their own values instead (packages/engine/src).
 */
adoptSkin({
  quiet: QUIET_ATTR,
  readerHold: READER_HOLD_ATTR,
  motionReduced,
})
