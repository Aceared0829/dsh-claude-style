import * as React from 'react'
import { CARET_MOTION_OFF, CARET_MOTION_TYPING, CHAT_REVEAL_OFF, CHAT_REVEAL_ON, MESSAGE_ENTER_FLIGHT, MESSAGE_ENTER_GROW, MOTION_FULL, MOTION_REDUCED, MOTION_SYSTEM, STATUS_MOTION_SWEEP, STATUS_MOTION_WASH } from '../../constants'
import { prefYielded } from '../../core/feature'
import { motionReduced } from '../../core/prefs'
import { copyLabel, hostChatCopy, settingsCopy } from '../../core/i18n'
import { motionMs } from '../../shared/motion'
import { waitingWord } from '../../shared/turn-activity'
import { managedDesc } from './settings-controls'
import type { Prefs } from '../../constants'
import type { SettingsTab, SettingsView } from './settings-controls'

/**
 * The share of the reveal preview's period the sample takes to arrive; the
 * rest of the period is the hold before the next wipe. A share rather than a
 * time, so a longer sample resolves at the same pace of the card.
 */
const REVEAL_PREVIEW_ARRIVAL_SHARE = 0.45

/**
 * The share of the caret preview's period the sample line takes to be typed;
 * the rest of the period is the line standing whole, which is where the caret
 * blinks. A share rather than a time, so a longer sample resolves at the same
 * pace of the card.
 */
const CARET_PREVIEW_TYPING_SHARE = 0.5

/**
 * The settings page's Motion tab: the animation choice every motion reads,
 * what the words on the running turn's line do, the composer caret's glide and
 * the fade of the characters arriving in a streaming answer.
 *
 * The paint, caret and reveal choices are shown as the effects themselves
 * rather than named — each card carries a sample wearing the effect it picks,
 * and no visible label, the way the theme style's cards carry the brands' own
 * marks, so a row whose control already shows what it does carries no
 * description. The waiting line's sample is the same look the line itself
 * wears (shared/motion.css), so a card is the effect and not a picture of it;
 * the card's accessible name is its only text.
 */
