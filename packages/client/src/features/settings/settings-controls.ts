import * as React from 'react'
import { PREFS } from '@dsh-claude-style/contracts/prefs'
import { ROW_CONTROLS } from 'virtual:dsh-claude-style/settings-controls'
import { SEGMENTS_CLASS, SEGMENT_CLASS } from '../../shared/segment-control'
import { windowsDesktop } from '../../core/desktop-band'
import { prefYielded, settingsRowsOf } from '../../core/feature'
import { featureCopy } from '../../core/i18n'
import { copy, sharedLine } from './copy'
import { createSlidingPill } from '../../shared/sliding-pill'
import type { Feature, FeatureSettingsRow } from '../../core/feature'
import type { Prefs } from '../../constants'
import type { SettingsTabId } from '../../core/feature'
import type { QuickProvidersHandle } from './quick-providers'

/**
 * The settings page's controls: the segmented control, the switch, the row
 * shell and the indented sub-row. Every tab builds its rows from these, so
 * the page reads as one control set whichever tab is open.
 *
 * The segmented controls reuse the shared `.dsh-claude-segments` /
 * `.dsh-claude-segment` classes and sliding highlight — the same control the
 * composer's permission picker uses — so the two read as one design instead
 * of two lookalikes.
 */

/**
 * One choice of a segmented control. Its value type is the preference's own, so
 * a control that writes one hands back a value the table carries.
 */
export interface SegmentOption<V extends string = string> {
  value: V
  label: string
}

/** The control builders createSettingsControls returns. */
export type SettingsControls = ReturnType<typeof createSettingsControls>

/** What a tab's rows are built from on every render of the page (settings.ts). */
export interface SettingsView {
  prefs: Prefs
  write(patch: Partial<Prefs>): void
  controls: SettingsControls
  quickTrigger: React.RefObject<HTMLButtonElement | null>
  quickProviderApi(): QuickProvidersHandle | null
  username: {
    value: string
    onChange(e: React.ChangeEvent<HTMLInputElement>): void
    onBlur(): void
    onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void
  }
}

/** One row of a tab, with its place among the tab's rows and the switch rows the manifests add (D72). */
export interface SettingsRow {
  rank: number
  node: React.ReactNode
}

/**
 * One tab of the settings page: its id, its strip label, the rows it writes
 * itself and, when the page it is open on calls for one, the line it opens
 * with.
 */
export interface SettingsTab {
  id: SettingsTabId
  label(): string
  rows(view: SettingsView): SettingsRow[]
  notice?(): string | null
}

/**
 * The tab's whole row list: its notice, then the rows the tab writes itself and
 * the rows the feature manifests place here, in rank order.
 */
export function tabRows(tab: SettingsTab, view: SettingsView) {
  const rows = [...tab.rows(view), ...featureRows(tab.id, view)]
  const nodes = rows.sort((a, b) => a.rank - b.rank).map(row => row.node)
  const notice = tab.notice === undefined ? null : tab.notice()
  if (notice === null) return nodes
  return [React.createElement('div', { key: 'notice', className: 'dsh-claude-settings-notice dsh-claude-settings-tab-notice', role: 'note' }, notice), ...nodes]
}

/**
 * One line of a row's copy: the owning feature's own line, or this page's own
 * for a line two features' rows share (D72).
 */
function rowLine(feature: Feature, key: string) {
  return feature.copy === undefined || feature.copy[key] === undefined ? sharedLine(key) : featureCopy(feature.copy, key)
}

/**
 * The rows the feature manifests declare for a tab (D72). The control follows
 * the preference's own declaration (packages/contracts/src/prefs.ts): a boolean
 * is an on/off switch, a choice a segmented control over the values the table
 * carries, each labelled by the row's own copy.
 *
 * A row refuses input and says why where it cannot act: a preference its
 * feature yields for (dsh-chat-ux on the page, managedDesc), one that only
 * works under another preference's values (`requires`), one standing under a row
 * that cannot act either (`parent`: the switch above it is off, or that row is
 * itself waiting), and one acting on the Windows desktop window alone
 * (`windowsOnly`) on every page that is not that window.
 */
