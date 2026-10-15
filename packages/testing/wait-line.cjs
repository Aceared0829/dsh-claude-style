#!/usr/bin/env node
/**
 * wait-line.cjs — the waiting line's own words, end to end (D66).
 *
 * Registered in the lane's scenario table (packages/testing/scenarios.cjs).
 *
 * The `waitLine` script (packages/testing/mock-llm.cjs) reasons in an English
 * clause the line can take — "I am checking the file is true" — and then reads a
 * file. The line has to say that clause as the model writes it and name the file
 * while the call is in flight, and it has to change at most once a second
 * however many states the turn passes through in between (WORD_LOCK_MS: a
 * wording shorter than the lock is passed over, and a call's own words are the
 * one thing that waits for it). The state words the lock may pass over are held
 * by the smoke case, which drives each of them on its own.
 *
 * The clause is the model's own text, so it is the same in every language; the
 * file's words are copy, so they are matched in the two the document carries.
 * Everything the words are read off is the real host: the snapshot's reasoning
 * block and the call it reports in flight (D44). The head of the row is read off
 * that same row: under the Claude brand the skin's own loading dots stand where
 * the host draws its whale tail, resting on the wording's line.
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')

/** The clauses the model writes, which the line says back word for word. */
const PHRASES = ['Checking the file is true']
/** The call the script makes, and the file whose name the line has to carry. */
const READ_WORD = /^(Reading app\.js|正在读取 app\.js)$/
/**
 * How close together two wordings may be read. The line locks a wording for a
 * second (WORD_LOCK_MS), so a turn that moves through several states that fast
 * still changes at most once a second; the record is stamped by the page when it
 * writes the wording, so the slack covers only a change landing between two
 * frames of that write.
 */
const MIN_GAP_MS = 850
/** The file the scripted read opens: written before the turn, so the call has something to read. */
const APP = 'const first = 1\n'

/**
 * The head of the running row on the real host: the skin's own loader where the
 * host draws its whale tail, which is what the Claude brand stands in for it,
 * and the seat the loader takes — the row it stands in, and the wording's own
 * line box, which the dots rest on.
 */
const readHead = (page) => page.evaluate(() => {
  const row = document.querySelector('[data-chat-running]')
  if (row === null) return null
  const loader = row.querySelector('.dsh-claude-chat-wait-loader')
  const dot = loader === null ? null : loader.firstElementChild
  const icon = row.querySelector('[data-dsh-claude-part~="running-icon"]')
  const label = row.querySelector('.dsh-claude-chat-wait-label')
  const dotStyle = dot === null ? null : getComputedStyle(dot)
  const box = (r) => ({ top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), height: +r.height.toFixed(1) })
  const seat = (element) => box(element.getBoundingClientRect())
  // The line's own text: while a wording swaps the label holds two copies, so
  // the one standing is the last of them.
  const copies = label === null ? [] : label.querySelectorAll('.dsh-claude-swap-copy')
  const standing = copies.length === 0 ? label : copies[copies.length - 1]
  let text = null
  if (standing !== null) {
    const range = document.createRange()
    range.selectNodeContents(standing)
    text = box(range.getBoundingClientRect())
  }
  return {
    dots: loader === null ? 0 : loader.children.length,
    shown: loader !== null && getComputedStyle(loader).display !== 'none',
    animation: dotStyle === null ? null : dotStyle.animationName,
    duration: dotStyle === null ? null : dotStyle.animationDuration,
    shadow: dotStyle === null ? null : dotStyle.boxShadow,
    iconShown: icon !== null && getComputedStyle(icon).display !== 'none',
    seats: loader === null || text === null ? null : { row: seat(row), loader: seat(loader), text },
  }
})

