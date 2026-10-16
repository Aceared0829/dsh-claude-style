import { expect, test } from 'vitest'
import { fileName, fileToolCall, fileToolOperation } from './file-tool'

/** One running call's block: its phase, its tool name and its argument JSON. */
function running(name: string, args: unknown, phase = 'start') {
  return { phase, name, argsRaw: JSON.stringify(args) }
}

test('the three file tools answer their own operation and every other tool answers none', () => {
  expect(fileToolOperation('read')).toBe('read')
  expect(fileToolOperation('edit')).toBe('edit')
  expect(fileToolOperation('write')).toBe('write')
  expect(fileToolOperation('pwsh')).toBeNull()
  expect(fileToolOperation('')).toBeNull()
})

test('a path answers its own name, whatever separator it uses', () => {
  expect(fileName('C:\\work\\app.js')).toBe('app.js')
  expect(fileName('/home/me/pkg/index.ts')).toBe('index.ts')
  expect(fileName('app.js')).toBe('app.js')
})

test('a call in flight names its file, off either argument the host sends', () => {
  expect(fileToolCall(running('read', { file_path: 'C:\\work\\app.js' }))).toEqual({ operation: 'read', file: 'app.js' })
  expect(fileToolCall(running('edit', { path: '/work/notes.md' }))).toEqual({ operation: 'edit', file: 'notes.md' })
  expect(fileToolCall(running('write', { file_path: 'only.md' }))).toEqual({ operation: 'write', file: 'only.md' })
})

test('a call that names no file answers none: another tool, arguments still arriving, or no path', () => {
  expect(fileToolCall(running('pwsh', { command: 'ls' }))).toBeNull()
  expect(fileToolCall(running('read', { file_path: 'app.js' }, 'preparing'))).toBeNull()
  expect(fileToolCall({ phase: 'start', name: 'read', argsRaw: '{"file_path":"app' })).toBeNull()
  expect(fileToolCall(running('read', { file_path: '' }))).toBeNull()
  expect(fileToolCall(running('read', { file_path: 'C:\\work\\' }))).toBeNull()
})

test('a long name is carried whole: how much of it shows is the row\'s own width', () => {
  const long = `${'a'.repeat(60)}-tail.ts`
  expect(fileToolCall(running('read', { file_path: `/work/${long}` }))?.file).toBe(long)
})