function featureRows(tab: SettingsTabId, view: SettingsView): SettingsRow[] {
  const controls = view.controls
  const entries = settingsRowsOf(tab)
  const prefs = view.prefs
  const rowsByPref = new Map(entries.map(({ row }) => [row.pref, row]))

  /**
   * Whether a preference is off: a switch stored `false`, or a choice stored
   * its own `off`.
   */
  function isOff(pref: keyof Prefs) {
    const stored = prefs[pref]
    return stored === false || stored === 'off'
  }

  /**
   * Whether a row cannot act right now: the preference it stands under is off,
   * the row above it cannot act either, or its own requirement is unmet.
   */
  function blocked(row: FeatureSettingsRow, seen: ReadonlySet<string>): boolean {
    if (isOff(row.pref)) return true
    if (row.requires !== undefined && !row.requires.values.includes(String(prefs[row.requires.pref]))) return true
    if (row.windowsOnly === true && !windowsDesktop()) return true
    if (row.parent !== undefined && !seen.has(row.parent)) {
      const parent = rowsByPref.get(row.parent)
      if (parent !== undefined && blocked(parent, new Set([...seen, row.parent]))) return true
    }
    return false
  }

  return entries.map(({ feature, row }) => {
    const pref = row.pref
    const spec = PREFS[pref]
    const yielded = prefYielded(pref)
    const title = row.title === undefined ? null : rowLine(feature, row.title)
    const desc = row.desc === undefined ? '' : rowLine(feature, row.desc)
    const requires = row.requires
    const waits = requires !== undefined && !requires.values.includes(String(view.prefs[requires.pref]))
      ? rowLine(feature, requires.note)
      : null
    const offWindows = row.windowsOnly === true && !windowsDesktop()
    const above = row.parent === undefined ? undefined : rowsByPref.get(row.parent)
    const parentBlocked = above !== undefined && blocked(above, new Set([row.parent as string]))
    const stored = view.prefs[pref]
    // The row's key and its values are the table's data: the clamp holds them.
    const write = (value: string | boolean) => { view.write({ [pref]: value } as Partial<Prefs>) }
    // The row's own value never disables it: that is what the reader changes.
    const off = yielded || waits !== null || offWindows || parentBlocked
    // A row the feature draws itself renders its own control (D72); every other
    // row follows the preference's own type.
    const own = row.control === undefined ? undefined : ROW_CONTROLS[feature.id]?.[row.control]
    const control = own !== undefined
      ? React.createElement(own, { prefs: view.prefs, write: view.write, disabled: off })
      : spec.type === 'boolean'
        ? controls.toggle(stored !== false, write, off)
        : controls.segment(
          (spec.type === 'choice' ? spec.values : []).map((value: string) => ({ value, label: rowLine(feature, row.choiceLabels?.[value] ?? value) })),
          String(stored),
          write,
          off,
        )
    const note = waits ?? (offWindows ? sharedLine('windowsOnlyNote') : null)
    // A yielded row says who manages it even when it carries no description of
    // its own: the switch rows over the preview cards have none.
    const description = yielded
      ? managedDesc(desc, true)
      : (row.desc === undefined && note === null ? null : noteDesc(desc, note))
    const node = row.parent === undefined
      ? controls.row(pref, title, description, control, {
        disabled: off,
        // A row that is its control alone stacks it across the row.
        block: own !== undefined && title === null && description === null,
      })
      : controls.subRow(pref, title ?? '', description, control, !off)
    return { rank: row.rank, node }
  })
}

/** A row's description, with the line naming the plugin that manages it while one does. */
export function managedDesc(text: string, managed: boolean): React.ReactNode {
  return noteDesc(text, managed ? copy('chatUxManaged') : null)
}

/**
 * A row's description, with `note` added below in the accent colour, so a row
 * that refuses input says why where the eye already is.
 */
export function noteDesc(text: string, note: string | null): React.ReactNode {
  if (note === null) return text
  return [text, React.createElement('span', { key: 'note', className: 'dsh-claude-settings-row-note' }, note)]
}
/**
 * One segmented control on the page, carrying the shared sliding highlight
 * (packages/client/src/shared/sliding-pill.ts). The group is React's, so the pill is
 * placed from a layout effect after every render — before the frame is
 * painted — and taken off when the group unmounts. `role` defaults to a
 * plain group; the tab strip passes `tablist`.
 */
export function ClaudeStyleSegmentGroup(props: { role?: string, className?: string, children?: React.ReactNode }) {
  const group = React.useRef<HTMLDivElement>(null)
  const pill = React.useRef<ReturnType<typeof createSlidingPill> | null>(null)
  React.useLayoutEffect(() => {
    pill.current = createSlidingPill('[data-active]')
    return () => {
      pill.current!.release()
      pill.current = null
    }
  }, [])
  React.useLayoutEffect(() => {
    pill.current!.sync(group.current)
  })
  const className = props.className ? `${SEGMENTS_CLASS} ${props.className}` : SEGMENTS_CLASS
  return React.createElement('div', { ref: group, className, role: props.role || 'group' }, props.children)
}

/**
 * One on/off switch: a button carrying the switch role and nothing but its knob
 * inside. The name comes from the row it sits in — `row()` hands it the row's
 * title — because a switch with no text of its own is announced as an
 * unlabelled switch.
 *
 * The knob bounces across only once the reader has pressed this switch: the
 * mark that arms the bounce is written by the press, so a page opening, a tab
 * switching back or a value arriving from elsewhere draws every knob at rest
 * (settings.css).
 */
