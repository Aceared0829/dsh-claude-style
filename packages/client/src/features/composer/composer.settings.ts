import * as React from 'react'
import { featureCopy } from '../../core/i18n'
import { COMPOSER_DIMENSIONS, composerDimensionPixels } from './dimensions'
import COPY from './composer.copy.json'
import type { SettingsControlsOf, SettingsRowView } from '../../core/feature'
import type manifest from './composer.manifest'

export const controls: SettingsControlsOf<typeof manifest> = {
  width: props => React.createElement(DimensionControl, { ...props, pref: 'composerWidth', title: 'composerWidthTitle' }),
  'bottom-gap': props => React.createElement(DimensionControl, { ...props, pref: 'composerBottomGap', title: 'composerBottomGapTitle' }),
}

function DimensionControl(props: SettingsRowView & { pref: keyof typeof COMPOSER_DIMENSIONS, title: keyof typeof COPY }) {
  const value = props.prefs[props.pref]
  const pixels = composerDimensionPixels(props.prefs, props.pref)
  const limits = COMPOSER_DIMENSIONS[props.pref]
  const label = featureCopy(COPY, props.title)
  return React.createElement('div', { className: 'dsh-claude-composer-dimension' },
    React.createElement('input', {
      type: 'range',
      min: limits.min,
      max: limits.max,
      step: limits.step,
      value: pixels ?? limits.fallback,
      disabled: props.disabled,
      'aria-label': label,
      'aria-valuetext': pixels === null ? featureCopy(COPY, 'dimensionsDefault') : pixels + ' px',
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => props.write({ [props.pref]: event.target.value }),
    }),
    React.createElement('output', null, pixels === null ? featureCopy(COPY, 'dimensionsDefault') : pixels + ' px'),
    React.createElement('button', {
      type: 'button',
      disabled: props.disabled || value === '',
      'aria-label': label + ': ' + featureCopy(COPY, 'dimensionsReset'),
      onClick: () => props.write({ [props.pref]: '' }),
    }, featureCopy(COPY, 'dimensionsReset')),
  )
}