export function createSettingsMotionTab(): SettingsTab {
  /**
   * The waiting line's paints as a row of preview cards. The card's class is
   * the stored value, which is also the shared look's own class
   * (`dsh-claude-sweep`, `dsh-claude-wash`), so a new paint is one option here
   * plus one rule in shared/motion.css.
   *
   * The two wordings are the CSS loop's own turn-taking (settings-cards.css).
   * On the still page the loop cannot run — chrome.css presses every skin
   * animation to a single 0.01 ms pass — and the line itself keeps changing its
   * wording there, writing the new words at once (shared/swapping-text.ts). So
   * the turn is handed over here instead, by an attribute the stylesheet reads:
   * the sample cuts from one wording to the other, with nothing moving.
   */
  function StatusMotionPicker(props: { prefs: Prefs, write: SettingsView['write'], disabled: boolean }) {
    const pickerRef = React.useRef<HTMLDivElement | null>(null)
    const [alt, setAlt] = React.useState(false)
    React.useEffect(() => {
      let phase = false
      const timer = window.setInterval(() => {
        phase = !phase
        setAlt(phase)
      }, motionMs('--dsh-claude-period-preview-swap') / 2)
      return () => window.clearInterval(timer)
    }, [])
    React.useLayoutEffect(() => {
      const picker = pickerRef.current
      if (picker === null) return
      // Only the still page needs the hand-over: with motion the CSS loop is
      // already taking turns, and the attribute would cut across it.
      if (motionReduced() && alt) picker.setAttribute('data-dsh-claude-word-alt', '')
      else picker.removeAttribute('data-dsh-claude-word-alt')
      // The precise line writes the specifics one at a time, so the card's own
      // paint loop stands down and the picker above hands the turn over.
      if (props.prefs.statusDetail) picker.setAttribute('data-dsh-claude-precise', '')
      else picker.removeAttribute('data-dsh-claude-precise')
    }, [alt, props.prefs.statusDetail])
    // What the line says, in the wordings the card takes turns between. With the
    // precise status line on, the line writes the specifics a moment carries, so
    // the card takes turns between the three shapes those arrive in — a file
    // being read, a tree being checked out, the model thinking — one at a time,
    // because three wordings cannot share the two-word paint loop
    // (settings-cards.css reads data-dsh-claude-precise).
    const preciseWords = [
      settingsCopy('statusDetailSampleRead', '正在阅读README.md'),
      settingsCopy('statusDetailSampleCheckout', 'Checking out current tree'),
      settingsCopy('statusDetailSampleThinking', '正在思考'),
    ]
    const plainWords = [
      waitingWord(props.prefs.brand, hostChatCopy('chat.deepDiving', 'Deep diving')),
      copyLabel('chatWaitTools', 'Running tools…'),
    ]
    const [preciseTurn, setPreciseTurn] = React.useState(0)
    React.useEffect(() => {
      if (!props.prefs.statusDetail) return
      const timer = window.setInterval(() => {
        setPreciseTurn(turn => (turn + 1) % preciseWords.length)
      }, motionMs('--dsh-claude-period-preview-swap') / preciseWords.length)
      return () => window.clearInterval(timer)
    }, [props.prefs.statusDetail, preciseWords.length])
    // The precise line swaps one specific for the next, so the card runs the
    // line's own two halves (settings-cards.css): the word leaving rises with a
    // blur while the one arriving rises in from below. Both are rendered, and
    // re-keyed each turn so the halves play again.
    const words = props.prefs.statusDetail
      ? [
        preciseWords[(preciseTurn + preciseWords.length - 1) % preciseWords.length] ?? preciseWords[0],
        preciseWords[preciseTurn % preciseWords.length] ?? preciseWords[0],
      ]
      : plainWords
    const options = [
      { value: STATUS_MOTION_SWEEP, label: settingsCopy('statusMotionSweep', 'Highlight sweep') },
      { value: STATUS_MOTION_WASH, label: settingsCopy('statusMotionWash', 'Colour wash') },
    ]
    return React.createElement(
      'div',
      { className: 'dsh-claude-motion-picker', role: 'group', ref: pickerRef },
      options.map(option => React.createElement(
        'button',
        {
          key: option.value,
          type: 'button',
          className: 'dsh-claude-motion-card',
          disabled: props.disabled,
          'data-active': option.value === props.prefs.statusMotion ? '' : undefined,
          'aria-pressed': option.value === props.prefs.statusMotion ? 'true' : 'false',
          'aria-label': option.label,
          onClick: () => { if (option.value !== props.prefs.statusMotion) props.write({ statusMotion: option.value }) },
        },
        // Each wording wears the card's paint by carrying the shared look's own
        // class (shared/motion.css), so the band or the wash rides the words
        // that are standing.
        React.createElement(
          'span',
          { className: 'dsh-claude-motion-sample', 'aria-hidden': 'true' },
          words.map((word, at) => React.createElement('span', {
            // Each turn re-keys the pair, which is what makes the two halves
            // play again on the precise line.
            key: props.prefs.statusDetail ? `${preciseTurn}-${at}` : word,
            className: `dsh-claude-motion-word dsh-claude-${option.value}`
              + (props.prefs.statusDetail ? (at === 0 ? ' dsh-claude-word-out' : ' dsh-claude-word-in') : ''),
            'data-text': word,
          }, word)),
        ),
      )),
    )
  }

  /**
   * The caret's two answers as preview cards: the same line is typed out in
   * both, character by character, with the caret following it — the on card's
   * caret glides to each new place the way the drawn one does, the off card's
   * arrives there at once the way the host's own caret does
   * (features/caret/caret.css). The caret is lit for the whole time the line is
   * being typed and blinks on the native cycle once the line stands whole: the
   * drawn caret restarts its blink on every move (features/caret/caret.ts), so a
   * reader who is typing never sees it dark.
   *
   * Both cards carry the same line in the same box, so the first card's measure
   * of the last typed character's edge places both carets; the bar's rule reads
   * it as `--dsh-claude-caret-x` (settings-cards.css).
   */
  function CaretPicker(props: { prefs: Prefs, write: SettingsView['write'], disabled: boolean }) {
    const sample = settingsCopy('caretSample', 'Hello World!')
    const pieces = Array.from(sample)
    const [at, setAt] = React.useState(0)
    const pickerRef = React.useRef<HTMLDivElement | null>(null)
    const lineRef = React.useRef<HTMLSpanElement | null>(null)
    React.useEffect(() => {
      const period = motionMs('--dsh-claude-period-preview-caret')
      const typing = Math.round(period * CARET_PREVIEW_TYPING_SHARE)
      const gap = Math.max(1, Math.round(typing / pieces.length))
      // The ticks the line stands whole before it clears: the rest of the
      // period, which is what gives the caret time to blink and the reader time
      // to read the line.
      const ticks = pieces.length + Math.max(0, Math.round((period - typing) / gap))
      let next = 0
      setAt(0)
      const timer = window.setInterval(() => {
        next = next + 1 >= ticks ? 0 : next + 1
        setAt(Math.min(next, pieces.length))
      }, gap)
      return () => window.clearInterval(timer)
    }, [sample])
    React.useLayoutEffect(() => {
      const picker = pickerRef.current
      const line = lineRef.current
      if (picker === null || line === null) return
      const last = at === 0 ? null : line.children[at - 1]
      const edge = last === null || last === undefined
        ? line.getBoundingClientRect().left
        : last.getBoundingClientRect().right
      picker.style.setProperty('--dsh-claude-caret-x', `${edge - line.getBoundingClientRect().left}px`)
    }, [at, sample])
    const options = [
      { value: CARET_MOTION_TYPING, label: settingsCopy('caretOn', 'On') },
      { value: CARET_MOTION_OFF, label: settingsCopy('caretOff', 'Off') },
    ]
    return React.createElement(
      'div',
      { className: 'dsh-claude-caret-picker', role: 'group', ref: pickerRef },
      options.map(option => React.createElement(
        'button',
        {
          key: option.value,
          type: 'button',
          className: 'dsh-claude-caret-card',
          disabled: props.disabled,
          'data-active': option.value === props.prefs.caretMotion ? '' : undefined,
          'aria-pressed': option.value === props.prefs.caretMotion ? 'true' : 'false',
          'aria-label': option.label,
          onClick: () => { if (option.value !== props.prefs.caretMotion) props.write({ caretMotion: option.value }) },
        },
        React.createElement(
          'span',
          { className: 'dsh-claude-caret-sample', 'aria-hidden': 'true' },
          React.createElement(
            'span',
            {
              className: 'dsh-claude-caret-sample-text',
              ref: option.value === CARET_MOTION_TYPING ? lineRef : undefined,
            },
            pieces.map((piece, index) => React.createElement(
              'span',
              // A character that has not been typed yet holds its place in the
              // line, so the line does not reflow as it is typed.
              { key: `${index}-${piece}`, className: 'dsh-claude-caret-piece', 'data-in': index < at ? '' : undefined },
              piece,
            )),
          ),
          React.createElement('span', {
            className: `dsh-claude-caret-sample-bar dsh-claude-caret-${option.value}`,
            // The blink is switched off for the whole time the line is being
            // typed, so the caret is lit while it moves.
            'data-typing': at < pieces.length ? '' : undefined,
          }),
        ),
      )),
    )
  }

  /**
   * The reveal's two answers as preview cards: the same sample line arrives in
   * both, one through the fade and one at once, so the choice is shown rather
   * than named (D32).
   *
   * The walk is the recipe's own (transitions.dev's "Streaming text", MIT): the
   * sample stands unseen between cycles and every piece is handed its turn one
   * after another, which is what makes the arrival read as arriving. The clock
   * runs while the row is on the page and reads the preview's own period, so
   * the sample is resolved inside the same share of it whatever its length.
   */
  function RevealPicker(props: { prefs: Prefs, write: SettingsView['write'], disabled: boolean }) {
    const sample = settingsCopy('chatRevealSample', 'New characters fade in')
    const [tick, setTick] = React.useState(0)
    React.useEffect(() => {
      const count = Array.from(sample).length
      const period = motionMs('--dsh-claude-period-preview-reveal')
      const arrival = Math.round(period * REVEAL_PREVIEW_ARRIVAL_SHARE)
      const gap = Math.max(1, Math.round(arrival / count))
      // The ticks the sample is on show before the next wipe: the rest of the
      // period is the hold, which is what gives the reader time to read it.
      const ticks = count + Math.max(0, Math.round((period - arrival) / gap))
      let next = 0
      setTick(0)
      const timer = window.setInterval(() => {
        next = next + 1 >= ticks ? 0 : next + 1
        setTick(next)
      }, gap)
      return () => window.clearInterval(timer)
    }, [sample])
    const shown = Math.min(tick, Array.from(sample).length)
    const options = [
      { value: CHAT_REVEAL_ON, label: settingsCopy('chatRevealOn', 'Fade in') },
      { value: CHAT_REVEAL_OFF, label: settingsCopy('chatRevealOff', 'Appears at once') },
    ]
    return React.createElement(
      'div',
      { className: 'dsh-claude-reveal-picker', role: 'group' },
      options.map(option => React.createElement(
        'button',
        {
          key: option.value,
          type: 'button',
          className: 'dsh-claude-reveal-card',
          // The card whose pieces wear the fade (settings-cards.css); the other
          // hands them their turn with nothing between.
          'data-fade': option.value === CHAT_REVEAL_ON ? '' : undefined,
          disabled: props.disabled,
          'data-active': option.value === props.prefs.chatReveal ? '' : undefined,
          'aria-pressed': option.value === props.prefs.chatReveal ? 'true' : 'false',
          'aria-label': option.label,
          onClick: () => { if (option.value !== props.prefs.chatReveal) props.write({ chatReveal: option.value }) },
        },
        React.createElement(
          'span',
          { className: 'dsh-claude-reveal-sample', 'aria-hidden': 'true' },
          Array.from(sample).map((piece, index) => React.createElement(
            'span',
            { key: `${index}-${piece}`, className: 'dsh-claude-reveal-piece', 'data-in': index < shown ? '' : undefined },
            piece,
          )),
        ),
      )),
    )
  }

  /**
   * How a message the reader sends arrives, as the two effects themselves
   * (constants.ts MESSAGE_ENTER_MODES). Both cards hold the same short
   * conversation of the reader's own messages, and every turn appends one new
   * message and lifts the column by the row that message takes: the messages
   * already there are pushed up and the top one leaves through the card's own
   * edge, the way the transcript does it, so what the reader watches is a
   * message arriving and never one bubble replaying. The turn is
   * --dsh-claude-period-preview-enter (settings-cards.css).
   */
  function MessageEnterPicker(props: { prefs: Prefs, write: SettingsView['write'], disabled: boolean }) {
    // What the reader watches arrive, in the order the card takes turns: one
    // message asking for a star, one for an issue, one for a pull request.
    const texts = [
      settingsCopy('messageEnterSampleStar', '帮我给dsh-claude-style点个star'),
      settingsCopy('messageEnterSampleIssue', '帮我给dsh-claude-style提个issue'),
      settingsCopy('messageEnterSamplePr', '帮我给dsh-claude-style提个pr'),
    ]
    const pickerRef = React.useRef<HTMLDivElement | null>(null)
    // The messages standing on the cards, by their own number rather than by
    // their words: the number is also the React key, so the message just
    // appended is a new node — which is what lets it play its arrival — while
    // the ones already there keep theirs.
    const [shown, setShown] = React.useState([0, 1])
    const nextId = React.useRef(shown.length)
    React.useEffect(() => {
      const timer = window.setInterval(() => {
        // The reader's animation choice is read each turn (D26): on a still page
        // the card stands on the messages already there, the way the line writes
        // its words at once, instead of a new message appearing without its
        // arrival and the column jumping a row.
        if (motionReduced()) return
        const id = nextId.current
        nextId.current += 1
        setShown(previous => previous.length >= 3 ? [...previous.slice(1), id] : [...previous, id])
      }, motionMs('--dsh-claude-period-preview-enter'))
      return () => window.clearInterval(timer)
    }, [])
    // The lift: appending a message has already moved the column up a row, so
    // the column is pushed back down first and then slides to where it belongs
    // — the same flip the conversation's own entrance needs, without which the
    // messages would jump.
    const first = React.useRef(true)
    React.useLayoutEffect(() => {
      const picker = pickerRef.current
      if (picker === null) return
      if (first.current) {
        first.current = false
        return
      }
      for (const stack of picker.querySelectorAll<HTMLElement>('.dsh-claude-enter-stack')) {
        const row = Number.parseFloat(getComputedStyle(stack).getPropertyValue('--dsh-claude-enter-row')) || 28
        stack.style.transition = 'none'
        stack.style.transform = `translateY(${row}px)`
        void stack.offsetWidth
        stack.style.transition = ''
        stack.style.transform = ''
      }
    }, [shown])
    const options = [
      { value: MESSAGE_ENTER_GROW, label: settingsCopy('messageEnterGrow', 'Grows into its place') },
      { value: MESSAGE_ENTER_FLIGHT, label: settingsCopy('messageEnterFlight', 'Flies up from the composer') },
    ]
    return React.createElement(
      'div',
      { className: 'dsh-claude-enter-picker', role: 'group', ref: pickerRef },
      options.map(option => React.createElement(
        'button',
        {
          key: option.value,
          type: 'button',
          className: 'dsh-claude-enter-card',
          // The effect this card shows, which is also the value it writes
          // (settings-cards.css).
          'data-enter': option.value,
          disabled: props.disabled,
          'data-active': option.value === props.prefs.messageEnter ? '' : undefined,
          'aria-pressed': option.value === props.prefs.messageEnter ? 'true' : 'false',
          'aria-label': option.label,
          onClick: () => { if (option.value !== props.prefs.messageEnter) props.write({ messageEnter: option.value }) },
        },
        React.createElement(
          'span',
          { className: 'dsh-claude-enter-sample', 'aria-hidden': 'true' },
          React.createElement(
            'span',
            { className: 'dsh-claude-enter-stack' },
            ...shown.map((id, at) => React.createElement(
              'span',
              {
                key: id,
                className: 'dsh-claude-enter-bubble',
                // The messages already standing arrived in earlier turns and
                // stay as they are; the last one is the one arriving now.
                'data-standing': at < shown.length - 1 ? '' : undefined,
              },
              texts[id % texts.length],
            )),
          ),
        ),
      )),
    )
  }

  function rows(view: SettingsView) {
    const prefs = view.prefs
    const write = view.write
    const motionOptions = [
      { value: MOTION_SYSTEM, label: settingsCopy('motionSystem', 'Follow the system') },
      { value: MOTION_REDUCED, label: settingsCopy('motionReduced', 'Reduced') },
      { value: MOTION_FULL, label: settingsCopy('motionFull', 'Always') },
    ]
    const caretYielded = prefYielded('caretMotion')
    const revealYielded = prefYielded('chatReveal')
    const waitYielded = prefYielded('chatWait')
    const sendYielded = prefYielded('chatSend')
    return [
      {
        rank: 5,
        node: view.controls.row(
          'motion',
          settingsCopy('motionTitle', 'Animation'),
          settingsCopy('motionDesc', 'Adjust the animation as you need: animations put rendering pressure on the device.'),
          view.controls.segment(motionOptions, prefs.motion, value => { write({ motion: value }) }),
        ),
      },
      {
        // The waiting line's detail choice, moved here from the Conversation
        // tab so it sits between the line's switch and the line's paint: on
        // writes the specifics a moment carries, off the bare states alone.
        rank: 16,
        node: view.controls.row(
          'statusDetail',
          settingsCopy('statusDetailTitle', 'Precise status line'),
          null,
          view.controls.toggle(prefs.statusDetail, value => { write({ statusDetail: value }) }),
          // It belongs to the switch above it: no hairline between the two.
          { sub: true },
        ),
      },
      {
        // The option under the line's own switch (chat-wait.manifest.ts): the
        // cards are the whole row, and the switch above them is what turns the
        // line on and off.
        rank: 17,
        node: view.controls.row(
          'statusMotion',
          null,
          null,
          React.createElement(StatusMotionPicker, { prefs, write, disabled: waitYielded }),
          { block: true, disabled: waitYielded },
        ),
      },
      {
        rank: 20,
        node: view.controls.row(
          'caretMotion',
          settingsCopy('caretTitle', 'Composer caret motion'),
          // The preview cards are the description; only a yielded control still needs a line (D32).
          caretYielded ? managedDesc('', true) : null,
          React.createElement(CaretPicker, { prefs, write, disabled: caretYielded }),
          { block: true, disabled: caretYielded },
        ),
      },
      {
        rank: 40,
        node: view.controls.row(
          'chatReveal',
          settingsCopy('chatRevealTitle', 'New-text fade'),
          // The preview cards are the description; only a yielded control still needs a line (D32).
          revealYielded ? managedDesc('', true) : null,
          React.createElement(RevealPicker, { prefs, write, disabled: revealYielded }),
          { block: true, disabled: revealYielded },
        ),
      },
      {
        // The option under the sent message's own switch (send-flight.manifest.ts):
        // the two answers are the whole row.
        rank: 51,
        node: view.controls.row(
          'messageEnter',
          null,
          null,
          React.createElement(MessageEnterPicker, { prefs, write, disabled: sendYielded }),
          { block: true, disabled: sendYielded },
        ),
      },
    ]
  }
  return { id: 'motion', label: () => settingsCopy('tabMotion', 'Motion'), rows }
}