export function ClaudeStyleSwitch(props: { on: boolean, onPick(value: boolean): void, disabled?: boolean, label?: string }) {
  const [moved, setMoved] = React.useState(false)
  return React.createElement(
    'button',
    {
      type: 'button',
      className: 'dsh-claude-settings-switch',
      role: 'switch',
      disabled: props.disabled === true,
      'aria-checked': props.on ? 'true' : 'false',
      'aria-label': props.label,
      'data-on': props.on ? '' : undefined,
      'data-moved': moved ? '' : undefined,
      onClick() {
        setMoved(true)
        props.onPick(!props.on)
      },
    },
    React.createElement('span', { className: 'dsh-claude-settings-switch-knob' }),
  )
}

/**
 * The control builders. They hold no state of their own: every value and
 * every write arrives through the arguments, so one set serves every tab.
 * @returns { segment, toggle, row, subRow }.
 */
export function createSettingsControls() {
  /**
   * A segmented control. `disabled` greys the whole group out and stops it
   * answering (a sub-row whose parent is off).
   */
  function segment<V extends string>(options: readonly SegmentOption<V>[], active: string, onPick: (value: V) => void, disabled?: boolean) {
    const buttons: React.ReactElement[] = []
    for (let i = 0; i < options.length; i++) {
      buttons.push(React.createElement(
        'button',
        {
          key: options[i].value,
          type: 'button',
          className: SEGMENT_CLASS,
          disabled: disabled === true,
          'data-active': options[i].value === active ? '' : undefined,
          'aria-pressed': options[i].value === active ? 'true' : 'false',
          onClick: (value => () => {
            if (value !== active) onPick(value)
          })(options[i].value),
        },
        options[i].label,
      ))
    }
    return React.createElement(ClaudeStyleSegmentGroup, null, buttons)
  }

  /** An on/off switch; `row()` names it after the row it lands in. */
  function toggle(on: boolean, onPick: (value: boolean) => void, disabled?: boolean) {
    return React.createElement(ClaudeStyleSwitch, { on, onPick, disabled })
  }

  /** A row's text half: the title over the description; a row whose control is the explanation (a preview card) carries no description. */
  function rowText(title: string, description: React.ReactNode) {
    return React.createElement(
      'div',
      { className: 'dsh-claude-settings-row-text' },
      React.createElement('div', { className: 'dsh-claude-settings-row-title' }, title),
      description === null ? null : React.createElement('div', { className: 'dsh-claude-settings-row-desc' }, description),
    )
  }

  /**
   * One row: title and description on the left, the control on the right.
   * A block row stacks its control under the text across the row's full
   * width. A row carrying a segmented control is marked as such: that control
   * is wide, and the stylesheet keeps it on the right while it fits and gives it
   * the next line when it does not (settings.css). A disabled row is announced
   * as such; its control is built disabled by the caller and its description
   * says why.
   *
   * A row with neither title nor description is the control alone, across the
   * row: the option under the switch that turns it on (the Motion tab's
   * preview cards), whose own controls carry their accessible names. `sub`
   * marks a titled row that belongs to the row above it the same way, so the
   * group keeps no hairline between its members.
   */
  function row(key: string, title: string | null, description: React.ReactNode, control: React.ReactNode, options?: { block?: boolean, disabled?: boolean, sub?: boolean }) {
    const classes = ['dsh-claude-settings-row']
    if (options?.block) classes.push('dsh-claude-settings-row-block')
    else if (React.isValidElement(control) && control.type === ClaudeStyleSegmentGroup) classes.push('dsh-claude-settings-row-segment')
    // A row with neither title nor description is the option that belongs to
    // the switch above it, and `sub` is the same belonging for a titled row
    // (the precise status line under that switch): the stylesheet keeps the
    // group's members together, with no hairline between them (settings.css).
    if (options?.sub === true || (title === null && description === null)) classes.push('dsh-claude-settings-row-sub')
    // The switch has no text of its own; its name is this row's title.
    const named = React.isValidElement(control) && control.type === ClaudeStyleSwitch
      ? React.cloneElement(control as React.ReactElement<{ label?: string }>, { label: title ?? '' })
      : control
    const disabled = options?.disabled === true
    return React.createElement(
      'div',
      { className: classes.join(' '), key, 'aria-disabled': disabled ? 'true' : undefined, 'data-disabled': disabled ? '' : undefined },
      title === null && description === null ? null : rowText(title ?? '', description),
      named,
    )
  }

  /**
   * A row that belongs to the row above it: indented under its parent, and
   * disabled while the parent is off. The control is built by the caller
   * with the same `disabled` flag, so it also refuses the keyboard.
   */
  function subRow(key: string, title: string, description: React.ReactNode, control: React.ReactNode, enabled: boolean) {
    const named = React.isValidElement(control) && control.type === ClaudeStyleSwitch
      ? React.cloneElement(control as React.ReactElement<{ label?: string }>, { label: title })
      : control
    return React.createElement(
      'div',
      {
        className: 'dsh-claude-settings-row dsh-claude-settings-row-sub',
        key,
        'aria-disabled': enabled ? undefined : 'true',
        'data-disabled': enabled ? undefined : '',
      },
      rowText(title, description),
      named,
    )
  }

  return { segment, toggle, row, subRow }
}
