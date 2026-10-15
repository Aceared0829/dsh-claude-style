import { ACCOUNT_MENU_ATTR, HERO_MENU_ATTR, PART_ATTR } from '../constants'
import { PART_REGIONS } from './parts-table'
import type { PartTable } from './parts-table'
import { localClassName, setAttributeIfChanged } from '../shared/dom'
import { subscribeMutations } from './bus'

/**
 * The marking pass behind the skin's part vocabulary (D3).
 *
 * The tables in core/parts-table.ts say which host class names the skin reads
 * and what it calls each one; this module walks the page once, reads each host
 * class name's local part exactly, and writes the skin's own names for it onto
 * the element as `data-dsh-claude-part`. A stylesheet then matches one
 * attribute whole, so a match cannot take a neighbour that merely holds the
 * same fragment, a host rename leaves the rule quiet instead of wrong, and no
 * other plugin's class name can collide with these rules.
 *
 * A region scopes a local name that means different things in different places
 * — the composer's `_row` is not the tool call's, the sidebar's `_title` is not
 * the conversation's — and keeps the walk off the rest of the page. A region is
 * entered where its anchor matches, so the walk carries the regions in force
 * down and asks each element once.
 */

/** One region's lookup, compiled from its table. */
interface RegionLookup {
  within: string
  parts: Map<string, string>
  rootParts: Map<string, string> | null
}

const LOOKUPS: RegionLookup[] = PART_REGIONS.map((region) => ({
  within: region.within,
  parts: new Map(Object.entries(region.parts)),
  rootParts: region.rootParts === undefined ? null : new Map(Object.entries(region.rootParts)),
}))

/** Every region's anchor as one selector, so a subtree the walk enters is tested once. */
const ANCHOR_SELECTOR = PART_REGIONS.map((region) => region.within).join(', ')

/** The parts one element's class list carries, as one attribute value, or null when it plays none. */
function partsOf(element: Element, lookups: readonly RegionLookup[], rootParts: Map<string, string> | null) {
  if (element.classList.length === 0) return null
  if (lookups.length === 0 && rootParts === null) return null
  let parts: Set<string> | null = null
  for (const token of element.classList) {
    const local = localClassName(token)
    if (local === null) continue
    for (const lookup of lookups) {
      const part = lookup.parts.get(local)
      if (part === undefined) continue
      parts ??= new Set()
      parts.add(part)
    }
    const rootPart = rootParts?.get(local)
    if (rootPart !== undefined) {
      parts ??= new Set()
      parts.add(rootPart)
    }
  }
  return parts === null ? null : [...parts].join(' ')
}

/** Write one element's parts, or take the attribute off when it plays none. @returns whether the element's mark changed. */
function writeParts(element: Element, lookups: readonly RegionLookup[], rootParts: Map<string, string> | null) {
  const parts = partsOf(element, lookups, rootParts)
  if (parts === null) {
    if (!element.hasAttribute(PART_ATTR)) return false
    element.removeAttribute(PART_ATTR)
    return true
  }
  if (element.getAttribute(PART_ATTR) === parts) return false
  setAttributeIfChanged(element, PART_ATTR, parts)
  return true
}

/**
 * The regions in force at one element, read off its ancestors: the walk passes
 * them down, and an element the host mounted on its own — a menu card portalled
 * to `<body>`, a row React moved — resolves them itself. The root parts are
 * those of a region whose anchor is this element's own parent, which is the one
 * place the host puts a region's box.
 */
function contextAt(element: Element): { lookups: RegionLookup[], roots: Map<string, string> | null } {
  const lookups: RegionLookup[] = []
  for (const lookup of LOOKUPS) {
    if (element.closest(lookup.within) !== null) lookups.push(lookup)
  }
  const parent = element.parentElement
  let roots: Map<string, string> | null = null
  if (parent !== null) {
    for (const lookup of LOOKUPS) {
      if (lookup.rootParts !== null && parent.matches(lookup.within)) roots = lookup.rootParts
    }
  }
  return { lookups, roots }
}

/**
 * Walk one subtree, carrying the regions in force down from its parent.
 *
 * A region's `rootParts` are read on the anchor's own element children — where
 * the host puts the subtree's box — and nowhere deeper: a local name as common
 * as `root` belongs to rows and tooltips further in.
 */
function walk(element: Element, inherited: readonly RegionLookup[], roots: Map<string, string> | null): boolean {
  let lookups = inherited
  let childRoots: Map<string, string> | null = null
  if (element.matches(ANCHOR_SELECTOR)) {
    for (const lookup of LOOKUPS) {
      if (!element.matches(lookup.within)) continue
      if (!lookups.includes(lookup)) lookups = [...lookups, lookup]
      if (lookup.rootParts !== null) childRoots = lookup.rootParts
    }
  }
  let changed = writeParts(element, lookups, roots)
  for (const child of element.children) if (walk(child, lookups, childRoots)) changed = true
  return changed
}

/** Take every part mark off, for the teardown. */
export function clearParts(root: ParentNode = document) {
  for (const element of root.querySelectorAll(`[${PART_ATTR}]`)) element.removeAttribute(PART_ATTR)
}

/**
 * Mark one subtree with the parts its host class names carry. A reader outside
 * the walk — a feature that just stamped a menu card, or a unit test — calls
 * this directly.
 */
export function markParts(root: Element) {
  const { lookups, roots } = contextAt(root)
  walk(root, lookups, roots)
}

/**
 * Install the marking pass: one walk of the page, then one walk of each subtree
 * the host mounts and a rewrite of each element whose class list or region stamp
 * changed. A part is written only where it differs, and the attribute the pass
 * writes is not one it watches, so it never feeds itself (D9).
 *
 * A part a feature reads can move that feature's own measurement — which rows a
 * menu card holds, what height it draws — so a batch that wrote anything asks
 * for one more pass, through `onMarked`. The next pass writes nothing (every
 * mark already holds) and the walk settles.
 *
 * @param onMarked - called once per batch that changed a mark.
 * @returns teardown.
 */
export function installParts(onMarked?: () => void) {
  const settle = () => { if (onMarked !== undefined) onMarked() }
  if (walk(document.body, [], null)) settle()
  const stop = subscribeMutations(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    // A class rewrite moves an element's parts, and a menu stamp turns the card
    // under it into a region. Nothing else a class or a stamp means here.
    attributeFilter: ['class', ACCOUNT_MENU_ATTR, HERO_MENU_ATTR],
    skipQuiet: true,
  }, (records) => {
    let changed = false
    for (const record of records) {
      if (record.type === 'attributes') {
        if (record.target instanceof Element) {
          const { lookups, roots } = contextAt(record.target)
          // A stamp — or a class rewrite — can turn the element into a region's
          // anchor, which is how a menu card portalled to `<body>` becomes one;
          // the rows under it are read inside that region, so the whole subtree
          // is walked. A plain class rewrite only moves the element's own parts.
          const moved = record.target.matches(ANCHOR_SELECTOR)
            ? walk(record.target, lookups, roots)
            : writeParts(record.target, lookups, roots)
          if (moved) changed = true
        }
        continue
      }
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue
        const { lookups, roots } = contextAt(node)
        if (walk(node, lookups, roots)) changed = true
      }
    }
    if (changed) settle()
  })
  return () => {
    stop()
    clearParts()
  }
}
