import { callArgsOf, callString } from './call-args'
import type { HostChatBlock } from '@dsh-claude-style/contracts/services'

/**
 * The file tools, read off a call's own block: which operation a call is, and
 * the name of the file it works on. The waiting line says these beside the
 * host's whale (features/chat-wait); the file rows read the same arguments for
 * their own paths and diffs (features/chat-files).
 */

/** The three file operations the host gives a file row. */
export type FileToolOperation = 'read' | 'edit' | 'write'

/** The operation a tool name stands for, or null for a tool that is not a file operation. */
export function fileToolOperation(toolName: string): FileToolOperation | null {
  if (toolName === 'read') return 'read'
  if (toolName === 'edit') return 'edit'
  if (toolName === 'write') return 'write'
  return null
}

/** How much of a file's name the line carries; a longer one is cut here. */
export const FILE_NAME_MAX_CHARS = 32

/** A path's own name: the piece after its last separator. */
export function fileName(path: string) {
  const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return at === -1 ? path : path.slice(at + 1)
}

/** One file call in flight: what it is doing, and the name of the file it is doing it to. */
export interface FileToolCall {
  operation: FileToolOperation
  file: string
}

/**
 * The file one call works on, or null where it names none: a tool that is not a
 * file operation, a call whose arguments are still arriving (the host's
 * `preparing` phase, whose JSON is cut off mid-stream), or arguments carrying no
 * usable path. The arguments are the ones the host's own file row reads.
 */
export function fileToolCall(block: HostChatBlock): FileToolCall | null {
  if (block.phase !== 'start') return null
  const operation = fileToolOperation(block.name ?? '')
  if (operation === null) return null
  const args = callArgsOf(block.argsRaw ?? '')
  const path = args === null ? undefined : callString(args, ['path', 'file_path'])
  if (path === undefined) return null
  const file = fileName(path)
  if (file === '') return null
  return { operation, file: file.length <= FILE_NAME_MAX_CHARS ? file : `${file.slice(0, FILE_NAME_MAX_CHARS)}…` }
}
