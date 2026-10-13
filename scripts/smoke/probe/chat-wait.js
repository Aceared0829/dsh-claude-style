/**
 * The chat-wait case: the live turn's running row takes the skin's line — the
 * host's words, the turn's clock and, once the model is silent, the overtime
 * badge — and gives the host's words back when the choice is switched off.
 */
(function () {
  var probe = window.__dshSmokeProbe
  var sleep = probe.sleep
  var r = probe.report

  probe.step(async function () {
    // The host's running row (ui-chat ChatView's RunningStatus): its live
    // region, a divider, and a content span holding the whale and its words.
    // The fixture's running turn started 65 s ago and is still reasoning.
    await probe.onlyFor(['chat-wait'], async function () {
      var waitSession = document.createElement('div')
      waitSession.setAttribute('data-conversation-session', 'smoke-session')
      waitSession.innerHTML = '<div data-chat-flow="">' +
        '<div data-chat-running="true"><span role="status">Deep diving</span><span aria-hidden="true"></span>' +
        '<span><span aria-hidden="true">whale</span><span data-shimmer="true" id="debugRunningWords">Deep diving for 1m 5s ···</span></span></div>' +
        '</div>'
      document.body.appendChild(waitSession)
      var row = waitSession.querySelector('[data-chat-running]')
      var words = document.getElementById('debugRunningWords')
      var foreignLine = document.createElement('div')
      foreignLine.textContent = 'Third-party status'
      words.parentElement.appendChild(foreignLine)
      var lineOf = function () {
        var line = row.querySelector('.dsh-claude-chat-wait')
        if (line === null) return null
        var parts = line.children
        var label = parts[0]
        // The words swap over two copies (shared/swapping-text.ts): the one
        // leaving keeps the words it came with, the one arriving carries the
        // new ones, and the reading below is taken off whichever of them is
        // moving — the label itself only holds them.
        var copies = label.querySelectorAll('.dsh-claude-swap-copy')
        var leaving = label.querySelector('.dsh-claude-swap-copy.is-exit')
        var entering = label.querySelector('.dsh-claude-swap-copy.is-enter-start')
        // The copy the line is heading for: while a swap runs that is the one
        // arriving (its rest pose is the reading the entry is judged on), and
        // at rest it is the only copy there is.
        var moving = leaving !== null ? leaving : copies[copies.length - 1]
        var movingStyle = moving === undefined ? null : getComputedStyle(moving)
        // The words standing: the single copy once a swap has settled, the
        // label's own text before any swap, and the words being handed over to
        // (the helper's token) while one runs. The label's textContent joins
        // both copies mid-swap, so it is never the reading.
        var settled = copies.length === 1 && leaving === null && entering === null
        return {
          marked: row.hasAttribute('data-dsh-claude-wait'),
          besideWords: line.previousElementSibling === words,
          word: copies.length === 0 ? label.textContent : (settled ? copies[0].textContent : (label.dataset.text || '')),
          copies: copies.length,
          phase: leaving !== null ? 'exit' : (entering !== null ? 'enter' : null),
          displayed: moving === undefined ? null : moving.textContent,
          // The band rides whichever box holds the words, so the reading is
          // taken off the box carrying it.
          sweep: label.classList.contains('dsh-claude-swap-shimmer')
            ? getComputedStyle(label, '::before').animationName
            : (entering !== null
                ? getComputedStyle(entering, '::before').animationName
                : (copies.length > 0 ? getComputedStyle(copies[copies.length - 1], '::before').animationName : 'none')),
          filter: movingStyle === null ? 'none' : movingStyle.filter,
          opacity: movingStyle === null ? '1' : movingStyle.opacity,
          clock: parts[1].hidden ? null : parts[1].textContent,
          badge: parts[2].hidden ? null : parts[2].textContent,
          // The box the swap runs in, and where the clock beside it sits: the
          // hidden sizer holds the wider half while words change, so neither may
          // move during a swap, and comes down onto the words standing once they
          // settle — the clock then sits right after them (shared/swapping-text.ts).
          box: {
            width: Math.round(label.getBoundingClientRect().width),
            height: Math.round(label.getBoundingClientRect().height),
            clockLeft: Math.round(parts[1].getBoundingClientRect().left),
            lineLeft: Math.round(line.getBoundingClientRect().left),
            lineWidth: Math.round(line.getBoundingClientRect().width),
            sizer: (function () {
              var sizer = label.querySelector('.dsh-claude-swap-sizer')
              return sizer === null ? null : { text: sizer.textContent, width: Math.round(sizer.getBoundingClientRect().width) }
            })(),
            firstChildClass: label.firstElementChild === null ? null : label.firstElementChild.className,
          },
          wordsShown: getComputedStyle(words).display !== 'none',
          wordsMarked: words.hasAttribute('data-dsh-claude-wait-words'),
          foreignShown: getComputedStyle(foreignLine).display !== 'none',
        }
      }
      // The wording swaps with transitions.dev's three phases: the old one leaves
      // upward with a blur, the text changes once it has gone, and the new one
      // enters from below. Sampled across the swap, rather than once at the end:
      // the leave lasts 150ms, so the grid has to be far finer than it for the
      // last leave frame to read as gone.
      var watchSwap = async function () {
        var frames = []
        for (var round = 0; round < 40; round += 1) {
          frames.push(lineOf())
          await sleep(10)
        }
        // One settled frame after the window: the swap can land late in it, and
        // the last reading is what "at rest" is judged on.
        await sleep(250)
        frames.push(lineOf())
        return frames
      }
      await sleep(400)
      r.wait = { working: lineOf() }
      // The silence that triggers the swap, with the entry's own frames sampled
      // by the browser rather than by a polling loop: the window between the
      // incoming copy's rest pose and its release is shorter than a 10 ms poll
      // can see, and the reading is about how the two halves move together.
      // The entering copy is the one whose `data-text` names what the line is
      // heading for, so it is found by its words and watched frame by frame.
      // The timeout is the bound: a frame that never arrives answers with the
      // frames that did.
      var waitForEnter = new Promise(function (resolve) {
        var frames = []
        var settled = false
        var done = function () {
          if (settled) return
          settled = true
          resolve(frames.length === 0 ? null : frames)
        }
        setTimeout(done, 1500)
        var read = function () {
          var label = row.querySelector('.dsh-claude-chat-wait-label')
          var copy = label === null ? null : label.querySelector('.dsh-claude-swap-copy[data-text="Deep diving"]')
          if (copy === null) { requestAnimationFrame(read); return }
          var style = getComputedStyle(copy)
          frames.push({ opacity: Number(style.opacity), filter: style.filter, transform: style.transform })
          if (frames.length >= 14) { done(); return }
          requestAnimationFrame(read)
        }
        requestAnimationFrame(read)
      })
      foreignLine.remove()
      words.parentElement.appendChild(foreignLine)
      await sleep(300)
      r.wait.foreignAfter = lineOf()
      // The model goes silent: the running turn has written nothing, so the
      // line falls back to the host's own word for a wait.
      window.__dshSmokeHost.turnFixtureRunning.steps = []
      r.wait.silent = await watchSwap()
      // A tool call in flight is a state of its own, with no block streaming.
      window.__dshSmokeHost.turnFixtureRunning.steps = [{ data: { get: function (kind) { return kind === 'assistant-step' ? { status: 'settled', step: 1, blocks: [{ kind: 'reasoning' }, { kind: 'tool-call' }] } : undefined } } }]
      window.__dshSmokeHost.turnFixtureCalls.push({ turn: 2 })
      await sleep(400)
      r.wait.tools = lineOf()
      window.__dshSmokeHost.turnFixtureCalls.length = 0
      // The reader's animation choice: reduced writes the new wording at once.
      window.__pushForm({ motion: 'reduced' })
      await sleep(200)
      window.__dshSmokeHost.turnFixtureRunning.steps = []
      await sleep(100)
      r.wait.reduced = lineOf()
      window.__pushForm({ motion: 'system' })
      await sleep(200)
      r.wait.enterFrames = await waitForEnter
      var previousWords = words
      words = document.createElement('span')
      words.setAttribute('data-shimmer', 'true')
      words.textContent = previousWords.textContent
      previousWords.replaceWith(words)
      await sleep(400)
      r.wait.replaced = {
        previousMarked: previousWords.hasAttribute('data-dsh-claude-wait-words'),
        current: lineOf(),
      }
      window.__pushForm({ chatAnimations: false })
      await sleep(300)
      r.wait.off = {
        line: row.querySelector('.dsh-claude-chat-wait') !== null,
        marked: row.hasAttribute('data-dsh-claude-wait'),
        wordsShown: getComputedStyle(words).display !== 'none',
        wordsMarked: words.hasAttribute('data-dsh-claude-wait-words'),
        foreignShown: getComputedStyle(foreignLine).display !== 'none',
      }
      window.__pushForm({ chatAnimations: true })
      await sleep(300)
      waitSession.remove()
      await sleep(300)
      r.wait.removed = { wordsMarked: words.hasAttribute('data-dsh-claude-wait-words') }
    })
  })
})()
