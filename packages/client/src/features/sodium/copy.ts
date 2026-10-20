import COPY from './sodium.copy.json'
import { featureCopy } from '../../core/i18n'
import type { CopyParams } from '../../core/i18n'

export type CopyKey = keyof typeof COPY

/** One line of this feature's own interface copy, in the shell's language (sodium.copy.json). */
export function copy(key: CopyKey, params?: CopyParams) {
  return featureCopy(COPY, key, params)
}
