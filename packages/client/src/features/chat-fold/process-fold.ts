import { observeMatches, subscribeMutations } from '@dsh-claude-style/engine/bus'
import { requestFrame } from '@dsh-claude-style/engine/frame'
import { isChatFoldToggle } from './fold-toggle'
import { PROCESS_SHOWN_ATTR } from '../../constants'
import { CHAT_FLOW_SELECTOR, CHAT_TURN_ATTRIBUTE, PROCESS_ACTIVITY_SELECTOR, PROCESS_BODY_SELECTOR, PROCESS_EXPANDED_MODE_ATTRIBUTE, PROCESS_GROUP_SELECTOR, RUNNING_STATE, SHIMMER_ATTRIBUTE, SHIMMER_LEGACY_ATTRIBUTE, SHIMMER_SELECTOR, STREAMING_ATTRIBUTE, TURN_PROCESS_ANSWER_ATTRIBUTE } from '@dsh-claude-style/contracts/dom'

/**
 * A running process group stands open, and folds back once the piece of work
 * ends (the final answer is due) — without the skin ever opening the host's own
 * disclosure.
 *
 * The host gathers a turn's adjacent process content — reasoning, tool calls,
 * commands, file writes — into one process group, folded by its own inline
 * control. In the compact and standard tiers the body starts folded, so the
 * reader has to open it to see what the model is doing. That fold is searchable:
 * the body stays in the document, carrying hidden="until-found", which the HTML
 * rules render as content-visibility: hidden, and an author rule can lift. This
 * module therefore writes a mark on the group root and the stylesheet shows the
 * body while it stands; the host's disclosure, and the aria-expanded it names
 * the header with, are left exactly as they are. Nothing here presses a control,
 * so nothing has to hand the composer back its focus and selection, or the
 * scroller back its position.
 *
 * The cost, accepted with the shape: a screen reader announces the header as
 * folded while the body stands, and the first press on a running group opens the
 * host's own disclosure — the group stays shown and the mark comes off — so the
 * second press is the one that folds it.
 *
 * The detailed and fully-expanded tiers do not cap the body (it is open
 * throughout), and this module leaves them alone entirely — the test is the
 * group root's data-group-expanded-mode.
 *
 * A group's phase is read off the shimmer in its header: the host attaches
 * data-shimmer (older hosts write data-text-shimmer) only while the process
 * section is still running. Command cards inside the group use the shimmer too,
 * so the phase is only ever asked of the header.
 *
 * The group still belongs to the reader: a reader who touched a group in a
 * phase keeps it for that phase. The hand-over is per phase — folding a group
 * while its process still runs means he does not want to watch it right now,
 * and folding it back when the section ends would mean nothing.
 *
 * A turn folds only when its answer takes the group's place. A turn the reader
 * stopped has no answer row, and the host folds its group itself at the end: the
 * mark stays on, so the work up to the stop remains on the page.
 */
/** The piece of work is over and the final answer is due. */
const PROCESS_CLOSED = 'closed'
/** The answer row a turn ends with; a stopped turn never gets one. */
const ANSWER_ROW_SELECTOR = `[${TURN_PROCESS_ANSWER_ATTRIBUTE}]`

/**
 * Watch every process group on the page and bring each to what its phase
 * asks for.
 *
 * @returns teardown: the observer, the listeners and every mark go away.
 */
