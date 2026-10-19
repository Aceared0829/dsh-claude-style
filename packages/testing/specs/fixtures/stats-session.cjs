'use strict'
/**
 * The stand-in's statistics session, seated the way the host seats it (D77):
 * the composer card and its dock move into the active phase's session column,
 * whose id is the one the stand-in's projections answer for, and the two
 * projections land their first readings.
 */
async function seatStatsSession(t, stats, usage) {
  await t.page.evaluate(([card, phase, session, statsValue, usageValue]) => {
    const element = document.querySelector(card)
    const dock = element.nextElementSibling
    const wrapper = document.createElement('div')
    wrapper.setAttribute(phase, 'active')
    const column = document.createElement('div')
    column.setAttribute(session, 'smoke-stats')
    element.parentElement.insertBefore(wrapper, element)
    wrapper.append(column)
    column.append(element, dock)
    window.__pushStats('sessionStats', statsValue)
    window.__pushStats('tokenUsage', usageValue)
  }, [t.host('composer.card'), t.host('shell.phase'), t.host('conversation.session-attribute'), stats, usage])
  await t.settle()
}

module.exports = { seatStatsSession }
