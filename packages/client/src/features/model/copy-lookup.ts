import type { HostContext } from '@dsh-claude-style/engine/host'
import type { HostModelEntry } from '@dsh-claude-style/contracts/services'
import { localized } from '../../core/i18n'
import { modelCopy } from './model-copy'
import { textOf } from '../../shared/format'

/**
 * Resolving a catalog model to its description line (D5): the copy document
 * ships as data and is fetched at runtime, so this is the only place that knows
 * how a model's id becomes a sentence. Resolution descends family rule → tier
 * rule → the catalog's own text; family rules are ordered and anchored, so one
 * product line's rule never claims another's model. A model the table has never
 * seen resolves to an empty string on purpose: a name-only row beats an invented
 * line.
 */
/**
 * Family entry. The model id is tried alone first because it is the stronger
 * signal, then `provider/id` for ids that carry no brand of their own
 * (`abab6.5s-chat` under a provider called `minimax`).
 */
export function familyModelCopy(groupId: unknown, modelId: unknown) {
  if (modelCopy === null) return null
  const id = textOf(modelId).toLowerCase()
  const haystacks = [id, `${textOf(groupId).toLowerCase()}/${id}`]
  for (let h = 0; h < haystacks.length; h++) {
    for (let i = 0; i < modelCopy.families.length; i++) {
      const rule = modelCopy.families[i]
      if (!rule.re.test(haystacks[h])) continue
      return rule.text
    }
  }
  return null
}

/** Last-resort tier rule, read out of the id itself. */
export function tierModelCopy(modelId: unknown) {
  if (modelCopy === null) return null
  const id = textOf(modelId).toLowerCase()
  for (let i = 0; i < modelCopy.tiers.length; i++) {
    if (modelCopy.tiers[i].re.test(id)) return modelCopy.tiers[i].text
  }
  return null
}

/**
 * The description line for one catalog model, in the shell's language.
 * `ctx` is the caller's context, used only to read the shell's locale.
 */
export function modelDescription(ctx: HostContext | null, groupId: unknown, model: HostModelEntry): string {
  const id = typeof model.id === 'string' ? model.id : ''
  const pair = familyModelCopy(groupId, id) || tierModelCopy(id)
  const text = localized(pair, ctx, modelCopy === null ? undefined : modelCopy.fallback)
  if (text) return text
  return typeof model.description === 'string' ? model.description : ''
}
