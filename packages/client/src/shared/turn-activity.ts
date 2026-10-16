import { readTurnActivity } from '../core/host'
import { BRAND_DEEPSEEK } from '../constants'
import { copyLabel } from '../core/i18n'
import { activityPhrase } from './activity-phrase'
import { callDescription } from './call-description'
import { fileToolCall } from './file-tool'
import type { CopyParams } from '../core/i18n'
import type { FileToolOperation } from './file-tool'
import type { HostAssistantStep, HostChatSnapshot, HostRunningCall, HostTurn } from '@dsh-claude-style/contracts/services'

/**
 * What an open turn is doing now, in words (D49): the states the
 * waiting line says, the one line that speaks for a running turn.
 *
 * Most of the words are the copy document's own (`chatWait*`,
 * model-descriptions.json) and a line that cannot read a state stands on one
 * word of the brand's (waitingWord). Three states are not copy, and the
 * `precise` choice decides whether the line reads them at all: the file a call
 * in flight works on
 * (shared/file-tool), which fills the copy's `{file}` slot, the description a
 * command call declares for itself (shared/call-description), and the clause
 * the model's own reasoning says it is on (shared/activity-phrase). The last
 * two are the model's text as it wrote it and carry no copy key. The simple
 * choice reads none of them: every state is its bare copy.
 */

/** One line of copy: its key in the copy document, or null for words the model itself wrote. */
export interface ActivityWords {
  key: string | null
  fallback: string
  /**
   * Set on the words that are about a tool call: `detail` marks the words one
   * call carries of its own (the file it works on, the description it
   * declares), which the waiting line keeps past a standing lock
   * (features/chat-wait); `generic` marks the turn's calls with nothing of
   * their own to say.
   */
  aboutCall?: 'detail' | 'generic'
  /** Values for the copy's `{name}` slots. */
  params?: CopyParams
}

/** The thinking state's copy key, which is also the word a brand waits on while the model thinks (waitingWord). */
const THINKING_KEY = 'chatWaitThinking'
/** The model is thinking, and its reasoning says nothing the line can take. */
export const ACTIVITY_THINKING: ActivityWords = { key: THINKING_KEY, fallback: 'Thinking…' }
/** The model is writing its answer. */
export const ACTIVITY_WRITING: ActivityWords = { key: 'chatWaitWriting', fallback: 'Writing…' }
/** The model is drawing up a tool call. */
export const ACTIVITY_TOOL_CALL: ActivityWords = { key: 'chatWaitToolCall', fallback: 'Preparing a tool call…', aboutCall: 'generic' }
/** The turn's tool calls are running, and the running call says nothing of its own. */
export const ACTIVITY_TOOLS: ActivityWords = { key: 'chatWaitTools', fallback: 'Running tools…', aboutCall: 'generic' }

/**
 * The one word a wait stands on: what the line says while the model is thinking
 * and what it says where no state can be read at all. The Claude brand says the
 * skin's own word for both; the DeepSeek brand says the host's own word for
 * both, which is the word that brand's own interface shows. One word per brand,
 * so the line never swaps between two words for the same wait.
 *
 * @param brand - the brand in force (core/prefs, `BRAND_ATTR`).
 * @param hostWord - the host's own word for a wait (`hostChatCopy('chat.deepDiving', …)`).
 */
export function waitingWord(brand: string, hostWord: string) {
  return brand === BRAND_DEEPSEEK ? hostWord : copyLabel(THINKING_KEY, ACTIVITY_THINKING.fallback)
}

/** Reading, editing and writing one file: the file's own name fills the copy's slot. */
const ACTIVITY_FILE: Record<FileToolOperation, ActivityWords> = {
  read: { key: 'chatWaitReading', fallback: 'Reading {file}', aboutCall: 'detail' },
  edit: { key: 'chatWaitEditing', fallback: 'Editing {file}', aboutCall: 'detail' },
  write: { key: 'chatWaitWritingFile', fallback: 'Writing {file}', aboutCall: 'detail' },
}

/**
 * The words for what the turn is doing, or null where there is nothing to say:
 * the model has written nothing in its newest step and no tool is running. A
 * turn's newest block decides among thinking, a tool call being drawn up and
 * writing; any other block kind reads as writing. `precise` is the
 * waiting line's detail choice: without it the states read as their bare copy
 * and nothing the moment carries is extracted.
 */
export function activityWords(snapshot: HostChatSnapshot | null, turn: HostTurn | undefined, precise: boolean): ActivityWords | null {
  if (snapshot === null || turn === undefined) return null
  const activity = readTurnActivity(snapshot, turn)
  if (activity === null) return null
  if (activity.kind === 'tools') return precise ? toolWords(activity.call) : ACTIVITY_TOOLS
  const newest = activity.newest
  if (newest === 'reasoning') {
    if (!precise) return ACTIVITY_THINKING
    const phrase = reasoningPhrase(activity.assistant)
    return phrase === null ? ACTIVITY_THINKING : { key: null, fallback: phrase }
  }
  if (newest === 'tool-call') return ACTIVITY_TOOL_CALL
  if (newest === null) return null
  return ACTIVITY_WRITING
}

/** What a call in flight says: the file it works on, or the words it declares for itself. */
function toolWords(call: HostRunningCall): ActivityWords {
  const file = fileToolCall(call)
  if (file !== null) return { ...ACTIVITY_FILE[file.operation], params: { file: file.file } }
  const description = callDescription(call)
  if (description !== null) return { key: null, fallback: description, aboutCall: 'detail' }
  return ACTIVITY_TOOLS
}

/** The model's own words for its work, off the reasoning block it is streaming into. */
function reasoningPhrase(assistant: HostAssistantStep): string | null {
  const blocks = assistant.blocks
  const newest = blocks.length === 0 ? undefined : blocks[blocks.length - 1]
  if (newest === undefined || newest.kind !== 'reasoning' || typeof newest.text !== 'string') return null
  return activityPhrase(newest.text)
}
