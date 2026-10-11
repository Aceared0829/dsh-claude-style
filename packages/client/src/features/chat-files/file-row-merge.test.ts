import { expect, test } from 'vitest'
import { byDocumentOrder, createFileMerge, mergeViews, rowCarrier } from './file-row-merge'
import type { FileHunk, FileRowState } from './file-row-model'
import type { FileMergeRow } from './file-row-merge'

/** One change of the shape the row model derives: the path, what it replaced and what it wrote. */
function hunk(path: string, added: number, removed: number): FileHunk {
  return {
    path,
    oldText: removed === 0 ? null : Array.from({ length: removed }, (_, at) => `old ${at}`).join('\n'),
    newText: Array.from({ length: added }, (_, at) => `new ${at}`).join('\n'),
  }
}

/** One process group's content layer, detached: the registry only walks ancestors and document order. */
function content() {
  const layer = document.createElement('div')
  layer.setAttribute('data-step-process-content', '')
  return layer
}

/** One file row inside a content layer: the host's call row holding the row's root, as the host nests them. */
function row(layer: Element, path: string, hunks: FileHunk[], state: FileRowState = 'ok'): FileMergeRow {
  const carrier = document.createElement('div')
  carrier.setAttribute('data-chat-call-id', `call-${Math.round(Math.random() * 1e9)}`)
  const element = document.createElement('div')
  element.className = 'dsh-claude-file-root'
  carrier.appendChild(element)
  layer.appendChild(carrier)
  return { element, path, hunks, state }
}

test('the rows of one file in one content layer read as one group, the earliest of them standing for it', () => {
  const layer = content()
  const first = row(layer, 'app.js', [hunk('app.js', 2, 1)])
  const second = row(layer, 'app.js', [hunk('app.js', 3, 0)])
  const views = mergeViews([second, first])
  expect(views.get(first.element)).toEqual({ head: true, count: 2, hunks: [...first.hunks, ...second.hunks], running: false })
  expect(views.get(second.element)).toEqual({ head: false, count: 2, hunks: [...first.hunks, ...second.hunks], running: false })
})

test('the head is the earliest row in document order, whichever order the rows registered in', () => {
  const layer = content()
  const first = row(layer, 'app.js', [hunk('app.js', 1, 0)])
  const second = row(layer, 'app.js', [hunk('app.js', 1, 0)])
  expect(byDocumentOrder(first, second)).toBeLessThan(0)
  expect(byDocumentOrder(second, first)).toBeGreaterThan(0)
  expect(mergeViews([second, first]).get(first.element)?.head).toBe(true)
})

test('two content layers are never read together: two pieces of work keep their own rows', () => {
  const one = content()
  const other = content()
  const early = row(one, 'app.js', [hunk('app.js', 1, 0)])
  const late = row(other, 'app.js', [hunk('app.js', 1, 0)])
  const views = mergeViews([early, late])
  expect(views.get(early.element)).toEqual({ head: true, count: 1, hunks: early.hunks, running: false })
  expect(views.get(late.element)).toEqual({ head: true, count: 1, hunks: late.hunks, running: false })
})

test('two files in one content layer stay two rows', () => {
  const layer = content()
  const app = row(layer, 'app.js', [hunk('app.js', 1, 0)])
  const note = row(layer, 'note.md', [hunk('note.md', 0, 1)])
  const views = mergeViews([app, note])
  expect(views.get(app.element)?.count).toBe(1)
  expect(views.get(note.element)?.count).toBe(1)
})

test('a group is still under way while any of its calls runs', () => {
  const layer = content()
  const settled = row(layer, 'app.js', [hunk('app.js', 1, 0)])
  const running = row(layer, 'app.js', [hunk('app.js', 1, 0)], 'running')
  const views = mergeViews([settled, running])
  expect(views.get(settled.element)?.running).toBe(true)
  expect(views.get(running.element)?.running).toBe(true)
})

test('a row in no content layer is left alone', () => {
  const loose = document.createElement('div')
  const element = document.createElement('div')
  loose.appendChild(element)
  expect(mergeViews([{ element, path: 'app.js', hunks: [hunk('app.js', 1, 0)], state: 'ok' }]).size).toBe(0)
})

test('the carrier is the host\'s call row, whether the call stands in the content layer or under a program\'s call', () => {
  const layer = content()
  const program = document.createElement('div')
  program.setAttribute('data-chat-call-id', 'program')
  const subCalls = document.createElement('div')
  const call = document.createElement('div')
  call.setAttribute('data-chat-call-id', 'dispatched')
  const element = document.createElement('div')
  call.appendChild(element)
  subCalls.appendChild(call)
  program.appendChild(subCalls)
  layer.appendChild(program)
  expect(rowCarrier(element)).toBe(call)
  expect(rowCarrier(program)).toBe(program)
  expect(rowCarrier(document.createElement('div'))).toBe(null)
})

test('the registry reads a row back out, and the view stands until the next change', () => {
  const layer = content()
  const merge = createFileMerge()
  const first = row(layer, 'app.js', [hunk('app.js', 1, 0)])
  const second = row(layer, 'app.js', [hunk('app.js', 2, 0)])
  const dropFirst = merge.put(first)
  merge.put(second)
  const before = merge.viewFor(first.element)
  expect(before).toEqual({ head: true, count: 2, hunks: [...first.hunks, ...second.hunks], running: false })
  expect(merge.viewFor(first.element)).toBe(before)
  dropFirst()
  expect(merge.viewFor(first.element)).toBe(null)
  expect(merge.viewFor(second.element)?.count).toBe(1)
})

test('a listener hears every change, and stops hearing once it unsubscribes', () => {
  const layer = content()
  const merge = createFileMerge()
  let heard = 0
  const stop = merge.subscribe(() => { heard += 1 })
  const first = row(layer, 'app.js', [hunk('app.js', 1, 0)])
  const drop = merge.put(first)
  expect(heard).toBe(1)
  drop()
  expect(heard).toBe(2)
  stop()
  merge.put(first)
  expect(heard).toBe(2)
})

test('a row put twice leaves the registry once, on the latest registration', () => {
  const layer = content()
  const merge = createFileMerge()
  const first = row(layer, 'app.js', [hunk('app.js', 1, 0)])
  const drop = merge.put(first)
  merge.put({ ...first, hunks: [hunk('app.js', 4, 0)] })
  drop()
  expect(merge.viewFor(first.element)?.hunks).toEqual([hunk('app.js', 4, 0)])
})
