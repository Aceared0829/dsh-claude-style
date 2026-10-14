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
        '<div data-chat-running="true" style="display:flex"><span role="status">Deep diving</span><span aria-hidden="true"></span>' +
        '<span style="display:flex;min-width:0"><span class="_c_runningIcon_1" aria-hidden="true">whale</span><span data-shimmer="true" id="debugRunningWords">Deep diving for 1m 5s ···</span></span></div>' +
        '</div>'
      document.body.appendChild(waitSession)
      var row = waitSession.querySelector('[data-chat-running]')
      var words = document.getElementById('debugRunningWords')
      var whale = row.querySelector('[class*="_runningIcon"]')
      var foreignLine = document.createElement('div')
      foreignLine.textContent = 'Third-party status'
      words.parentElement.appendChild(foreignLine)
      var lineOf = function () {
        var line = row.querySelector('.dsh-claude-chat-wait')
        if (line === null) return null
        // The line's parts are read by their own names rather than by position:
        // the loader leads them, and where each of the rest sits is the
        // stylesheet's business (chat-wait.css).
        var loader = line.querySelector('.dsh-claude-chat-wait-loader')
        var label = line.querySelector('.dsh-claude-chat-wait-label')
        var clock = line.querySelector('.dsh-claude-chat-wait-clock')
        var badge = line.querySelector('.dsh-claude-chat-wait-badge')
        var dots = loader.children
        var dotStyle = getComputedStyle(dots[0])
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
          // The paint rides the copy showing the words — never the label, whose
          // box stands taller by the swap's travel — so the reading is taken
          // off the last copy (the one arriving while a swap runs). Which paint
          // that is comes from the Motion tab's choice, read here off the
          // document as well so a name and a choice that disagree are caught.
          sweep: copies.length > 0
            ? getComputedStyle(copies[copies.length - 1], '::before').animationName
            : 'none',
          statusMotion: document.body.getAttribute('data-dsh-claude-status-motion'),
          sweepOnLabel: label.classList.contains('dsh-claude-swap-shimmer'),
          filter: movingStyle === null ? 'none' : movingStyle.filter,
          opacity: movingStyle === null ? '1' : movingStyle.opacity,
          clock: clock.hidden ? null : clock.textContent,
          badge: badge.hidden ? null : badge.textContent,
          // The loader the Claude brand leads the line with, and the host's own
          // whale tail it stands in for: the dots are the accent in force, they
          // bounce on the snippet's own period with the second and third
          // staggered behind the first, and they carry no shadow.
          loader: {
            shown: getComputedStyle(loader).display !== 'none',
            dots: dots.length,
            animation: dotStyle.animationName,
            duration: dotStyle.animationDuration,
            delay: getComputedStyle(dots[2]).animationDelay,
            background: dotStyle.backgroundColor,
            shadow: dotStyle.boxShadow,
          },
          whaleShown: getComputedStyle(whale).display !== 'none',
          // The box the swap runs in, and where the clock beside it sits: the
          // hidden sizer holds the wider half while words change, so neither may
          // move during a swap, and comes down onto the words standing once they
          // settle — the clock then sits right after them (shared/swapping-text.ts).
          // Positions and widths share the browser's fractional coordinate space:
          // rounding them independently changes their relative displacement.
          box: {
            width: label.getBoundingClientRect().width,
            height: label.getBoundingClientRect().height,
            clockLeft: clock.getBoundingClientRect().left,
            labelLeft: label.getBoundingClientRect().left,
            lineLeft: line.getBoundingClientRect().left,
            lineWidth: line.getBoundingClientRect().width,
            lineRight: line.getBoundingClientRect().right,
            rowRight: row.getBoundingClientRect().right,
            labelRight: label.getBoundingClientRect().right,
            // A wording longer than the label's box: the box clips it and the
            // copy draws an ellipsis (shared/swapping-text.css).
            clipped: (function () {
              var copy = label.querySelector('.dsh-claude-swap-copy')
              if (copy === null) return null
              return copy.scrollWidth > copy.clientWidth && getComputedStyle(copy).textOverflow === 'ellipsis'
            })(),
            sizer: (function () {
              var sizer = label.querySelector('.dsh-claude-swap-sizer')
              return sizer === null ? null : { text: sizer.textContent, width: sizer.getBoundingClientRect().width }
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
        for (var round = 0; round < 48; round += 1) {
          frames.push(lineOf())
          await sleep(25)
        }
        // One settled frame after the window: the swap can land late in it, and
        // the last reading is what "at rest" is judged on.
        await sleep(250)
        frames.push(lineOf())
        return frames
      }
      // A wording written stands a whole second (WORD_LOCK_MS), so a reading of
      // a state the fixture has just moved to waits for the line to reach it
      // rather than sleeping a fixed stretch: the lock, the swap after it and
      // the state before it all land at different moments. The deadline is the
      // bound, and a reading that never arrives answers with what stood.
      var awaitWord = async function (want) {
        var deadline = Date.now() + 4000
        for (;;) {
          var reading = lineOf()
          if (reading !== null && want(reading)) return reading
          if (Date.now() > deadline) return reading
          await sleep(50)
        }
      }
      r.wait = { working: await awaitWord(function (reading) { return reading.word === 'Thinking…' && reading.copies === 1 }) }
      // The whale tail is DeepSeek's own character: under that brand the host's
      // icon comes back and the skin's dots stand down, and the Claude brand
      // takes them up again.
      window.__pushForm({ brand: 'deepseek' })
      await sleep(250)
      r.wait.deepseek = lineOf()
      window.__pushForm({ brand: 'claude' })
      await sleep(250)
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
          // The bound is the swap's own length, not a frame count: the stand-in's
          // frames arrive faster than a display's, and a count that covers the
          // whole swap on one machine reads only its beginning on another. A few
          // frames of the climb are kept either way, and the timeout above is the
          // outer bound.
          if (frames.length >= 6 && Number(style.opacity) >= 0.999) { done(); return }
          if (frames.length >= 240) { done(); return }
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
      var calls = window.__dshSmokeHost.turnFixtureCalls
      calls.push({ turn: 2 })
      r.wait.tools = await awaitWord(function (reading) { return reading.word === 'Running tools…' && reading.copies === 1 })
      // A call that has its arguments names the file it works on; one whose
      // arguments are still arriving names nothing yet.
      calls[0] = { turn: 2, phase: 'start', name: 'read', argsRaw: JSON.stringify({ file_path: 'C:\\work\\app.js' }) }
      r.wait.fileCall = await awaitWord(function (reading) { return reading.word === 'Reading app.js' && reading.copies === 1 })
      calls[0] = { turn: 2, phase: 'preparing', name: 'read', argsRaw: '{"file_path":"C:\\\\work\\\\app' }
      r.wait.arriving = await awaitWord(function (reading) { return reading.word === 'Running tools…' && reading.copies === 1 })
      calls.length = 0
      // Reasoning the line can take words from: the model's own clause, the
      // participle first, up to the sentence's end.
      window.__dshSmokeHost.turnFixtureRunning.steps = [{ data: { get: function (kind) { return kind === 'assistant-step' ? { status: 'running', step: 2, blocks: [{ kind: 'reasoning', text: 'Let me look. I am checking the file is true. ' }] } : undefined } } }]
      r.wait.phrase = await awaitWord(function (reading) { return reading.word === 'Checking the file is true' && reading.copies === 1 })
      // The same kind of wording in a row with no room for it: the label gives
      // way and the words are cut, so the clock keeps its place on the row.
      window.__dshSmokeHost.turnFixtureRunning.steps = [{ data: { get: function (kind) { return kind === 'assistant-step' ? { status: 'running', step: 2, blocks: [{ kind: 'reasoning', text: 'I am checking whether the whole row model still reads the same arguments. ' }] } : undefined } } }]
      waitSession.style.maxWidth = '240px'
      r.wait.narrow = await awaitWord(function (reading) { return reading.word === 'Checking whether the whole row model sti…' && reading.copies === 1 })
      waitSession.style.maxWidth = ''
      // The reader's animation choice: reduced writes the new wording at once.
      window.__pushForm({ motion: 'reduced' })
      await sleep(200)
      window.__dshSmokeHost.turnFixtureRunning.steps = [{ data: { get: function (kind) { return kind === 'assistant-step' ? { status: 'running', step: 2, blocks: [{ kind: 'reasoning', text: '先看清工作区。' }] } : undefined } } }]
      r.wait.reduced = await awaitWord(function (reading) { return reading.word === 'Thinking…' && reading.copies === 1 && reading.phase === null })
      window.__pushForm({ motion: 'system' })
      await sleep(200)
      // The Motion tab's second paint: the words take the colour wash and its
      // two loops instead of the band, and picking the band again hands them
      // back. The choice is one document attribute, so a reading after one
      // sleep is the whole paint.
      window.__pushForm({ statusMotion: 'wash' })
      await sleep(200)
      r.wait.wash = lineOf()
      window.__pushForm({ statusMotion: 'sweep' })
      await sleep(200)
      r.wait.sweepAgain = lineOf()
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
      var ownership = function () {
        return {
          line: row.querySelector('.dsh-claude-chat-wait') !== null,
          marked: row.hasAttribute('data-dsh-claude-wait'),
          wordsMarked: words.hasAttribute('data-dsh-claude-wait-words'),
          externalHiding: words.style.display,
          foreignShown: foreignLine.checkVisibility(),
          follow: document.body.hasAttribute('data-dsh-claude-chat-follow'),
        }
      }
      words.style.display = 'none'
      await sleep(400)
      r.wait.takeover = ownership()
      foreignLine.hidden = true
      await sleep(400)
      r.wait.hiddenReplacement = ownership()
      foreignLine.hidden = false
      await sleep(400)
      r.wait.visibleReplacement = ownership()
      words.style.removeProperty('display')
      await sleep(400)
      r.wait.hostRestored = ownership()
      window.__pushForm({ chatAnimations: false })
      await sleep(300)
      words.style.display = 'none'
      window.__pushForm({ chatAnimations: true })
      await sleep(400)
      r.wait.existingOwner = ownership()
      foreignLine.remove()
      words.style.removeProperty('display')
      await sleep(400)
      r.wait.ownerRemoved = ownership()
      words.parentElement.appendChild(foreignLine)
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
