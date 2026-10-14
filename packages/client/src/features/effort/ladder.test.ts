import { expect, test } from 'vitest'
import { isRankedEffort, orderEffortIds } from './ladder'

/**
 * The adapter promises a display order, not a strength order, and the slider
 * reads its steps as a strength scale. These hold the order the control
 * builds its ladder from, including the levels the table cannot rank.
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

test('an unranked level keeps adapter order and lands after every ranked level', () => {
  expect(orderEffortIds(['banana', 'high', 'none'])).toEqual(['none', 'high', 'banana'])
  expect(orderEffortIds(['first', 'second', 'low'])).toEqual(['low', 'first', 'second'])
})

test('the switch-off level ranks weakest and thinking-on ranks with high', () => {
  expect(isRankedEffort('none')).toBe(true)
  expect(isRankedEffort('off')).toBe(true)
  expect(orderEffortIds(['high', 'off'])).toEqual(['off', 'high'])
  expect(orderEffortIds(['on', 'none'])).toEqual(['none', 'on'])
  expect(isRankedEffort('banana')).toBe(false)
})
