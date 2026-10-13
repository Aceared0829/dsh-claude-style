import { afterEach, expect, test } from 'vitest'
import { foldExpandedBody } from './fold-glide-parts'

/** One DisclosureRow family as the host renders it, attached so ids resolve. */
function family(markup: string) {
  const root = document.createElement('div')
  root.innerHTML = markup
  document.body.append(root)
  return root
}

/** The family's own element by its test id. */
function part(root: Element, id: string) {
  const element = root.querySelector(`[data-part="${id}"]`)
  if (element === null) throw new Error(`no part "${id}" in the family`)
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

test('a row with no header wrapper: the open body is the sibling after the row, the closed family has none', () => {
  const open = family('<div data-disclosure-row data-part="row"></div><div data-part="body"></div>')
  expect(foldExpandedBody(part(open, 'row'))).toBe(part(open, 'body'))
  const closed = family('<div data-disclosure-row data-part="row"></div>')
  expect(foldExpandedBody(part(closed, 'row'))).toBeNull()
})

test('a row whose family nests the body in the wrapper the row itself lives in', () => {
  const open = family('<div data-open><div data-disclosure-header><div data-disclosure-row data-part="row"></div></div><div data-part="body"></div></div>')
  expect(foldExpandedBody(part(open, 'row'))).toBe(part(open, 'body'))
  const closed = family('<div data-open><div data-disclosure-header><div data-disclosure-row data-part="row"></div></div></div>')
  expect(foldExpandedBody(part(closed, 'row'))).toBeNull()
})

test('a row inside a header wrapper: the open body is the sibling after the wrapper', () => {
  const open = family('<div data-disclosure-header><div data-disclosure-row data-part="row"></div></div><div data-part="body"></div>')
  expect(foldExpandedBody(part(open, 'row'))).toBe(part(open, 'body'))
  const closed = family('<div data-disclosure-header><div data-disclosure-row data-part="row"></div></div>')
  expect(foldExpandedBody(part(closed, 'row'))).toBeNull()
})

test('the accessory beside a wrapped row is never taken for its body', () => {
  const closed = family('<div data-disclosure-header><div data-disclosure-row data-part="row"></div><span data-part="accessory"></span></div>')
  expect(foldExpandedBody(part(closed, 'row'))).toBeNull()
  const open = family('<div data-disclosure-header><div data-disclosure-row data-part="row"></div><span></span></div><div data-part="body"></div>')
  expect(foldExpandedBody(part(open, 'row'))).toBe(part(open, 'body'))
})

test('a control inside the header that is not the row keeps to its own siblings', () => {
  const root = family('<div data-disclosure-header><div data-disclosure-row></div><button aria-expanded="false" data-part="toggle"></button></div><div></div>')
  expect(foldExpandedBody(part(root, 'toggle'))).toBeNull()
})

test('a control naming its body with aria-controls gets that body wherever it stands', () => {
  const root = family('<div data-disclosure-header><div data-disclosure-row aria-controls=":r1:" data-part="row"></div></div><div></div><section id=":r1:" data-part="body"></section>')
  expect(foldExpandedBody(part(root, 'row'))).toBe(part(root, 'body'))
})
