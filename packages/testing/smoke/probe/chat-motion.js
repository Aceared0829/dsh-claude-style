/**
 * The ported chat behaviours that watch a page over time: the follow hand-back
 * and the stream glide, the drawn caret, the automatic folding, and the token
 * reveal engine with the settings that withdraw it.
 */
(function () {
  var probe = window.__dshSmokeProbe
  var r = probe.report

  probe.step(async function () {
    // The ported chat-follow feature (packages/client/src/features/chat-follow/): a structural
    // moment hands the host's follow back, and a reader who took the scroll
    // over himself is left where he is.
    await probe.onlyFor(['chat-follow'], async function () {
      var followScroller = document.querySelector('[data-conversation-scroll]')
      var followColumn = document.querySelector('[data-chat-flow]')
      var cappedBody = document.querySelector('[data-step-process]:not([data-group-expanded-mode]) [data-step-process-body]')
      var expandedBody = document.querySelector('[data-step-process][data-group-expanded-mode] [data-step-process-body]')
      var endGap = function () {
        return Math.round(followScroller.scrollHeight - followScroller.clientHeight - followScroller.scrollTop)
      }
      // One walk, as the browser draws it: the first reading is taken where the
      // walk starts, the rest on the frames that follow, and the recording stops
      // on a run of frames that read the same position. D66's 动效的断言 reads
      // this sequence — monotone, at least two different values between the two
      // ends, the end equal to the target — so that the shape of the curve is
      // settled in the unit lane and this lane only asks whether it was walked.
      //
      // A walk out of a pin begins one frame after the content grew, when the
      // size subscription armed after the host's own takes the pin back and the
      // spring starts — so the recording waits for the frame the follow's hold
      // mark says the take-back happened on. Started in the writing turn, it
      // reads the pinned end every frame and never sees the walk at all.
      var recordWalk = function (gap, held) {
        return new Promise(function (resolve) {
          var readings = []
          var quiet = 0
          var frames = 0
          var started = false
          var read = function () {
            frames += 1
            if (!started) {
              started = held()
              if (!started) {
                if (frames >= 96) { resolve([]); return }
                requestAnimationFrame(read)
                return
              }
            }
            var value = gap()
            readings.push(value)
            if (readings.length > 1 && value === readings[readings.length - 2]) quiet += 1
            else quiet = 0
            // The quiet run is what ends a walk: a fixed wait would either cut a
            // slow runner's walk short or spend a second on a fast one.
            if (quiet >= 8 || readings.length >= 120) { resolve(readings); return }
            requestAnimationFrame(read)
          }
          requestAnimationFrame(read)
        })
      }
      /** Whether the glide's take-back has happened: the follow's hold mark stands on the column. */
      var glideHeld = function () {
        return document.querySelector('[data-dsh-claude-follow-hold]') !== null
      }
      /** Whether the capped body has left its end, which is where its catch-up walk starts. */
      var bodyWalking = function () {
        return cappedBody !== null && cappedBody.scrollHeight - cappedBody.clientHeight - cappedBody.scrollTop > 6
      }
      var structuralMoment = async function () {
        var node = document.createElement('div')
        node.setAttribute('data-chat-flow-key', 'probe')
        node.style.display = 'none'
        followColumn.appendChild(node)
        // Two hand-backs never land closer than the follow's own interval
        // (FOLLOW_MIN_INTERVAL_MS, a fifth of a second): the moment is held past
        // it, which is the product's clock, before it is taken away again.
        await probe.sleep(250)
        followColumn.removeChild(node)
        await probe.settle()
      }
      r.chatFollow = {
        marked: document.body.hasAttribute('data-dsh-claude-chat-follow'),
        overflowX: cappedBody === null ? null : getComputedStyle(cappedBody).overflowX,
        expandedOverflowX: expandedBody === null ? null : getComputedStyle(expandedBody).overflowX,
      }
      // At the end, so any reader-took-over the guard is holding is dropped.
      followScroller.scrollTop = followScroller.scrollHeight
      await probe.settle()
      await structuralMoment()
      // 60px off the end, the way a structural moment leaves it.
      followScroller.scrollTop = Math.max(0, followScroller.scrollHeight - followScroller.clientHeight - 60)
      await probe.settle()
      r.chatFollow.before = endGap()
      await structuralMoment()
      r.chatFollow.after = endGap()
      // A wheel of the reader's own: the hand-back stops until he returns.
      followScroller.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
      followScroller.scrollTop = Math.max(0, followScroller.scrollHeight - followScroller.clientHeight - 60)
      await probe.settle()
      r.chatFollow.readerBefore = endGap()
      await structuralMoment()
      r.chatFollow.readerAfter = endGap()
      // The capped body's catch-up is walked in on a curve, not written in one
      // frame (scroll-ease.ts): grow the content well past the catch-up
      // threshold and record every frame of the walk out of it.
      if (cappedBody !== null) {
        var cappedContent = cappedBody.querySelector('[data-step-process-content]')
        var bodyGap = function () {
          return Math.round(cappedBody.scrollHeight - cappedBody.clientHeight - cappedBody.scrollTop)
        }
        cappedBody.scrollTop = 0
        await probe.settle()
        if (cappedContent !== null) cappedContent.style.height = '900px'
        r.chatFollow.catchUp = await recordWalk(bodyGap, bodyWalking)
      }
      // The stream glide (chat-follow.ts): with the host's own streaming mark on
      // the page, the end the host's follow pins the position to is taken back
      // before the frame paints and handed to the spring, so the text walks there
      // instead of jumping. The mark is the host's; the pin is what its follow
      // does on every content change.
      followScroller.scrollTop = followScroller.scrollHeight
      await probe.settle()
      var streamingMark = document.createElement('div')
      streamingMark.setAttribute('data-streaming', '')
      followColumn.appendChild(streamingMark)
      var glideBlock = document.createElement('div')
      glideBlock.style.height = '300px'
      followColumn.appendChild(glideBlock)
      // The pin the host's own follow writes is taken back before the frame
      // paints and handed to the spring; the walk out of it is recorded from the
      // frame the take-back happens on, the same way as the catch-up above.
      followScroller.scrollTop = followScroller.scrollHeight
      r.chatFollow.glide = await recordWalk(endGap, glideHeld)
      r.chatFollow.glideDiag = {
        motion: document.body.getAttribute('data-dsh-claude-motion'),
        streamMark: document.querySelector('[data-streaming]') !== null,
        rolling: document.querySelector('[data-dsh-claude-rolling]') !== null,
        buttonMarked: document.querySelector('[data-dsh-claude-stream-glide]') !== null,
        followAttr: document.querySelector('[data-chat-following-tail]') !== null,
      }
      // The host's own button is kept out of sight while the glide follows: a
      // position held off the end reads to the host as a reader who left.
      r.chatFollow.glideButtonMarked = document.querySelector('[data-dsh-claude-stream-glide]') !== null
      // A message the reader has just sent is not streaming content: the host's
      // jump to it stands, and the glide stands down around it. The streaming
      // mark is still on the page here, so without the stand-down the glide
      // would take this jump back like any other.
      var userRow = document.createElement('div')
      userRow.setAttribute('data-chat-flow-key', 'sent')
      userRow.setAttribute('data-chat-flow-kind', 'user')
      userRow.style.height = '300px'
      followColumn.appendChild(userRow)
      // Every frame from the jump until the page settles: a take-back on any of
      // them would show as a frame off the end.
      followScroller.scrollTop = followScroller.scrollHeight
      r.chatFollow.submitGaps = await probe.watch(endGap)
      userRow.remove()
      await probe.settle()
      streamingMark.remove()
      glideBlock.remove()
      await probe.settle()
      followScroller.scrollTop = followScroller.scrollHeight
      await probe.settle()
      r.chatFollow.glideButtonBack = document.querySelector('[data-dsh-claude-stream-glide]') === null
    })
    // The ported caret motion (packages/client/src/features/caret/): the focused composer
    // surface gets a drawn caret and the native one gives way; switching the
    // feature off takes both away and gives the native one back.
    await probe.onlyFor(['caret'], async function () {
      var caretEditor = document.querySelector('[data-composer-input]')
      var caretOf = function () {
        var layer = document.querySelector('[data-dsh-claude-caret-layer]')
        return {
          layer: layer !== null,
          visible: layer !== null && layer.hasAttribute('data-dsh-claude-caret-visible'),
          transform: layer === null ? null : layer.style.transform,
          marked: caretEditor.hasAttribute('data-dsh-claude-caret'),
          nativeHidden: getComputedStyle(caretEditor).caretColor === 'rgba(0, 0, 0, 0)',
        }
      }
      var caretSelect = function () {
        caretEditor.focus()
        var text = caretEditor.firstChild
        if (text !== null && text.nodeType === 3) {
          var selection = document.getSelection()
          selection.removeAllRanges()
          var range = document.createRange()
          range.setStart(text, text.data.length)
          range.collapse(true)
          selection.addRange(range)
        }
        document.dispatchEvent(new Event('selectionchange'))
      }
      caretSelect()
      await probe.settle()
      r.caret = { on: caretOf() }
      // The plain surface: a textarea under the seat is measured through the
      // hidden mirror, and taken over the same way.
      var answer = document.getElementById('debugAnswer')
      if (answer !== null) {
        answer.focus()
        answer.selectionStart = answer.value.length
        answer.selectionEnd = answer.value.length
        document.dispatchEvent(new Event('selectionchange'))
        await probe.settle()
        var answerLayer = answer.parentElement.querySelector('[data-dsh-claude-caret-layer]')
        r.caret.plain = {
          layer: answerLayer !== null,
          marked: answer.hasAttribute('data-dsh-claude-caret'),
          visible: answerLayer !== null && answerLayer.hasAttribute('data-dsh-claude-caret-visible'),
          nativeHidden: getComputedStyle(answer).caretColor === 'rgba(0, 0, 0, 0)',
        }
        caretSelect()
        await probe.settle()
      }
      window.__pushForm({ caretMotion: 'off' })
      await probe.settle()
      r.caret.off = caretOf()
      window.__pushForm({ caretMotion: 'typing' })
      await probe.settle()
      r.caret.back = caretOf()
      // The animation choice stills the drawn caret through its own stylesheet
      // rule (caret.css), which is what D40's resolved attribute is for.
      window.__pushForm({ motion: 'reduced' })
      await probe.settle()
      var reducedLayer = document.querySelector('[data-dsh-claude-caret-layer]')
      r.caret.reduced = reducedLayer === null ? null : {
        layer: true,
        transition: getComputedStyle(reducedLayer).transitionDuration,
        animation: getComputedStyle(reducedLayer).animationName,
      }
      window.__pushForm({ motion: 'system' })
      await probe.settle()
    })
    // The ported automatic folding (packages/client/src/features/chat-fold/): a running thinking
    // row and a running process group are opened at install, both fold back when
    // their section ends, a tier that does not cap its body is never pressed, and
    // a group the reader opened himself in that phase stays open.
    await probe.onlyFor(['chat-fold'], async function () {
      var foldThink = document.getElementById('debugThink')
      var foldGroup = document.getElementById('debugGroup')
      var foldHeader = document.getElementById('debugGroupHeader')
      var foldBody = document.getElementById('debugGroupBody')
      var foldExpandedBody = document.getElementById('debugExpandedBody')
      // The header's counted summary: the skin's span after the host's words,
      // which step aside, the wording the header has room for, and the sentence
      // as the header's name. The width check's own numbers come along, so a
      // failing case carries them.
      var foldWords = document.getElementById('debugGroupWords')
      // The figures one holder lays out — the summary itself, or the band's copy
      // of it — read as the words around each standing digit; a roll's sizer
      // holds the digit too, so its text is no reading.
      var figuresOf = function (holder) {
        return Array.prototype.map.call(holder.querySelectorAll(':scope > .dsh-claude-process-summary-part'), function (part) {
          var words = part.querySelectorAll('.dsh-claude-process-summary-words')
          var digit = part.querySelector('.dsh-claude-process-summary-roll [data-dsh-claude-roll]:not([data-dsh-claude-roll="exit"])')
          return words[0].textContent + (digit === null ? '' : digit.textContent) + words[1].textContent
        }).join('')
      }
      var summaryOf = function () {
        var summary = foldHeader.querySelector('.dsh-claude-process-summary')
        if (summary === null) return null
        var fit = summary.querySelector('.dsh-claude-process-summary-fit')
        var style = getComputedStyle(foldHeader)
        var parentStyle = getComputedStyle(foldGroup)
        var gap = parseFloat(style.columnGap) || 0
        // The room the control may spend, measured the way the module measures it.
        var room = foldGroup.clientWidth - (parseFloat(parentStyle.paddingLeft) || 0) - (parseFloat(parentStyle.paddingRight) || 0)
          - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
          - (parseFloat(style.borderLeftWidth) || 0) - (parseFloat(style.borderRightWidth) || 0)
        for (var i = 0; i < foldHeader.children.length; i++) {
          var child = foldHeader.children[i]
          if (child === summary) continue
          var width = child.getBoundingClientRect().width
          if (width > 0) room -= width + gap
        }
        return {
          marked: foldGroup.hasAttribute('data-dsh-claude-summary'),
          name: foldHeader.getAttribute('aria-label'),
          form: summary.getAttribute('data-dsh-claude-summary-form'),
          // The summary's own figures: the band over a running one holds a copy
          // of them, which is read on its own below.
          text: figuresOf(summary),
          sentence: fit === null ? null : Math.round(fit.getBoundingClientRect().width),
          room: Math.round(room),
          headerWidth: foldHeader.clientWidth,
          running: summary.hasAttribute('data-dsh-claude-summary-running'),
          // The host's band over the running summary (shared/sweep-band.ts):
          // the two halves it runs, and the figures its copy holds.
          band: (function () {
            var band = summary.querySelector(':scope > .dsh-claude-sweep-band')
            if (band === null) return null
            return {
              animation: getComputedStyle(band).animationName + ', ' + getComputedStyle(band.firstElementChild).animationName,
              text: figuresOf(band.firstElementChild),
              // The copy's digits stand still while the summary's own roll.
              rolling: band.querySelector('[data-dsh-claude-roll="enter"], [data-dsh-claude-roll="exit"]') !== null,
            }
          })(),
          rolling: summary.querySelector('[data-dsh-claude-roll="enter"]') !== null,
          wordsShown: getComputedStyle(foldWords).display !== 'none',
          summaryShown: getComputedStyle(summary).display !== 'none',
        }
      }
      // The wording answers the room the header has, a frame or two behind a
      // change: a reading is taken once the page has settled.
      var settledSummary = async function () {
        await probe.settle()
        return summaryOf()
      }
      r.fold = {
        thinkOpen: foldThink.hasAttribute('data-expanded'),
        groupOpen: !foldBody.hasAttribute('hidden'),
        summary: await settledSummary(),
        expandedUntouched: !foldExpandedBody.hasAttribute('hidden'),
        clicks: Object.assign({}, window.__foldClicks),
      }
      // Another call arrives in the group: its figure rolls to the new count.
      var moreCall = document.createElement('div')
      moreCall.setAttribute('data-chat-flow-kind', 'tool-call')
      moreCall.textContent = 'another call'
      document.getElementById('debugGroupContent').appendChild(moreCall)
      r.fold.grown = await settledSummary()
      // A header too narrow for the sentence falls back to the compact figures,
      // and takes the sentence back when the room returns.
      foldGroup.style.width = '120px'
      r.fold.narrow = await settledSummary()
      foldGroup.style.width = ''
      r.fold.wide = await settledSummary()
      // The reasoning stops and the process section ends: both fold back, and
      // the host's words stop sweeping.
      foldThink.setAttribute('data-state', 'ok')
      foldWords.removeAttribute('data-shimmer')
      foldWords.textContent = 'Worked'
      await probe.settle()
      r.fold.after = {
        thinkOpen: foldThink.hasAttribute('data-expanded'),
        groupOpen: !foldBody.hasAttribute('hidden'),
        summary: summaryOf(),
        clicks: Object.assign({}, window.__foldClicks),
      }
      // The reasoning's streamed window (reasoning-stream.ts, transitions.dev's
      // "Reasoning stream"): the window takes the text's own height up to the cap
      // reasoning may reach, and only at that cap does the text step up on the
      // snippet's clock behind a mask. The first row is grown three lines at a
      // time, and read once the page has settled after each growth, so the
      // window is read while it grows and again once it is held at the cap; the
      // second stands over the cap from the start, and every frame of its steps
      // is recorded until they stop at the newest line.
      var growBody = document.getElementById('debugThinkBody')
      var growText = document.getElementById('debugThinkText')
      var reasonBody = document.getElementById('debugGrowBody')
      var reasonText = document.getElementById('debugGrowText')
      var windowOf = function (body, text) {
        var style = getComputedStyle(body)
        var textStyle = getComputedStyle(text)
        var matrix = /matrix\(1, 0, 0, 1, 0, (-?[\d.]+)\)/.exec(textStyle.transform)
        return {
          on: body.hasAttribute('data-dsh-claude-reason-window'),
          capped: body.hasAttribute('data-dsh-claude-reason-capped'),
          slotHeight: Math.round(body.getBoundingClientRect().height),
          bodyHeight: Math.round(body.closest('[data-variant="think"]').getBoundingClientRect().height),
          maxHeight: style.maxHeight,
          mask: (style.maskImage === 'none' ? style.webkitMaskImage : style.maskImage).slice(0, 44),
          textHeight: Math.round(text.getBoundingClientRect().height),
          offset: matrix === null ? 0 : -Number(matrix[1]),
          transform: textStyle.transform,
          transition: textStyle.getPropertyValue('transition-property') + ' ' + textStyle.getPropertyValue('transition-duration'),
        }
      }
      // The row reopens for the reasoning: the fold closes it when the phase
      // turns ok, and the window's own reading is of a running, open row.
      foldThink.setAttribute('data-state', 'running')
      r.fold.reasonGrow = await probe.watch(function () { return windowOf(reasonBody, reasonText) })
      r.fold.reasonWindow = [windowOf(growBody, growText)]
      var growLine = 3
      var growMore = async function () {
        for (var added = 0; added < 3; added += 1) {
          growLine += 1
          growText.appendChild(document.createElement('br'))
          growText.appendChild(document.createTextNode('接着想第 ' + growLine + ' 行。'))
        }
        // The fold's observer queues a row for an attribute change, which is how
        // a live stream reaches the window between steps.
        document.getElementById('debugThink').setAttribute('data-state', 'ok')
        document.getElementById('debugThink').setAttribute('data-state', 'running')
        await probe.settle()
      }
      for (var growRound = 0; growRound < 3; growRound += 1) {
        await growMore()
        r.fold.reasonWindow.push(windowOf(growBody, growText))
      }
      // The reasoning stops and the reader opens the row: the window is off and
      // the whole text stands in the host's own body again. The capped row's own
      // phase end goes with it, so the window's exit is read as well.
      r.fold.reasonStopped = windowOf(reasonBody, reasonText)
      document.getElementById('debugGrow').setAttribute('data-state', 'ok')
      document.getElementById('debugThink').setAttribute('data-state', 'ok')
      await probe.settle()
      r.fold.reasonClosed = windowOf(reasonBody, reasonText)
      r.fold.reasonGrewClosed = windowOf(growBody, growText)
      document.getElementById('debugThinkRow').click()
      await probe.settle()
      r.fold.reasonOpen = windowOf(growBody, growText)
      // The fold glide on the reader's own press: the click is intercepted, the
      // real element is pressed with the door marked, and the click is handed back
      // afterwards so the host collapses it.
      var disclosure = document.getElementById('debugDisclosure')
      var disclosureBody = function () { return document.getElementById('debugDisclosureBody') }
      var disclosureBefore = window.__disclosureClicks
      // One door, every frame from the press until the page settles: what the
      // frames that carried the door showed, and how the last one stands.
      var doorOf = function (bodyOf, clicksSince) {
        return function () {
          var body = bodyOf()
          return {
            present: body !== null,
            rolling: body !== null && body.hasAttribute('data-dsh-claude-rolling'),
            clipped: body !== null && body.style.overflow === 'hidden',
            rollingAnywhere: document.querySelector('[data-dsh-claude-rolling]') !== null,
            clicks: clicksSince(),
          }
        }
      }
      var rollOf = function (frames) {
        var during = frames.filter(function (frame) { return frame.rolling })
        return {
          rolling: during.length > 0,
          clipped: during.length > 0 && during.every(function (frame) { return frame.clipped }),
          clicksDuringRoll: during.length === 0 ? null : Math.max.apply(null, during.map(function (frame) { return frame.clicks })),
          inserted: frames.some(function (frame) { return frame.present }),
          last: frames[frames.length - 1],
        }
      }
      var disclosureDoor = doorOf(disclosureBody, function () { return window.__disclosureClicks - disclosureBefore })
      disclosure.click()
      var closing = rollOf(await probe.watch(disclosureDoor))
      r.fold.glide = {
        rolling: closing.rolling,
        clipped: closing.clipped,
        clicksDuringRoll: closing.clicksDuringRoll,
        after: { bodyGone: !closing.last.present, rollingAnywhere: closing.last.rollingAnywhere, clicks: closing.last.clicks },
      }
      // The opening direction: the press is remembered as an intent, the host
      // inserts the body, and the door rolls it open.
      disclosure.click()
      var opening = rollOf(await probe.watch(disclosureDoor))
      r.fold.glide.open = { inserted: opening.inserted, rolling: opening.rolling }
      r.fold.glide.openAfter = { present: opening.last.present, rolling: opening.last.rolling }
      // The reader's own press in this phase: the module leaves it alone.
      foldHeader.click()
      await probe.settle()
      r.fold.readerOpen = !foldBody.hasAttribute('hidden')
      // A row the host wraps in a header: the door has to step out of that
      // wrapper for its body, and the accessory beside the row is not it.
      var wrappedRow = document.getElementById('debugWrappedRow')
      var wrappedAccessory = document.getElementById('debugWrappedAccessory')
      var wrappedBody = function () { return document.getElementById('debugWrappedBody') }
      var wrappedBefore = window.__wrappedClicks
      var wrappedDoor = doorOf(wrappedBody, function () { return window.__wrappedClicks - wrappedBefore })
      var accessoryRolled = false
      wrappedRow.click()
      var rolled = rollOf(await probe.watch(function () {
        if (wrappedAccessory.hasAttribute('data-dsh-claude-rolling')) accessoryRolled = true
        return wrappedDoor()
      }))
      r.fold.wrappedRolled = {
        rolling: rolled.rolling,
        clipped: rolled.clipped,
        accessoryRolled: accessoryRolled,
        clicksDuringRoll: rolled.clicksDuringRoll,
        bodyGone: !rolled.last.present,
        folded: wrappedRow.getAttribute('aria-expanded') === 'false',
        clicks: rolled.last.clicks,
      }
      // The switch covers the door and the entrance fade as well as the automatic
      // folding: off, a press reaches the host's own handler in the same turn and
      // an inserted body carries no transition (fold-motion.css rides
      // data-dsh-claude-chat-fold).
      var foldFlow = document.getElementById('debugFlow')
      var entranceOf = function () {
        var row = document.createElement('button')
        row.setAttribute('type', 'button')
        row.setAttribute('data-disclosure-row', '')
        var body = document.createElement('div')
        body.textContent = 'probe body'
        foldFlow.appendChild(row)
        foldFlow.appendChild(body)
        var value = getComputedStyle(body).transitionDuration
        row.remove()
        body.remove()
        return value
      }
      // The wrapped family: the body standing after the header carries the fade,
      // and the accessory beside the row inside it keeps the page's own reading.
      // That reading is taken on a bare span first, so a page-wide transition
      // cannot answer for the entrance rule.
      var bareSpan = document.createElement('span')
      foldFlow.appendChild(bareSpan)
      var pageSpan = getComputedStyle(bareSpan).transitionDuration
      bareSpan.remove()
      var wrappedEntranceOf = function () {
        var header = document.createElement('div')
        header.setAttribute('data-disclosure-header', '')
        var row = document.createElement('div')
        row.setAttribute('data-disclosure-row', '')
        var accessory = document.createElement('span')
        accessory.textContent = 'accessory'
        var body = document.createElement('div')
        body.textContent = 'probe body'
        header.appendChild(row)
        header.appendChild(accessory)
        foldFlow.appendChild(header)
        foldFlow.appendChild(body)
        var value = {
          body: getComputedStyle(body).transitionDuration,
          accessory: getComputedStyle(accessory).transitionDuration,
          page: pageSpan,
        }
        header.remove()
        body.remove()
        return value
      }
      r.fold.entranceOn = entranceOf()
      r.fold.entranceWrapped = wrappedEntranceOf()
      window.__pushForm({ chatAnimations: false })
      await probe.settle()
      var offBefore = window.__disclosureClicks
      disclosure.click()
      var offImmediate = window.__disclosureClicks - offBefore
      await probe.settle()
      r.fold.animationsOff = {
        mark: document.body.hasAttribute('data-dsh-claude-chat-fold'),
        entrance: entranceOf(),
        wrappedEntrance: wrappedEntranceOf(),
        immediateClicks: offImmediate,
        rolling: document.querySelector('[data-dsh-claude-rolling]') !== null,
      }
      window.__pushForm({ chatAnimations: true })
      await probe.settle()
      r.fold.animationsBack = { mark: document.body.hasAttribute('data-dsh-claude-chat-fold') }
    })
    // The ported token reveal (packages/client/src/features/chat-reveal/): characters arriving in
    // a streaming container are registered as named highlights from the faintest
    // step, they are gone once faded, and the preference withdraws the engine
    // whole.
    await probe.onlyFor(['chat-reveal'], async function () {
      var revealPeek = function () {
        var registry = window.CSS ? window.CSS.highlights : null
        var total = 0
        var steps = 0
        if (registry) {
          for (var step = 0; step < 24; step += 1) {
            var found = registry.get('dsh-claude-tok-' + step)
            var size = found ? found.size : 0
            total += size
            if (size > 0) steps += 1
          }
        }
        return { total: total, steps: steps, mark: document.body.hasAttribute('data-dsh-claude-chat-reveal') }
      }
      // The fade ships off: a container streaming before the choice is turned on
      // gets nothing at all, which is the answer the row offers first.
      var revealShippedContainer = document.createElement('div')
      revealShippedContainer.setAttribute('data-streaming', '')
      revealShippedContainer.textContent = 'Hello there'
      document.body.appendChild(revealShippedContainer)
      await probe.settle()
      var revealShipped = revealPeek()
      revealShippedContainer.remove()
      window.__pushForm({ chatReveal: 'on' })
      await probe.settle()
      // Characters arriving, then more of them: every frame from each arrival
      // until the fade has run out, so the registration is read on the frames
      // that carry it and the empty registry on the one the page settles on.
      var revealContainer = document.createElement('div')
      revealContainer.setAttribute('data-streaming', '')
      revealContainer.textContent = 'Hello there'
      document.body.appendChild(revealContainer)
      var revealOpening = await probe.watch(revealPeek)
      revealContainer.firstChild.data = 'Hello there, more'
      var revealGrown = await probe.watch(revealPeek)
      var revealSettled = revealGrown[revealGrown.length - 1]
      window.__pushForm({ chatReveal: 'off' })
      await probe.settle()
      var revealOff = revealPeek()
      window.__pushForm({ chatReveal: 'on' })
      await probe.settle()
      var revealBack = revealPeek()
      // The animation choice: "reduced" withdraws the engine the same way the
      // preference does (D40 — the resolved choice, not the system query).
      window.__pushForm({ motion: 'reduced' })
      await probe.settle()
      var revealReduced = revealPeek()
      window.__pushForm({ motion: 'system' })
      await probe.settle()
      // And the system setting flipping underneath "follow the system": the
      // resolved attribute moves, the preference stream is re-run and a running
      // engine goes with it (packages/client/src/core/prefs.ts, refreshMotionAttribute).
      window.__setSystemReduced(true)
      await probe.settle()
      var revealFlipReduced = revealPeek()
      window.__setSystemReduced(false)
      await probe.settle()
      var revealFlipBack = revealPeek()
      revealContainer.remove()
      r.reveal = {
        shipped: revealShipped, opening: revealOpening, grown: revealGrown, settled: revealSettled, off: revealOff, back: revealBack,
        reduced: revealReduced, systemFlip: { reduced: revealFlipReduced, back: revealFlipBack },
      }
    })
  })
})()
