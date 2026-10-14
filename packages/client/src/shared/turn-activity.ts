import { readTurnActivity } from '../core/host'
import { activityPhrase } from './activity-phrase'
import { fileToolCall } from './file-tool'
import type { CopyParams } from '../core/i18n'
import type { FileToolOperation } from './file-tool'
import type { HostAssistantStep, HostChatSnapshot, HostRunningCall, HostTurn } from '@dsh-claude-style/contracts/services'

/**
 * What an open turn is doing now, in words (D32): the states the
 * waiting line says, the one line that speaks for a running turn.
 *
 * Most of the words are the copy document's own (`chatWait*`,
 * model-descriptions.json) and a line that cannot read a state falls back to its
 * own wording. Two states are not copy: the file a call in flight works on
 * (shared/file-tool), which fills the copy's `{file}` slot, and the clause the
 * model's own reasoning says it is on (shared/activity-phrase), which is the
 * model's text as it wrote it and carries no copy key.
 */

/** One line of copy: its key in the copy document, or null for words the model itself wrote. */
export interface ActivityWords {
  key: string | null
  fallback: string
  /**
   * Set on the words that are about a tool call: the file one call works on, or
   * the turn's calls where the running one names no file. The waiting line reads
   * it to keep a call's own words past its lock (features/chat-wait).
   */
  aboutCall?: 'file' | 'tools'
  /** Values for the copy's `{name}` slots. */
  params?: CopyParams
}

/** The model is thinking, and its reasoning says nothing the line can take. */
export const ACTIVITY_THINKING: ActivityWords = { key: 'chatWaitThinking', fallback: 'Thinking…' }
/** The model is writing its answer. */
export const ACTIVITY_WRITING: ActivityWords = { key: 'chatWaitWriting', fallback: 'Writing…' }
/** The model is drawing up a tool call. */
export const ACTIVITY_TOOL_CALL: ActivityWords = { key: 'chatWaitToolCall', fallback: 'Preparing a tool call…', aboutCall: 'tools' }
/** The turn's tool calls are running, and the running call names no file. */
export const ACTIVITY_TOOLS: ActivityWords = { key: 'chatWaitTools', fallback: 'Running tools…', aboutCall: 'tools' }

/** Reading, editing and writing one file: the file's own name fills the copy's slot. */
const ACTIVITY_FILE: Record<FileToolOperation, ActivityWords> = {
  read: { key: 'chatWaitReading', fallback: 'Reading {file}', aboutCall: 'file' },
  edit: { key: 'chatWaitEditing', fallback: 'Editing {file}', aboutCall: 'file' },
  write: { key: 'chatWaitWritingFile', fallback: 'Writing {file}', aboutCall: 'file' },
}

/**
 * The words for what the turn is doing, or null where there is nothing to say:
 * the model has written nothing in its newest step and no tool is running. A
 * turn's newest block decides among thinking, a tool call being drawn up and
 * writing; any other block kind reads as writing.
 */
export function activityWords(snapshot: HostChatSnapshot | null, turn: HostTurn | undefined): ActivityWords | null {
  if (snapshot === null || turn === undefined) return null
  const activity = readTurnActivity(snapshot, turn)
  if (activity === null) return null
  if (activity.kind === 'tools') return toolWords(activity.call)
  const newest = activity.newest
  if (newest === 'reasoning') {
    const phrase = reasoningPhrase(activity.assistant)
    return phrase === null ? ACTIVITY_THINKING : { key: null, fallback: phrase }
  }
  if (newest === 'tool-call') return ACTIVITY_TOOL_CALL
  if (newest === null) return null
  return ACTIVITY_WRITING
}

/** What a call in flight says: the file it names, where it names one. */
function toolWords(call: HostRunningCall): ActivityWords {
  const file = fileToolCall(call)
  if (file === null) return ACTIVITY_TOOLS
  return { ...ACTIVITY_FILE[file.operation], params: { file: file.file } }
}

/** The model's own words for its work, off the reasoning block it is streaming into. */
function reasoningPhrase(assistant: HostAssistantStep): string | null {
  const blocks = assistant.blocks
  const newest = blocks.length === 0 ? undefined : blocks[blocks.length - 1]
  if (newest === undefined || newest.kind !== 'reasoning' || typeof newest.text !== 'string') return null
  return activityPhrase(newest.text)
}
