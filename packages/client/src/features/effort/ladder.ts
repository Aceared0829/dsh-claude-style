/**
 * The reasoning ladder's strength order, and the ordering of a model's own
 * levels into it.
 *
 * The host records a model's `reasoning.efforts` as the selectable levels
 * "from least to greatest selectable reasoning effort" (@deepseek-ai/dsh-llm's
 * `LlmModelReasoningInfo`), and the adapters in the wild do not all keep that
 * promise: Qoder sends `xhigh, high, low, max, medium` and
 * `xhigh, low, medium, none`, Raccoon and MiniMax send `high, none`.
 *
 * The slider reads its steps as a strength scale — the ends are named
 * `Faster` and `Smarter` (copy-fallbacks.ts) — so an inverted ladder puts the
 * axis the wrong way round: the right end lands on the weakest level, and on a
 * ladder whose last entry is `none` the strongest position reads as thinking
 * switched off.
 *
 * This module restores the documented order level by level: a level the table
 * can rank takes its place on the scale, and a level whose name the table does
 * not know keeps the position the adapter gave it.
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
 * The levels the table can rank fill the slots the adapter gave them, sorted
 * by strength; a level it cannot rank stays in its own slot, where the
 * documented adapter order stands. `undefined` is the model's own default
 * level, which carries no id and therefore no strength; it leads the ladder,
 * where the control's own default row belongs.
 *
 * @param ids - the adapter's level ids, in adapter order; `undefined`
 *   marks the model's own default level.
 * @returns the same ids in strength order.
 */
export function orderEffortIds(ids: readonly (string | undefined)[]): (string | undefined)[] {
  const ranked = ids.filter((id): id is string => id !== undefined && isRankedEffort(id))
  ranked.sort((left, right) => EFFORT_STRENGTH[left] - EFFORT_STRENGTH[right])
  const levels: (string | undefined)[] = []
  let next = 0
  for (const id of ids) {
    if (id === undefined) continue
    levels.push(isRankedEffort(id) ? ranked[next++] : id)
  }
  return [...ids.filter(id => id === undefined), ...levels]
}