function waitLineScenario({ check }) {
  return {
    script: 'waitLine',
    prompt: 'check the file and answer',
    delayMs: 600,
    /** The workspace the scratch host opens its session in, and a recorder of what the host says each call is doing. */
    async beforeSend(context) {
      const workspace = path.join(context.home, 'workspace')
      fs.mkdirSync(workspace, { recursive: true })
      fs.writeFileSync(path.join(workspace, 'app.js'), APP)
      // Every state the host's own call rows stand in, in order: what the line
      // reads is the snapshot, and this is what the host drew beside it.
      await context.page.evaluate(() => {
        window.__waitCalls = []
        window.__waitWords = []
        const seen = new Map()
        const record = () => {
          for (const row of document.querySelectorAll('[data-chat-call-id]')) {
            const marked = row.querySelector('[data-state]')
            const state = marked === null ? '' : (marked.getAttribute('data-state') ?? '')
            const key = `${state}|${(row.innerText || '').replace(/\s+/g, ' ').slice(0, 24)}`
            if (seen.get(row) === key) continue
            seen.set(row, key)
            window.__waitCalls.push(key)
          }
        }
        // The line's own wording, recorded where the page writes it. The lock
        // the wording is held under is the skin's own timer, and a wording read
        // from the runner's side is read whenever that side is scheduled again:
        // on a loaded machine the reading lands late and measures a shorter gap
        // than the lock held, so the record is taken here and stamped with the
        // page's clock.
        const recordWord = () => {
          const label = document.querySelector('[data-chat-running] .dsh-claude-chat-wait-label')
          const word = label === null ? null : (label.dataset.text ?? null)
          const last = window.__waitWords[window.__waitWords.length - 1]
          if (word === null || last?.word === word) return
          window.__waitWords.push({ word, at: performance.now() })
        }
        new MutationObserver(() => {
          record()
          recordWord()
        }).observe(document.body, { subtree: true, childList: true, attributes: true })
        record()
        recordWord()
      })
    },
    /** Hold the turn while the row stands, and take the page's own record of the words it stood on. */
    async duringTurn(context) {
      const { page } = context
      let head = null
      const deadline = Date.now() + 60000
      while (Date.now() < deadline) {
        const words = await page.evaluate(() => window.__waitWords ?? [])
        // The row's head is read once, off the row the host itself mounted.
        if (head === null) head = await readHead(page)
        // The call's own words are the last state of the turn's work here: once
        // they have stood, every wording before them has been recorded.
        if (words.some((entry) => READ_WORD.test(entry.word))) break
        if (words.length > 0 && await page.evaluate(() => document.querySelector('[data-chat-running]') === null)) break
        await page.waitForTimeout(80)
      }
      context.notes.seen = await page.evaluate(() => window.__waitWords ?? [])
      context.notes.head = head
    },
    async assert({ page, session, notes }) {
      const seen = notes.seen ?? []
      const words = seen.map((entry) => entry.word)
      const gaps = seen.slice(1).map((entry, at) => entry.at - seen[at].at)
      const calls = await page.evaluate(() => window.__waitCalls ?? [])
      const head = notes.head ?? null
      const seats = head?.seats ?? null
      return [
        check('推理里的进行时从句由这一行自己说出来',
          PHRASES.every((phrase) => words.includes(phrase)), JSON.stringify(words)),
        check('调用在跑时说出它读的文件',
          words.some((word) => READ_WORD.test(word)), JSON.stringify({ words, calls })),
        check('一个说法锁住一秒：状态换得再快，这一行也只一秒换一次',
          gaps.length > 0 && gaps.every((gap) => gap >= MIN_GAP_MS),
          JSON.stringify({ gaps, words })),
        check('Claude 品牌下这一行开头换成插件自己的加载点，宿主的鲸鱼尾让位，三点不带阴影',
          head !== null && head.shown === true && head.dots === 3 && head.animation === 'dsh-claude-wait-dot' &&
            head.duration === '0.5s' && head.shadow === 'none' && head.iconShown === false,
          JSON.stringify(head)),
        check('加载点站在那一行里、落在说法的行上，不探出行外',
          seats !== null && seats.loader.top >= seats.row.top && seats.loader.bottom <= seats.row.bottom &&
            seats.loader.top >= seats.text.top - 2 && seats.loader.bottom <= seats.text.bottom + 2,
          JSON.stringify(seats)),
        check('控制台没有异常', session.problems.length === 0, session.problems.slice(0, 3).join(' | ')),
      ]
    },
  }
}

module.exports = { waitLineScenario }
