import { ACCENT_ATTR, BRAND_INK_TEXT, CUSTOM_MARK_ATTR, CUSTOM_TINT_ATTR, CUSTOM_WORD_ATTR, CUSTOM_WORD_IMAGE, CUSTOM_WORD_TEXT } from '../../constants'
import { readPrefs, subscribePrefs } from '../../core/prefs'
import { loadBrandImages, readBrandImages, resetBrandImages, subscribeBrandImages } from '../../shared/custom-brand'

/**
 * The custom brand layer (D30): the reader's own name, images and accent
 * colour over whichever brand is chosen. Each part is written onto <body>
 * only while the reader has supplied it — an attribute the stylesheets switch
 * on (brand.css, and the account avatar's rule in account-footer.css) and the
 * value as a custom property — so a reader who supplied nothing gets the
 * brand's own art and colours untouched.
 */

/** The custom properties written on <body>, read by the rules gated on the attributes. */
const MARK_PROPERTY = '--dsh-claude-custom-mark'
const WORD_PROPERTY = '--dsh-claude-custom-word'
const WORD_RATIO_PROPERTY = '--dsh-claude-custom-word-ratio'
const NAME_PROPERTY = '--dsh-claude-custom-name'
const ACCENT_PROPERTY = '--dsh-claude-custom-accent'
const ACCENT_INK_PROPERTY = '--dsh-claude-custom-accent-ink'
const PROPERTIES = [MARK_PROPERTY, WORD_PROPERTY, WORD_RATIO_PROPERTY, NAME_PROPERTY, ACCENT_PROPERTY, ACCENT_INK_PROPERTY]
const ATTRIBUTES = [CUSTOM_MARK_ATTR, CUSTOM_WORD_ATTR, CUSTOM_TINT_ATTR, ACCENT_ATTR]

/** The two inks text on an accent fill can take: the dark and the light canvas (docs/STYLE.md). */
const INK_DARK = '#141413'
const INK_LIGHT = '#faf9f5'

/** A CSS string literal holding the text, for `content: var(...)`; a line break reads as a space. */
export function cssString(text: string) {
  return `"${text.replace(/[\\"]/g, '\\$&').replace(/[\n\r\f]/g, ' ')}"`
}

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(at => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The ink that reads best on a `#rrggbb` accent fill: whichever canvas colour has the higher contrast with it. */
export function accentInk(accent: string) {
  const fill = luminance(accent)
  const contrast = (ink: string) => {
    const other = luminance(ink)
    return (Math.max(fill, other) + 0.05) / (Math.min(fill, other) + 0.05)
  }
  return contrast(INK_DARK) > contrast(INK_LIGHT) ? INK_DARK : INK_LIGHT
}

export function install() {
  const body = document.body

  const attribute = (name: string, value: string | null) => {
    if (value === null) body.removeAttribute(name)
    else if (body.getAttribute(name) !== value) body.setAttribute(name, value)
  }
  const property = (name: string, value: string | null) => {
    if (value === null) body.style.removeProperty(name)
    else if (body.style.getPropertyValue(name) !== value) body.style.setProperty(name, value)
  }

  function apply() {
    const prefs = readPrefs()
    const { mark, wordmark } = readBrandImages()
    attribute(CUSTOM_MARK_ATTR, mark === null ? null : '')
    property(MARK_PROPERTY, mark === null ? null : `url("${mark.url}")`)
    attribute(CUSTOM_WORD_ATTR, wordmark !== null ? CUSTOM_WORD_IMAGE : prefs.brandName !== '' ? CUSTOM_WORD_TEXT : null)
    property(WORD_PROPERTY, wordmark === null ? null : `url("${wordmark.url}")`)
    property(WORD_RATIO_PROPERTY, wordmark === null ? null : String(wordmark.ratio))
    property(NAME_PROPERTY, wordmark === null && prefs.brandName !== '' ? cssString(prefs.brandName) : null)
    attribute(CUSTOM_TINT_ATTR, prefs.brandInk === BRAND_INK_TEXT && (mark !== null || wordmark !== null) ? '' : null)
    attribute(ACCENT_ATTR, prefs.brandAccent === '' ? null : '')
    property(ACCENT_PROPERTY, prefs.brandAccent === '' ? null : prefs.brandAccent)
    property(ACCENT_INK_PROPERTY, prefs.brandAccent === '' ? null : accentInk(prefs.brandAccent))
  }

  const offPrefs = subscribePrefs(apply)
  const offImages = subscribeBrandImages(apply)
  loadBrandImages()
  apply()

  return () => {
    offPrefs()
    offImages()
    resetBrandImages()
    for (const name of ATTRIBUTES) body.removeAttribute(name)
    for (const name of PROPERTIES) body.style.removeProperty(name)
  }
}
