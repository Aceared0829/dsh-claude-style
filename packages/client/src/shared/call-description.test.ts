import { expect, test } from 'vitest'
import { callDescription } from './call-description'

/** One running call's block: its phase, its tool name and its argument JSON. */
function running(name: string, args: unknown, phase = 'start') {
  return { phase, name, argsRaw: JSON.stringify(args) }
}

test('a started call hands the line the description it declared, as the model first wrote it', () => {
  expect(callDescription(running('pwsh', { command: 'npm run changelog', description: 'Regenerate the changelog' })))
    .toBe('Regenerate the changelog')
  expect(callDescription(running('bash', { command: 'ls', description: 'list the workspace' })))
    .toBe('List the workspace')
})

test('only the first line is carried, with its runs of whitespace read as one space', () => {
  expect(callDescription(running('pwsh', { command: 'ls', description: 'list the workspace\nand its sizes' })))
    .toBe('List the workspace')
  expect(callDescription(running('pwsh', { command: 'ls', description: '  list\t the  workspace  ' })))
    .toBe('List the workspace')
})

test('a call with nothing of its own answers none: another tool, arguments still arriving, or no description', () => {
  expect(callDescription(running('pwsh', { command: 'ls' }))).toBeNull()
  expect(callDescription(running('pwsh', { command: 'ls', description: '' }))).toBeNull()
  expect(callDescription(running('pwsh', { command: 'ls', description: ' \n ' }))).toBeNull()
  expect(callDescription(running('pwsh', { command: 'ls', description: 'list the workspace' }, 'preparing'))).toBeNull()
  expect(callDescription({ phase: 'start', name: 'pwsh', argsRaw: '{"command":"ls","description":"list' })).toBeNull()
})

test('a long description is carried whole: how much of it shows is the row\'s own width', () => {
  const description = `Regenerate ${'a'.repeat(40)} changelog`
  expect(callDescription(running('pwsh', { command: 'x', description }))).toBe(description)
})
