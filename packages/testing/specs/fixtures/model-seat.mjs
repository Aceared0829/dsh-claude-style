/**
 * The model seat the stand-in pages carry (packages/testing/smoke/page.mjs) and
 * the behaviour specs read: one long name, so the composer row has to share its
 * width between the name and the controls beside it. Both sides take it from
 * here, so a rename moves the seat and the locator together.
 */
const MODEL_SEAT_NAME = 'DeepSeek V4 Reasoner Extended Context'

/**
 * Make the stand-in's model directory answer a reasoning selection the way the
 * host's own store does: `select` moves the level, and the snapshot the skin
 * reads back on its next pass names it. The stand-in answers one fixed snapshot,
 * so without this a commit moves the card's knob alone — the trigger keeps the
 * level the page started on.
 *
 * @param page - the behaviour spec's page.
 * @param start - the level the stand-in names before any selection.
 */
async function echoSelection(page, start) {
  await page.evaluate((level) => {
    const directory = window.__dshSmokeHost.modelDirectories.directoryFor('smoke-session')
    const snapshot = directory.store.getSnapshot.bind(directory.store)
    let answer = level
    directory.store.getSnapshot = () => {
      const snap = snapshot()
      return snap === null || snap.current === null ? snap : { ...snap, current: { ...snap.current, reasoningEffort: answer } }
    }
    directory.select = (selection) => {
      if (selection && selection.reasoningEffort !== undefined) answer = selection.reasoningEffort
      return Promise.resolve()
    }
  }, start)
}

export { MODEL_SEAT_NAME, echoSelection }
