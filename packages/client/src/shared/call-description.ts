import { callArgsOf, callString } from './call-args'
import type { HostChatBlock } from '@dsh-claude-style/contracts/services'

/**
 * The words a call in flight declares for itself (features/chat-wait): the
 * host's shell tools (pwsh, bash) take a required `description` argument —
 * what the command does, in the model's own words — and the host's own tool
 * row shows it beside the tool's title. The waiting line carries it the way it
 * carries a reasoning clause (shared/activity-phrase): the first line as the
 * model wrote it, whole, so the row's own width decides how much of it shows.
 * Only a started call is read: a preparing one's argument JSON is cut off
 * mid-stream (shared/file-tool).
 */
export function callDescription(block: HostChatBlock): string | null {
  if (block.phase !== 'start') return null
  const args = callArgsOf(block.argsRaw ?? '')
  const description = args === null ? undefined : callString(args, ['description'])
  if (description === undefined) return null
  const line = description.split('\n', 1)[0].replace(/\s+/g, ' ').trim()
  if (line === '') return null
  return line.charAt(0).toUpperCase() + line.slice(1)
}
