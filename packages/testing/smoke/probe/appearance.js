/**
 * The appearance layer (D66): what one page state's parts compute to.
 *
 * A behaviour check asks whether a thing works; this asks what it looks like.
 * Every part in the vocabulary the stylesheets may read (packages/client/src/core/parts-table.ts)
 * is read in every page state, and each part's own list of properties is taken
 * from the computed style — the ones a sheet writes and a machine cannot change:
 * colours, borders, radii, shadows, placement and overflow. The resolved family
 * and size of the font are left out on purpose, because neither says anything
 * about the sheet here: this checkout serves no face of its own, so both answer
 * for the browser's default for the platform the walk runs on (D66).
 *
 * The values are recorded, not asserted here: they land in the report under
 * `appearance`, the run writes them beside its own output, and
 * packages/testing/appearance.cjs compares that against the committed
 * packages/testing/appearance.json. The parts that are not on a page's state
 * are absent from its entry, which is itself the reading: a part that stops
 * being drawn stops being recorded, and the comparison says so by name.
 */
(function () {
  var probe = window.__dshSmokeProbe
  var r = probe.report
  var names = window.SMOKE_APPEARANCE_PARTS || []
  var PROPS = [
    'background-color',
    'color',
    'border-top-color',
    'border-top-width',
    'border-top-style',
    'border-top-left-radius',
    'box-shadow',
    'opacity',
    'display',
    'visibility',
    'position',
    'z-index',
    'font-weight',
    'overflow-x',
    'overflow-y',
  ]
  var reading = {}
  for (var at = 0; at < names.length; at += 1) {
    var element = document.querySelector('[data-dsh-claude-part~="' + names[at] + '"]')
    if (element === null) continue
    var style = getComputedStyle(element)
    var values = {}
    for (var index = 0; index < PROPS.length; index += 1) values[PROPS[index]] = style.getPropertyValue(PROPS[index])
    reading[names[at]] = values
  }
  r.appearance = reading
  r.appearanceProbe = { parts: names.length, recorded: Object.keys(reading).length }
})()
