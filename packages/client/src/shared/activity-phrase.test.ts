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

test('a negated clause is passed over: the line says what the model is doing', () => {
  expect(activityPhrase('I am not sure about this one.')).toBeNull()
  expect(activityPhrase('I am reading the file. I am not going to guess.')).toBe('Reading the file')
})

test('one language only: reasoning in Chinese, or text with no clause at all, answers nothing', () => {
  expect(activityPhrase('先看清工作区，再动手。')).toBeNull()
  expect(activityPhrase('Nothing here at all.')).toBeNull()
})

test('the shape is the rule: an adjective of the same shape reads as a clause too', () => {
  expect(activityPhrase('The file is missing.')).toBe('Missing')
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