export function createProcessFold() {
  /** Every process group on the page, resolved once and kept current by the bus (D40). */
  const groups = observeMatches(PROCESS_GROUP_SELECTOR)
  /** The phase a group was in when the reader last touched it. */
  const touchedIn = new WeakMap<Element, string>()
  /** The groups whose turn has shown an answer row at some point. */
  const answeredGroups = new WeakSet<Element>()
  /** Whether a scan is already queued. */
  let scanQueued = false
  /** The groups this batch of mutations touched. */
  const touchedGroups = new Set<Element>()

  /**
   * Queue the groups of the turn a node belongs to.
   *
   * A stream ending and an answer row arriving are the moments a turn's groups
   * settle, and neither change happens inside the group itself. The turn comes
   * off the nearest row carrying it, so the walk stays inside that turn.
   */
  const settleTurnOf = (node: Element) => {
    const flow = node.closest(CHAT_FLOW_SELECTOR)
    const turn = node.closest(`[${CHAT_TURN_ATTRIBUTE}]`)?.getAttribute(CHAT_TURN_ATTRIBUTE) ?? null
    if (flow === null || turn === null) return
    for (const group of flow.querySelectorAll(`${PROCESS_GROUP_SELECTOR}[${CHAT_TURN_ATTRIBUTE}="${CSS.escape(turn)}"]`)) touchedGroups.add(group)
  }

  /**
   * Bring these groups to what their current phase asks for.
   * @param groups - this batch of groups; some may already be unattached.
   */
  const syncGroups = (groups: Iterable<Element>) => {
    /** The turns carrying an answer row, per flow, read once for this scan. */
    const answered = new Map<Element, Set<string>>()
    /**
     * Whether the turn this group belongs to ends with an answer row.
     *
     * A stopped turn gets none, and folding its process away leaves the page
     * with nothing below it: the reader was watching that work, and the stop is
     * what ended it, not an answer taking its place. The host takes the mark off
     * the answer row while the turn's own control is open, so a group whose
     * turn was once seen with one keeps folding: the memory lives on the group,
     * which outlives the mark.
     */
    const showsAnswer = (group: Element, flow: Element) => {
      const turn = group.getAttribute(CHAT_TURN_ATTRIBUTE)
      if (turn === null) return true
      let turns = answered.get(flow)
      if (turns === undefined) {
        turns = new Set([...flow.querySelectorAll(ANSWER_ROW_SELECTOR)].map(row => row.getAttribute(CHAT_TURN_ATTRIBUTE) ?? ''))
        answered.set(flow, turns)
      }
      if (turns.has(turn)) {
        answeredGroups.add(group)
        return true
      }
      return answeredGroups.has(group)
    }
    for (const group of groups) {
      // A frame sits between collecting and settling, and the group may be gone by then.
      if (!group.isConnected) continue
      // The detailed and fully-expanded tiers show the body whole; a mark there
      // would only fight the look the host gives them.
      if (group.hasAttribute(PROCESS_EXPANDED_MODE_ATTRIBUTE)) {
        group.removeAttribute(PROCESS_SHOWN_ATTR)
        continue
      }
      const header = group.querySelector(PROCESS_ACTIVITY_SELECTOR)
      const body = group.querySelector(PROCESS_BODY_SELECTOR)
      if (!(header instanceof HTMLElement) || body === null) continue
      const phase = header.querySelector(SHIMMER_SELECTOR) === null ? PROCESS_CLOSED : RUNNING_STATE
      // A closed group folds away only when its turn's answer takes its place: a
      // stopped turn never gets one, and its work is all the page has below it.
      const flow = group.closest(CHAT_FLOW_SELECTOR)
      const shown = phase === RUNNING_STATE || (flow !== null && !showsAnswer(group, flow))
      // The reader has decided this group's state in this phase: the host's own
      // disclosure is what the group follows from here.
      const wanted = shown && touchedIn.get(group) !== phase
      if (wanted === group.hasAttribute(PROCESS_SHOWN_ATTR)) continue
      if (wanted) group.setAttribute(PROCESS_SHOWN_ATTR, '')
      else group.removeAttribute(PROCESS_SHOWN_ATTR)
    }
  }

  /** Settle every group already on the page once, right after install. */
  const syncEveryGroup = () => {
    syncGroups(groups.all())
  }

  /** Record that the reader, and not this module, just decided a group's state. */
  const rememberReaderTouched = (event: Event) => {
    // A thinking row inside the group is folded by the reasoning's own module;
    // that press bubbles here and is not the reader deciding this group.
    if (isChatFoldToggle()) return
    const target = event.target
    if (!(target instanceof Element)) return
    // The header control is the one press that decides the group: the host flips
    // its own disclosure there. A press anywhere else in the body opens a card or
    // follows a link and leaves the group standing.
    const header = target.closest(PROCESS_ACTIVITY_SELECTOR)
    if (!(header instanceof HTMLElement)) return
    const group = header.closest(PROCESS_GROUP_SELECTOR)
    if (group === null) return
    // The mark comes off in the same task as the press: the host redraws the
    // header with the direction of its own state, and the stylesheet must no
    // longer be holding the opened look over it.
    group.removeAttribute(PROCESS_SHOWN_ATTR)
    touchedIn.set(group, header.querySelector(SHIMMER_SELECTOR) !== null ? RUNNING_STATE : PROCESS_CLOSED)
  }

  // Streaming changes the DOM far faster than this needs to run, so one scan
  // a frame at most.
  const onRecords = (records: MutationRecord[]) => {
    const known = touchedGroups.size
    for (const record of records) {
      if (record.type === 'attributes' && record.attributeName === STREAMING_ATTRIBUTE) {
        // The stream ended: the turn's answer is in place, or its work was stopped.
        if (record.target instanceof Element && !record.target.hasAttribute(STREAMING_ATTRIBUTE)) settleTurnOf(record.target)
        continue
      }
      const target = record.target
      const element = target instanceof Element ? target : target.parentElement
      const group = element?.closest(PROCESS_GROUP_SELECTOR) ?? null
      if (group !== null) touchedGroups.add(group)
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue
        if (node.matches(PROCESS_GROUP_SELECTOR)) touchedGroups.add(node)
        for (const found of node.querySelectorAll(PROCESS_GROUP_SELECTOR)) touchedGroups.add(found)
        // The answer row the group waits for: its arrival is when the fold is due.
        const answer = node.matches(ANSWER_ROW_SELECTOR) ? node : node.querySelector(ANSWER_ROW_SELECTOR)
        if (answer !== null) settleTurnOf(answer)
      }
    }
    // A change with no process group in it (the sidebar, the plugin page) is
    // not worth a frame.
    if (touchedGroups.size === known) return
    if (scanQueued) return
    scanQueued = true
    // The scan reads each one's phase and writes the mark: write phase (D40).
    requestFrame({
      write() {
        scanQueued = false
        const groups = [...touchedGroups]
        touchedGroups.clear()
        syncGroups(groups)
      },
    })
  }

  const stopMutations = subscribeMutations(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    // A tier switch adds or removes the group root's expand-mode attribute, and
    // the host folding a stopped turn's body changes the hidden attribute; both
    // batches have to be scanned again.
    attributeFilter: [SHIMMER_ATTRIBUTE, SHIMMER_LEGACY_ATTRIBUTE, 'hidden', PROCESS_EXPANDED_MODE_ATTRIBUTE, STREAMING_ATTRIBUTE],
  }, onRecords)
  document.addEventListener('click', rememberReaderTouched, true)
  document.addEventListener('keydown', rememberReaderTouched, true)
  syncEveryGroup()

  return () => {
    stopMutations()
    document.removeEventListener('click', rememberReaderTouched, true)
    document.removeEventListener('keydown', rememberReaderTouched, true)
    for (const group of groups.all()) group.removeAttribute(PROCESS_SHOWN_ATTR)
    groups.release()
  }
}
