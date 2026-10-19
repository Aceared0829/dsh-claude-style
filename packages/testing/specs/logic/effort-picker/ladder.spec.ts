/**
 * The order the effort slider reads its steps in: the host records a model's
 * reasoning efforts as a strength scale, and the control builds its ladder
 * weakest first, leaving levels the table cannot rank where the adapter put them.
 *
 * @capability effort-picker
 * @features effort
 * @risk The effort slider puts "high" below "low", or moves a model's own unranked level away from where its provider listed it, so the reader picks a weaker effort than they meant.
 */
import { expect, test } from 'vitest'
import fc from 'fast-check'
import { isRankedEffort, orderEffortIds } from '@dsh-claude-style/client/pure'

const RANKED = ['none', 'off', 'low', 'medium', 'high', 'on', 'xhigh', 'max', 'ultra']

test('an unordered ladder comes back weakest first', () => {
  expect(orderEffortIds(['high', 'none'])).toEqual(['none', 'high'])
  expect(orderEffortIds(['xhigh', 'low', 'medium', 'none'])).toEqual(['none', 'low', 'medium', 'xhigh'])
  expect(orderEffortIds(['xhigh', 'high', 'low', 'max', 'medium'])).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
  expect(orderEffortIds(['high', 'low', 'max'])).toEqual(['low', 'high', 'max'])
})

test('an already ordered ladder is unchanged', () => {
  expect(orderEffortIds(['none', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'])).toEqual(['none', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'])
  expect(orderEffortIds(['low', 'high', 'max'])).toEqual(['low', 'high', 'max'])
})

test('a single level is unchanged', () => {
  expect(orderEffortIds(['high'])).toEqual(['high'])
  expect(orderEffortIds(['none'])).toEqual(['none'])
})

test('the model\'s own default level leads, ranked levels follow', () => {
  expect(orderEffortIds([undefined, 'high', 'none'])).toEqual([undefined, 'none', 'high'])
})

test('a level the table cannot rank keeps the place the adapter gave it', () => {
  expect(orderEffortIds(['banana', 'high', 'none'])).toEqual(['banana', 'none', 'high'])
  expect(orderEffortIds(['xhigh', 'banana', 'none'])).toEqual(['none', 'banana', 'xhigh'])
  expect(orderEffortIds(['first', 'second', 'low'])).toEqual(['first', 'second', 'low'])
})

test('the switch-off level ranks weakest and thinking-on ranks with high', () => {
  expect(isRankedEffort('none')).toBe(true)
  expect(isRankedEffort('off')).toBe(true)
  expect(orderEffortIds(['high', 'off'])).toEqual(['off', 'high'])
  expect(orderEffortIds(['on', 'none'])).toEqual(['none', 'on'])
  expect(isRankedEffort('banana')).toBe(false)
})

test('any ladder comes back as the same levels, unranked ones in place, ranked ones weakest first', () => {
  const level = fc.oneof(fc.constantFrom(...RANKED), fc.constantFrom('banana', 'first', 'second'))
  fc.assert(fc.property(fc.uniqueArray(level, { maxLength: 8 }), (ids) => {
    const ordered = orderEffortIds(ids)
    expect([...ordered].sort()).toEqual([...ids].sort())
    ids.forEach((id, at) => {
      if (!isRankedEffort(id)) expect(ordered[at]).toBe(id)
    })
    const ranked = ordered.filter((id): id is string => id !== undefined && isRankedEffort(id))
    expect(orderEffortIds(ranked)).toEqual(ranked)
    expect(orderEffortIds(ordered)).toEqual(ordered)
  }))
})
