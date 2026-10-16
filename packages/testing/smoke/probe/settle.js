/**
 * The page is left to settle, then the readings every case draws on: the idle
 * pass count, the host's hidden statistics figures and the session list's
 * leading seats.
 */
(function () {
  var probe = window.__dshSmokeProbe
  var sleep = probe.sleep
  var r = probe.report

  probe.step(async function () {
    // The reads below depend on the skin's first pass having landed, and the
    // full tier's idle check counts the frames the page asks for in one second
    // of wall clock. A renderer still coming up hands out a frame or two per
    // second, so a quiet window measured in wall clock closes between two frames
    // while the skin's first work is still queued, and that count then reads
    // those frames as a page that never went idle — a fresh Windows runner read
    // exactly 2 passes in the first page's eight cases. Ask for frames here
    // instead, through the rAF the stand-in did not wrap, and wait for a run of
    // them that carries none of the page's own.
    //
    // A run of quiet frames is not enough on its own: a timer that came due just
    // behind them asks for its frame a few milliseconds later, and a loaded
    // runner then reads that single frame inside the measured second (nine page
    // loads read exactly 1 pass at 8ms). The wait therefore holds until the
    // frames have been quiet AND no pass has come for a stretch of wall clock
    // AND every finite animation the page runs has finished — an entrance, a
    // swap or a fade still in flight moves what the readings below are about
    // (D00: the settle rule). An endless animation is no such thing: the
    // running session's pulse and the sweeps never land, and waiting for them
    // would wait for the page's own life.
    var quietFrames = 0
    var quietMs = 250
    var lastPass = performance.now()
    var started = performance.now()
    while (performance.now() - started < 8000) {
      var before = window.__passes
      await new Promise(function (done) { window.__nativeRaf(function () { done() }) })
      if (window.__passes === before) {
        quietFrames += 1
      } else {
        quietFrames = 0
        lastPass = performance.now()
      }
      var settled = document.getAnimations().every(function (animation) {
        if (animation.playState !== 'running' && animation.playState !== 'pending') return true
        var timing = animation.effect === null ? null : animation.effect.getComputedTiming()
        return timing !== null && timing.iterations === Infinity
      })
      if (quietFrames >= 8 && performance.now() - lastPass >= quietMs && settled) break
    }
    if (window.SMOKE_TIER !== 'quick') {
      var from = window.__passes
      var mark = performance.now()
      await sleep(1000)
      r.idlePasses = window.__passes - from
      // Where the frames of that second landed, for the check's own detail.
      r.idlePassTimes = window.__passTimes
        .filter(function (t) { return t >= mark })
        .map(function (t) { return Math.round(t - mark) })
    }
    // The host's statistics are hidden outright, in both of its shapes: the
    // figures stay in the document as the read's own click targets, and their
    // dialogs are read into the context popover instead (the 'default' case
    // below). The host marks each figure since its 2026-09 update and marked the
    // container around them before, so both marks are checked.
    var statsFigures = Array.prototype.slice.call(document.querySelectorAll('[data-composer-stat], [data-composer-stats]'))
    r.statsHidden = statsFigures.length > 0 && statsFigures.every(function (el) { return getComputedStyle(el).display === 'none' })
    r.statsStrayCards = document.querySelectorAll('.dsh-claude-stats-popover').length
    // The session list's leading seat. The host's newer rows render it through a
    // slot outlet, so an idle row's seat is not :empty — the circle has to hang
    // on the empty outlet anchor. A seat carrying the running status dot keeps
    // its own paint and gets no circle.
    var seats = document.querySelectorAll('[data-dsh-claude-part~="session-row"] [data-dsh-claude-part~="row-slot"]')
    function seatState(seat) {
      if (!seat) return null
      var outlet = seat.querySelector(':scope > [data-slot]')
      var target = outlet !== null ? outlet : seat
      var after = getComputedStyle(target, '::after')
      return { content: after.content, width: after.width, border: after.borderTopWidth, svgs: seat.querySelectorAll('svg').length }
    }
    r.seatIdle = seatState(seats[0])
    r.seatRunning = seatState(seats[1])
  })
})()
