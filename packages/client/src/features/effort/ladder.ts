/**
 * The reasoning ladder's strength order, and the ordering of a model's own
 * levels into it.
 *
 * The host hands the effort control `reasoning.efforts` in
 * "adapter-preferred display order" (@deepseek-ai/dsh-llm's
 * `LlmModelReasoningInfo`), a promise about display and nothing more. A
 * provider is free to list its levels in any order, and the ones that list
 * them unordered do so plainly: Qoder sends `xhigh, high, low, max, medium`
 * and `xhigh, low, medium, none`, Raccoon and MiniMax send `high, none`.
 *
 * The slider reads its steps as a strength scale — the ends are named
 * `Faster` and `Smarter` (copy-fallbacks.ts) — so an unordered ladder
 * puts the axis the wrong way round: the right end lands on the weakest
 * level, and on a ladder whose last entry is `none` the strongest position
 * reads as thinking switched off.
 *
 * This module supplies the missing order. Levels it can rank are sorted by
 * strength; levels it cannot rank stay in the adapter's own order, after
 * every ranked level, because a name whose strength is unknown must not be
 * placed on a scale that claims to know it.
 */

/**
 * Effort id to strength, larger being stronger. `none` and `off` are the
 * switch-off level and rank lowest.
 *
 * The ids are the ones the host's adapters and the OpenAI protocol both use,
 * plus the provider-private names seen on this machine: `light` (TRAE's
 * weakest) and `on` (Raccoon's "thinking on", which carries no strength of
 * its own and therefore ranks with `high`).
 */
const EFFORT_STRENGTH: Readonly<Record<string, number>> = Object.freeze({
  none: 0,
  off: 0,
  minimal: 1,
  light: 2,
  low: 3,
  medium: 4,
  high: 5,
  on: 5,
  xhigh: 6,
  max: 7,
  ultra: 8,
})

/** Whether the level's strength is known. */
export function isRankedEffort(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(EFFORT_STRENGTH, id)
}

/**
 * Order one model's levels by strength.
 *
 * A level the table does not know keeps its adapter position but lands after
 * every ranked level, so an unknown name never takes a scale position from a
 * level whose strength is known. `undefined` is the model's own default
 * level, which carries no id and therefore no strength; it stays first, where
 * the control's own default row belongs.
 *
 * @param ids - the adapter's level ids, in adapter order; `undefined`
 *   marks the model's own default level.
 * @returns the same ids in strength order.
 */
export function orderEffortIds(ids: readonly (string | undefined)[]): (string | undefined)[] {
  const ranked: (string | undefined)[] = []
  const unranked: (string | undefined)[] = []
  const defaults: (string | undefined)[] = []
  for (const id of ids) {
    if (id === undefined) defaults.push(id)
    else if (isRankedEffort(id)) ranked.push(id)
    else unranked.push(id)
  }
  ranked.sort((left, right) => EFFORT_STRENGTH[left!] - EFFORT_STRENGTH[right!])
  return [...defaults, ...ranked, ...unranked]
}
