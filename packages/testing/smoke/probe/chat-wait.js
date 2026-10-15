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
      // The running row stands in the host's conversation anchor, where the
      // skin reads its chat parts (D3).
      var waitHolder = document.createElement('div')
      waitHolder.setAttribute('data-conversation-scroll', '')
      var waitSession = document.createElement('div')
      waitSession.setAttribute('data-conversation-session', 'smoke-session')
      waitSession.innerHTML = '<div data-chat-flow="">' +
        '<div data-chat-running="true" style="display:flex"><span role="status">Deep diving</span><span aria-hidden="true"></span>' +
        '<span style="display:flex;min-width:0"><span class="_runningIcon_c_1" aria-hidden="true">whale</span><span data-shimmer="true" id="debugRunningWords">Deep diving for 1m 5s ···</span></span></div>' +
        '</div>'
      waitHolder.appendChild(waitSession)
      document.body.appendChild(waitHolder)
      var row = waitSession.querySelector('[data-chat-running]')
      var words = document.getElementById('debugRunningWords')
      // The parts land on the pass after the subtree arrives (D3).
      var whale = null
      for (var look = 0; look < 40 && whale === null; look++) {
        await sleep(50)
        whale = row.querySelector('[data-dsh-claude-part~="running-icon"]')
      }
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
          // Whether that paint is running or held: the Reduced choice freezes
          // it, and a pressed animation left running would flicker.
          sweepState: copies.length > 0
            ? getComputedStyle(copies[copies.length - 1], '::before').animationPlayState
            : 'none',
          statusMotion: document.body.getAttribute('data-dsh-claude-status-motion'),
          sweepOnLabel: label.classList.contains('dsh-claude-swap-shimmer'),
          filter: movingStyle === null ? 'none' : movingStyle.filter,
          opacity: movingStyle === null ? '1' : movingStyle.opacity,
          clock: clock.hidden ? null : clock.textContent,
          badge: badge.hidden ? null : badge.textContent,
          // The loader the Claude brand leads the line with, and the host's own
          // whale tail it stands in for: the dots are the accent in force, they
          // carry no shadow, and which motion they play follows what the turn is
          // doing — the snippet's bounce while it thinks, the dots' own lines
          // while it works (features/chat-wait/wait-loader.ts). The pose is read
          // off the first dot, whose line is the vertical one.
          loader: {
            shown: getComputedStyle(loader).display !== 'none',
            dots: dots.length,
            animation: dotStyle.animationName,
            duration: dotStyle.animationDuration,
            delay: getComputedStyle(dots[2]).animationDelay,
            background: dotStyle.backgroundColor,
            shadow: dotStyle.boxShadow,
            motion: loader.className,
            arriving: Array.from(loader.classList).some(function (name) { return name.indexOf('is-arriving-') === 0 }),
            translate: dotStyle.translate,
            scale: dotStyle.scale,
            // Each dot's own start in its motion: the phase a dot stands at,
            // which is what tells two dots doing the same walk apart.
            delays: Array.prototype.map.call(dots, function (one) { return getComputedStyle(one).animationDelay }),
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
      // The two halves of the wording swap travel together: the old one leaves
      // upward with a blur while the new one stands parked below and is released
      // one gap later, so both copies are in the box for the rest of the swap.
      // Sampled across the swap, rather than once at the end: the leave lasts
      // 150ms, so the grid has to be far finer than it for the last leave frame
      // to read as gone.
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
      // takes them up again. The word the line waits on follows the brand too
      // (shared/turn-activity): the skin's own under Claude, and the host's own
      // — the one the host's own interface shows — under DeepSeek.
      window.__pushForm({ brand: 'deepseek' })
      r.wait.deepseek = await awaitWord(function (reading) { return reading.word === 'Deep diving' && reading.copies === 1 })
      window.__pushForm({ brand: 'claude' })
      r.wait.claudeAgain = await awaitWord(function (reading) { return reading.word === 'Thinking…' && reading.copies === 1 })
      foreignLine.remove()
      words.parentElement.appendChild(foreignLine)
      await sleep(300)
      r.wait.foreignAfter = lineOf()
      // The loader changes motion with the turn's state, at once, where the
      // wording below waits out its own second-long lock: watched as the tool
      // call arrives, so the gather the change runs through is sampled — it is
      // shorter than the lock and a reading at either end would miss it.
      var watchLoader = async function (want) {
        var frames = []
        for (var round = 0; round < 40; round += 1) {
          var reading = lineOf()
          frames.push(reading === null ? null : reading.loader)
          if (reading !== null && want(reading.loader)) break
          await sleep(20)
        }
        return frames
      }
      // One dot's walk read off the animation itself: the three dots run the
      // same clock, so stepping that clock through a whole period — all three
      // together, which keeps them a third of a period apart — reads the walk's
      // own curve rather than what the display happened to render, and reads it
      // at even steps with no frame timing in them. The clock is handed back
      // where it stood once the readings are in.
      var WALK_STEP = 25
      var watchWalk = async function () {
        var line = row.querySelector('.dsh-claude-chat-wait')
        var loader = line === null ? null : line.querySelector('.dsh-claude-chat-wait-loader')
        if (loader === null) return null
        var dots = Array.prototype.slice.call(loader.children)
        var running = dots.map(function (dot) { return dot.getAnimations()[0] })
        if (running.some(function (animation) { return animation === undefined })) return null
        var stood = running[0].currentTime
        var began = performance.now()
        var frames = []
        for (var round = 0; round < 50; round += 1) {
          var at = round * WALK_STEP
          running.forEach(function (animation) { animation.currentTime = at })
          var style = getComputedStyle(dots[0])
          frames.push({ at: at, translate: style.translate, scale: style.scale })
        }
        running.forEach(function (animation) { animation.currentTime = stood + (performance.now() - began) })
        return { step: WALK_STEP, frames: frames }
      }
      // A tool call in flight is a state of its own, with no block streaming.
      window.__dshSmokeHost.turnFixtureRunning.steps = [{ data: { get: function (kind) { return kind === 'assistant-step' ? { status: 'settled', step: 1, blocks: [{ kind: 'reasoning' }, { kind: 'tool-call' }] } : undefined } } }]
      var calls = window.__dshSmokeHost.turnFixtureCalls
      calls.push({ turn: 2 })
      r.wait.loaderChange = await watchLoader(function (loader) { return loader.animation === 'dsh-claude-wait-dot-line' })
      r.wait.tools = await awaitWord(function (reading) { return reading.word === 'Running tools…' && reading.copies === 1 })
      r.wait.walk = await watchWalk()
      // A call that has its arguments names the file it works on; one whose
      // arguments are still arriving names nothing yet.
      calls[0] = { turn: 2, phase: 'start', name: 'read', argsRaw: JSON.stringify({ file_path: 'C:\\work\\app.js' }) }
      r.wait.fileCall = await awaitWord(function (reading) { return reading.word === 'Reading app.js' && reading.copies === 1 })
      calls[0] = { turn: 2, phase: 'preparing', name: 'read', argsRaw: '{"file_path":"C:\\\\work\\\\app' }
      r.wait.arriving = await awaitWord(function (reading) { return reading.word === 'Running tools…' && reading.copies === 1 })
      // The lock the tool state carries is let run out before the turn is
      // emptied, so the swap below lands inside the window the entry's watcher
      // samples rather than being held back by a word written a moment ago.
      await sleep(900)
      // The model goes silent: the running turn has written nothing and no call
      // is in flight, so the line stands on the word its brand waits on — the
      // same word it says while the model is thinking. The swap that reaches it
      // is watched with the entry's own frames sampled by the browser rather
      // than by a polling loop: the window between the incoming copy's rest pose
      // and its release is shorter than a 10 ms poll can see, and the reading is
      // about how the two halves move together. The entering copy is the one
      // whose `data-text` names what the line is heading for, so it is found by
      // its words and watched frame by frame. The timeout is the bound: a frame
      // that never arrives answers with the frames that did.
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
          var copy = label === null ? null : label.querySelector('.dsh-claude-swap-copy[data-text="Thinking…"]')
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
      calls.length = 0
      window.__dshSmokeHost.turnFixtureRunning.steps = []
      // The turn going back to thinking changes the loader's motion the other
      // way, and its wording at the same time: the loader's own change is
      // watched alongside the swap below rather than after it, since the swap's
      // frames are the ones that have to be caught whole.
      var loaderBack = watchLoader(function (loader) { return loader.animation === 'dsh-claude-wait-dot' })
      r.wait.silent = await watchSwap()
      r.wait.loaderBack = await loaderBack
      r.wait.enterFrames = await waitForEnter
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
      // The dots under that choice: read twice a tenth of a second apart, so a
      // motion that never settles shows up as the two readings differing.
      var still = lineOf()
      await sleep(120)
      r.wait.reducedStill = { first: still, second: lineOf() }
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
