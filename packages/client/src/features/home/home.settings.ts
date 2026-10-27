import * as React from 'react'
import { HOME_LAYOUTS, HOME_LAYOUT_CLASSIC, HOME_LAYOUT_OFF, HOME_LAYOUT_STUDIO } from '../../constants'
import { PreviewCards } from '../../shared/preview-cards'
import { copy } from './copy'
import type { CopyKey } from './copy'
import type { PreviewOption } from '../../shared/preview-cards'
import type { Prefs } from '../../constants'
import type { SettingsControlsOf, SettingsRowView } from '../../core/feature'
import type manifest from './home-layout.manifest'

/**
 * The one row this feature draws itself (D76): the home layout as three cards,
 * each a small new-conversation page in the arrangement its choice gives, with
 * the choice's name under it (features/settings/settings-cards.css).
 */
export const controls: SettingsControlsOf<typeof manifest> = {
  'layout-preview': HomeLayoutPicker,
}

/** Each layout's name, by the value it stores. */
const NAMES: Record<Prefs['homeLayout'], CopyKey> = {
  [HOME_LAYOUT_OFF]: 'homeOff',
  [HOME_LAYOUT_CLASSIC]: 'homeClassic',
  [HOME_LAYOUT_STUDIO]: 'homeStudio',
}

/**
 * One layout's page in miniature. Every card holds the same pieces — the
 * headline, the usage tiles, the composer — and the stylesheet places them by
 * the card's `data-layout`: centred with the brand mark for the chat home, the
 * headline at the top left over the tiles for the code home, and centred in
 * the host's quiet ink, without the skin's mark, for the host's own page.
 */
function sample(layout: Prefs['homeLayout']) {
  const piece = (name: string) => React.createElement('span', { key: name, className: `dsh-claude-home-sample-${name}` })
  return [
    React.createElement(
      'span',
      { key: 'page', className: 'dsh-claude-home-sample', 'aria-hidden': 'true' },
      React.createElement('span', { className: 'dsh-claude-home-sample-headline' }, piece('mark'), piece('title')),
      layout === HOME_LAYOUT_STUDIO ? React.createElement('span', { className: 'dsh-claude-home-sample-tiles' }, piece('tile-1'), piece('tile-2'), piece('tile-3'), piece('tile-4')) : null,
      piece('composer'),
    ),
    React.createElement('span', { key: 'name', className: 'dsh-claude-home-card-name', 'aria-hidden': 'true' }, copy(NAMES[layout])),
  ]
}

function HomeLayoutPicker(props: SettingsRowView) {
  const options: PreviewOption<Prefs['homeLayout']>[] = HOME_LAYOUTS.map(layout => ({
    value: layout,
    label: copy(NAMES[layout]),
    content: sample(layout),
    attributes: { 'data-layout': layout },
  }))
  return React.createElement(PreviewCards<Prefs['homeLayout']>, {
    cardClass: 'dsh-claude-home-card',
    options,
    value: props.prefs.homeLayout,
    write: (value: Prefs['homeLayout']) => props.write({ homeLayout: value }),
    disabled: props.disabled,
    label: copy('homeTitle'),
  })
}
