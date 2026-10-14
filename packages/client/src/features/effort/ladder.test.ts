import { expect, test } from 'vitest'
import { isRankedEffort, orderEffortIds } from './ladder'

/**
 * The host records `reasoning.efforts` as a strength scale and the slider
 * reads its steps the same way. These hold the order the control builds its
 * ladder from, including the levels the table cannot rank.
 */

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
