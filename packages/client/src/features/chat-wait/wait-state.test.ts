import { expect, test } from 'vitest'
import type { HostChatSnapshot, HostTurn } from '@dsh-claude-style/contracts/services'
import { ACTIVITY_THINKING, activityWords } from '../../shared/turn-activity'
import { WORD_LOCK_MS, openTurn, waitStart, wordForPass } from './wait-state'

function step(status: string, blocks: (string | { kind: string, text: string })[]) {
  const assistant = { status, blocks: blocks.map(block => typeof block === 'string' ? { kind: block } : block) }
  return { data: { get: (kind: string) => kind === 'assistant-step' ? assistant : undefined } }
}

function turn(number: number, status: string, steps: ReturnType<typeof step>[], start = 1000): HostTurn {
  return { turn: number, status, steps, start: { time: start } }
}

function snapshot(turns: HostTurn[], runningCalls: { turn: number }[] = []): HostChatSnapshot {
  return { timeline: { turns: new Map(turns.map(entry => [entry.turn, entry])), turnOrder: turns.map(entry => entry.turn) }, legacy: { runningCalls } }
}

test('no state can be read before any step, and while a started step has written nothing', () => {
  const fresh = turn(1, 'open', [])
  expect(activityWords(snapshot([fresh]), fresh, true)).toBeNull()
  const started = turn(1, 'open', [step('running', [])])
  expect(activityWords(snapshot([started]), started, true)).toBeNull()
  expect(activityWords(null, fresh, true)).toBeNull()
  expect(activityWords(snapshot([fresh]), undefined, true)).toBeNull()
})

test('the newest block says what the model is doing: thinking, drawing up a call, writing', () => {
  const thinking = turn(1, 'open', [step('running', ['reasoning'])])
  expect(activityWords(snapshot([thinking]), thinking, true)).toBe(ACTIVITY_THINKING)
  const drawing = turn(1, 'open', [step('running', ['reasoning', 'tool-call'])])
  expect(activityWords(snapshot([drawing]), drawing, true)?.fallback).toBe('Preparing a tool call…')
  const writing = turn(1, 'open', [step('running', ['reasoning', 'tool-call', 'text'])])
  expect(activityWords(snapshot([writing]), writing, true)?.fallback).toBe('Writing…')
})

test('a running tool call is its own state, and one from another turn does not count', () => {
  const tooling = turn(1, 'open', [step('settled', ['reasoning', 'tool-call'])])
  expect(activityWords(snapshot([tooling], [{ turn: 1 }]), tooling, true)?.fallback).toBe('Running tools…')
  expect(activityWords(snapshot([tooling], [{ turn: 2 }]), tooling, true)).toBeNull()
})

test('a running call names its file, and the newest of several calls names the line', () => {
  const tooling = turn(1, 'open', [step('settled', ['reasoning', 'tool-call'])])
  const read = { turn: 1, phase: 'start', name: 'read', argsRaw: '{"file_path":"C:\\\\work\\\\app.js"}' }
  const edit = { turn: 1, phase: 'start', name: 'edit', argsRaw: '{"file_path":"/work/notes.md"}' }
  const words = activityWords(snapshot([tooling], [read]), tooling, true)
  expect(words?.key).toBe('chatWaitReading')
  expect(words?.params).toEqual({ file: 'app.js' })
  expect(activityWords(snapshot([tooling], [read, edit]), tooling, true)?.params).toEqual({ file: 'notes.md' })
})

test('a call that names no file keeps the tool state, and one still arriving names nothing yet', () => {
  const tooling = turn(1, 'open', [step('settled', ['reasoning', 'tool-call'])])
  const command = { turn: 1, phase: 'start', name: 'pwsh', argsRaw: '{"command":"ls"}' }
  const arriving = { turn: 1, phase: 'preparing', name: 'read', argsRaw: '{"file_path":"app' }
  expect(activityWords(snapshot([tooling], [command]), tooling, true)?.fallback).toBe('Running tools…')
  expect(activityWords(snapshot([tooling], [arriving]), tooling, true)?.fallback).toBe('Running tools…')
})

test('reasoning that says what it is doing hands the line its own clause', () => {
  const thinking = turn(1, 'open', [step('running', [{ kind: 'reasoning', text: 'Let me look. I am checking the file is true. ' }])])
  const words = activityWords(snapshot([thinking]), thinking, true)
  expect(words?.key).toBeNull()
  expect(words?.fallback).toBe('Checking the file is true')
  const quiet = turn(1, 'open', [step('running', [{ kind: 'reasoning', text: '先看清工作区。' }])])
  expect(activityWords(snapshot([quiet]), quiet, true)).toBe(ACTIVITY_THINKING)
})

