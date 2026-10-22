/**
 * The process groups a behaviour spec mounts, and the readers it takes off them
 * (D77): one group's root, its header control and the body the host folds with
 * the searchable hidden state, built from the host contract so a host rename
 * stays a line of packages/contracts/src/dom.ts.
 *
 * A mounted group is the host's: the header carries the aria-expanded the host
 * writes, its shimmer while the process still runs, and a click listener that
 * folds and unfolds the body the way the host's own onClick does. The skin's
 * document listeners hear that press as the reader's.
 */
import { host, surface } from './behaviour.mjs'

const GROUP = host('process.group')
const BODY = host('process.body')
const CONTENT = host('process.content')
const HEADER = host('process.activity')
const ICON = host('process.icon')
const CHEVRON = host('process.chevron')
const FLOW = host('chat.flow')
const ANSWER = host('chat.process-answer')
const SHIMMER = host('chat.shimmer-attribute')
const TURN = host('chat.turn-attribute')
const HIDDEN_VALUE = host('process.body-hidden')

/** The one attribute of a selector written as `tag[name]`. */
function attributeOf(selector) {
  const at = selector.indexOf('[')
  return selector.slice(at + 1, -1)
}

/** What one page-evaluate call is handed: every literal it may not spell itself. */
function marks() {
  return {
    flow: host.attribute('chat.flow'),
    group: host.attribute('process.group'),
    body: host.attribute('process.body'),
    content: host.attribute('process.content'),
    header: attributeOf(HEADER),
    icon: host.attribute('process.icon'),
    chevron: host.attribute('process.chevron'),
    answer: ANSWER,
    shimmer: SHIMMER,
    turn: TURN,
    hiddenValue: HIDDEN_VALUE,
    height: 48,
  }
}

/**
 * Mount one process group in the spec's own chat flow, with the host's wiring.
 *
 * @param page - the spec's page.
 * @param options - whether the process still runs, the turn it belongs to, and
 *     whether an answer row is already in the flow when it arrives.
 * @returns the group's place in the flow.
 */
export function mountGroup(page, options = {}) {
  return page.evaluate(({ marks: given, running, turn, answered, height }) => {
    let flow = document.getElementById('specFlow')
    if (flow === null) {
      flow = document.createElement('div')
      flow.id = 'specFlow'
      flow.setAttribute(given.flow, '')
      document.body.append(flow)
    }
    const group = document.createElement('div')
    group.setAttribute(given.group, '')
    group.setAttribute('data-spec-presses', '0')
    if (turn !== null) group.setAttribute(given.turn, turn)
    const header = document.createElement('button')
    header.type = 'button'
    header.setAttribute(given.header, '')
    header.setAttribute('aria-expanded', 'false')
    const leading = document.createElement('span')
    leading.setAttribute('aria-hidden', 'true')
    const icon = document.createElement('span')
    icon.setAttribute(given.icon, '')
    icon.textContent = 'icon'
    const chevron = document.createElement('span')
    chevron.setAttribute(given.chevron, '')
    chevron.textContent = 'chevron'
    leading.append(icon, chevron)
    const words = document.createElement('span')
    words.textContent = running ? 'Working' : 'Worked'
    if (running) words.setAttribute(given.shimmer, '')
    header.append(leading, words)
    const body = document.createElement('div')
    body.setAttribute(given.body, '')
    body.setAttribute('hidden', given.hiddenValue)
    const content = document.createElement('div')
    content.setAttribute(given.content, '')
    const filler = document.createElement('div')
    filler.style.height = `${height}px`
    filler.textContent = 'process content'
    content.append(filler)
    body.append(content)
    group.append(header, body)
    flow.append(group)
    header.addEventListener('click', () => {
      group.setAttribute('data-spec-presses', String(Number(group.getAttribute('data-spec-presses')) + 1))
      if (body.hasAttribute('hidden')) body.removeAttribute('hidden')
      else body.setAttribute('hidden', given.hiddenValue)
      header.setAttribute('aria-expanded', String(!body.hasAttribute('hidden')))
    })
    if (answered) {
      const answer = document.createElement('div')
      answer.setAttribute(given.answer, '')
      if (turn !== null) answer.setAttribute(given.turn, turn)
      group.after(answer)
    }
    return flow.querySelectorAll(`[${given.group}]`).length - 1
  }, { marks: marks(), running: options.running ?? true, turn: options.turn ?? null, answered: options.answered ?? false, height: options.height ?? 48 })
}

