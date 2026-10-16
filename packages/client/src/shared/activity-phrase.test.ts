import { expect, test } from 'vitest'
import { PHRASE_TAIL_CHARS, activityPhrase } from './activity-phrase'

test('the model\'s own clause stands without its subject: participle first, to the sentence\'s end', () => {
  expect(activityPhrase('Let me look. I am checking the file is true. ')).toBe('Checking the file is true')
  expect(activityPhrase('The user asked about the row. Now I am reading the row model.')).toBe('Reading the row model')
})

test('a contraction counts as its auxiliary', () => {
  expect(activityPhrase("I'm checking the row model, then I answer.")).toBe('Checking the row model')
  expect(activityPhrase('It\u2019s reading the file now.')).toBe('Reading the file now')
})

test('the newest complete clause wins, and a clause still streaming is left alone', () => {
  expect(activityPhrase('I am reading the first file. Then I am checking')).toBe('Reading the first file')
  expect(activityPhrase('I am checking the file')).toBeNull()
  expect(activityPhrase('')).toBeNull()
})

test('a dot inside a name, a version or an abbreviation does not end the sentence', () => {
  expect(activityPhrase('I am reading app.js now.')).toBe('Reading app.js now')
  expect(activityPhrase('I am checking package.json and the lock.')).toBe('Checking package.json and the lock')
  expect(activityPhrase('I am reading version 1.2.3 of the plugin.')).toBe('Reading version 1.2.3 of the plugin')
  expect(activityPhrase('I am reading e.g. the row model.')).toBe('Reading e.g. the row model')
})

test('the words between the auxiliary and the participle are read, up to two of them', () => {
  expect(activityPhrase('I am now checking the file.')).toBe('Checking the file')
  expect(activityPhrase("I'm currently reviewing the diff.")).toBe('Reviewing the diff')
  expect(activityPhrase('I am still reading the file.')).toBe('Reading the file')
  expect(activityPhrase('I am just verifying the output.')).toBe('Verifying the output')
  expect(activityPhrase("I've been checking the file for a while.")).toBe('Checking the file for a while')
})

test('a negated clause is passed over: the line says what the model is doing', () => {
  expect(activityPhrase('I am not sure about this one.')).toBeNull()
  expect(activityPhrase('I am reading the file. I am not going to guess.')).toBe('Reading the file')
  expect(activityPhrase('I am not currently checking that.')).toBeNull()
})

test('the words the model is thinking in are read too, 正在 included', () => {
  expect(activityPhrase('我正在读取 app.js，然后回答。')).toBe('正在读取 app.js')
  expect(activityPhrase('先看清工作区，再动手。')).toBeNull()
  expect(activityPhrase('Nothing here at all.')).toBeNull()
})

test('the markers the reasoning is written with stay out of the line', () => {
  expect(activityPhrase('I am checking `chat-wait.ts` and **the lock** now.')).toBe('Checking chat-wait.ts and the lock now')
})

test('an `-ing` word that is no participle is not read as one', () => {
  expect(activityPhrase('It is morning.')).toBeNull()
  expect(activityPhrase('There is nothing left to do.')).toBeNull()
})

test('a plan the model has not started hands the line nothing', () => {
  expect(activityPhrase('Let me check the file first.')).toBeNull()
  expect(activityPhrase('I am about to check the tests.')).toBeNull()
  expect(activityPhrase('Reading the file now, then I edit the row.')).toBeNull()
})

test('the shape is the rule: an adjective of the same shape reads as a clause too', () => {
  expect(activityPhrase('The file is missing.')).toBe('Missing')
  // No rule here reads a clause's subject, so a clause about something else is
  // carried the same way (the shape cannot tell them apart).
  expect(activityPhrase('The build is running.')).toBe('Running')
})

test('a long clause is carried whole: how much of it shows is the row\'s own width', () => {
  const long = 'I am checking whether the whole row model still reads the same arguments as before.'
  expect(activityPhrase(long)).toBe('Checking whether the whole row model still reads the same arguments as before')
})

test('only the tail of a long reasoning is read', () => {
  const old = `I am reading the old file. ${'x'.repeat(PHRASE_TAIL_CHARS)} `
  expect(activityPhrase(old)).toBeNull()
  expect(activityPhrase(`${old}I am checking the new file.`)).toBe('Checking the new file')
})