test('a wording written stands a whole second; the newest state after it is written at once', () => {
  const quiet = { word: null, own: false, detail: null, onCall: false, host: 'Deep diving' }
  const thinking = { word: 'Thinking…', own: false, detail: null, onCall: false, host: 'Deep diving' }
  const read = { word: 'Reading app.js', own: false, detail: 'Reading app.js', onCall: false, host: 'Deep diving' }
  const first = wordForPass(read, undefined, 1000)
  expect(first).toEqual({ word: 'Reading app.js', row: { standing: { word: 'Reading app.js', until: 1000 + WORD_LOCK_MS } } })
  // Inside the second the newest state waits, however many arrive.
  expect(wordForPass(thinking, first.row, 1200)).toEqual({ word: 'Reading app.js', row: first.row })
  expect(wordForPass(quiet, first.row, 1900)).toEqual({ word: 'Reading app.js', row: first.row })
  // Past it, whatever the state says then is written, and a new second starts.
  const next = wordForPass(thinking, first.row, 1000 + WORD_LOCK_MS + 1)
  expect(next.word).toBe('Thinking…')
  expect(next.row).toEqual({ standing: { word: 'Thinking…', until: 1000 + WORD_LOCK_MS + 1 + WORD_LOCK_MS } })
  // A wording the state still asks for is left alone: its lock is not renewed,
  // so a state that stayed put cannot hold the line.
  const held = wordForPass(thinking, next.row, 1000 + WORD_LOCK_MS + 900)
  expect(held).toEqual({ word: 'Thinking…', row: next.row })
  expect(wordForPass(read, held.row, 1000 + WORD_LOCK_MS + 900 + 200).word).toBe('Reading app.js')
  // Nothing readable and nothing locked: the host's own words.
  expect(wordForPass(quiet, undefined, 1000).word).toBe('Deep diving')
})

test('a call the lock stepped over waits for it and is written ahead of the state', () => {
  const quiet = { word: null, own: false, detail: null, onCall: false, host: 'Deep diving' }
  const thinking = { word: 'Thinking…', own: false, detail: null, onCall: false, host: 'Deep diving' }
  const preparing = { word: 'Preparing a tool call…', own: false, detail: null, onCall: true, host: 'Deep diving' }
  const read = { word: 'Reading app.js', own: false, detail: 'Reading app.js', onCall: false, host: 'Deep diving' }
  const edit = { word: 'Editing notes.md', own: false, detail: 'Editing notes.md', onCall: false, host: 'Deep diving' }
  const first = wordForPass(thinking, undefined, 1000)
  // The read is read while the lock stands: it waits, and the state stays.
  const waiting = wordForPass(read, first.row, 1300)
  expect(waiting.word).toBe('Thinking…')
  expect(waiting.row.pending).toBe('Reading app.js')
  // Another call inside the same second takes its place: only the newest waits.
  const second = wordForPass(edit, waiting.row, 1500)
  expect(second.row.pending).toBe('Editing notes.md')
  // The lock ends: the call that waited is written, not the state of that moment.
  const written = wordForPass(quiet, second.row, 1000 + WORD_LOCK_MS + 1)
  expect(written.word).toBe('Editing notes.md')
  expect(written.row.pending).toBeUndefined()
  // A call being drawn up after it does not stand behind the file: that is newer work.
  const late = wordForPass(read, written.row, 2100)
  expect(late.row.pending).toBe('Reading app.js')
  expect(wordForPass(preparing, late.row, 2200).row.pending).toBeUndefined()
  expect(wordForPass(preparing, late.row, 2200 + WORD_LOCK_MS).word).toBe('Preparing a tool call…')
})

test('the model\'s own words stand until the next intent, through the reasoning that says nothing', () => {
  const quiet = { word: null, own: false, detail: null, onCall: false, host: 'Deep diving' }
  const clause = { word: 'Checking the row model', own: true, detail: null, onCall: false, host: 'Deep diving' }
  const writing = { word: 'Writing…', own: false, detail: null, onCall: false, host: 'Deep diving' }
  const first = wordForPass(clause, undefined, 1000)
  expect(first).toEqual({
    word: 'Checking the row model',
    row: { standing: { word: 'Checking the row model', until: 1000 + WORD_LOCK_MS }, held: 'Checking the row model' },
  })
  // The stretch of reasoning between two clauses reads as nothing: the clause
  // stands rather than the brand's waiting word.
  const between = wordForPass(quiet, first.row, 1000 + WORD_LOCK_MS + 1)
  expect(between.word).toBe('Checking the row model')
  expect(between.row.held).toBe('Checking the row model')
  // A state the line can read is newer work: it takes the line, and the clause
  // does not come back once it has gone.
  const state = wordForPass(writing, between.row, 1000 + WORD_LOCK_MS + 200)
  expect(state.word).toBe('Writing…')
  expect(state.row.held).toBeUndefined()
  const silent = wordForPass(quiet, state.row, 1000 + WORD_LOCK_MS + 200 + WORD_LOCK_MS + 1)
  expect(silent.word).toBe('Deep diving')
  // The waiting word holds its own second like any other wording: the next
  // clause waits for it and then takes the line, held in its turn.
  const newer = wordForPass({ ...clause, word: 'Reading the row model' }, silent.row, 1000 + WORD_LOCK_MS + 200 + WORD_LOCK_MS * 2 + 2)
  expect(newer.word).toBe('Reading the row model')
  expect(newer.row.held).toBe('Reading the row model')
})

test('the first wait of a turn counts from its start, a later one from when it was seen', () => {
  expect(waitStart(turn(1, 'open', [], 1000), 5000)).toBe(1000)
  expect(waitStart(turn(1, 'open', [step('running', [])], 1000), 5000)).toBe(1000)
  expect(waitStart(turn(1, 'open', [step('settled', ['tool-call']), step('running', [])], 1000), 5000)).toBe(5000)
})

test('the running row speaks for the newest open turn', () => {
  const closed = turn(1, 'closed', [])
  const open = turn(2, 'open', [])
  expect(openTurn(snapshot([closed, open]))).toBe(open)
  expect(openTurn(snapshot([closed]))).toBeUndefined()
})