/**
 * Take the answer to a turn's work: the answer row arrives in the flow, which is
 * the moment the group folds.
 *
 * @param page - the spec's page.
 * @param turn - the turn the row belongs to.
 */
export function answerTurn(page, turn) {
  return page.evaluate(({ group, answer, turnAttribute, value }) => {
    const flow = document.getElementById('specFlow')
    const group_ = [...flow.querySelectorAll(`[${group}]`)]
      .find((candidate) => candidate.getAttribute(turnAttribute) === value) ?? null
    const row = document.createElement('div')
    row.setAttribute(answer, '')
    row.setAttribute(turnAttribute, value)
    if (group_ === null) flow.append(row)
    else group_.after(row)
  }, { group: marks().group, answer: ANSWER, turnAttribute: TURN, value: turn })
}

/**
 * End the process the group holds: the shimmer leaves its header, and the group
 * is in its closed phase — a stopped turn if no answer row comes.
 *
 * @param page - the spec's page.
 * @param place - the group's place in the spec's flow.
 */
export function endProcess(page, place) {
  return page.evaluate(({ group, shimmer, place }) => {
    const target = [...document.querySelectorAll(`#specFlow [${group}]`)][place]
    const words = target.querySelector(`[${shimmer}]`)
    if (words !== null) words.removeAttribute(shimmer)
  }, { group: marks().group, shimmer: SHIMMER, place })
}

/** Press a group's header the way the reader does. */
export function pressHeader(page, place) {
  return page.evaluate(({ group, header, place }) => {
    const target = [...document.querySelectorAll(`#specFlow [${group}]`)][place]
    target.querySelector(`button[${header}]`).click()
  }, { group: marks().group, header: attributeOf(HEADER), place })
}

/** Let the page work a few frames, so a batch the press or the phase change left is settled. */
export function frames(page, count) {
  return page.evaluate(async (amount) => {
    for (let at = 0; at < amount; at += 1) await new Promise((done) => window.__nativeRaf(done))
  }, count)
}

/**
 * What the reader sees of one group: its body's box, its header's words, and the
 * mark the skin keeps.
 *
 * @param markId - the surface entry of the mark the skin writes on a group it
 *     shows (packages/testing/data/surface.json).
 */
export function readGroup(page, place, markId) {
  return page.evaluate(({ group, body, header, icon, chevron, shown, place }) => {
    const target = [...document.querySelectorAll(`#specFlow [${group}]`)][place]
    const body_ = target.querySelector(`[${body}]`)
    const header_ = target.querySelector(`button[${header}]`)
    const box = body_.getBoundingClientRect()
    return {
      shown: box.height > 0 && body_.checkVisibility(),
      height: Math.round(box.height),
      contentVisibility: getComputedStyle(body_).contentVisibility,
      expanded: header_.getAttribute('aria-expanded'),
      mark: target.hasAttribute(shown),
      presses: Number(target.getAttribute('data-spec-presses')),
      iconOpacity: getComputedStyle(target.querySelector(`[${icon}]`)).opacity,
      chevronOpacity: getComputedStyle(target.querySelector(`[${chevron}]`)).opacity,
      chevronTurn: getComputedStyle(target.querySelector(`[${chevron}]`)).transform,
    }
  }, { group: marks().group, body: marks().body, header: attributeOf(HEADER), icon: marks().icon, chevron: marks().chevron, shown: surface.attribute(markId), place })
}
