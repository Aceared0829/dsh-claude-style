/**
 * The custom-brand case (D64): the host half's status names a mark and a 4:1
 * wordmark, and the page paints them over the brand's own art — the sidebar's
 * mark and wordmark, the hero's mark and the account row's fallback picture —
 * then inks them in the text colour and takes a custom accent once the
 * preferences ask for it, and hands the accent back when it is cleared.
 */
(function () {
  var probe = window.__dshSmokeProbe
  var sleep = probe.sleep
  var r = probe.report

  probe.step(async function () {
    await probe.onlyFor(['custom-brand'], async function () {
      // The host's sidebar brand and hero hitbox, in the shape ui-sidebar and
      // the hero render them (hashed class names, the art one level down). Each
      // sits in the host anchor the skin reads its parts inside (D3).
      var sidebar = document.createElement('div')
      sidebar.setAttribute('data-slot', 'sidebar')
      sidebar.innerHTML =
        '<span class="_brandIdentity_x_1"><span class="_brandMark_x_1"><svg viewBox="0 0 8 8"></svg></span>' +
          '<span class="_brandName_x_1"><span>DeepSeek</span></span></span>'
      var heroHolder = document.createElement('div')
      heroHolder.setAttribute('data-conversation-scroll', '')
      heroHolder.innerHTML =
        '<div class="_fishHitbox_h_1" style="display:flex"><svg viewBox="0 0 8 8"></svg></div>'
      document.body.appendChild(sidebar)
      document.body.appendChild(heroHolder)
      // The parts land on the pass after the subtree arrives (D3).
      var mark = null
      for (var look = 0; look < 40 && mark === null; look++) {
        await sleep(50)
        mark = sidebar.querySelector('[data-dsh-claude-part~="brand-mark"]')
      }
      var name = sidebar.querySelector('[data-dsh-claude-part~="brand-name"]')
      var hero = heroHolder.querySelector('[data-dsh-claude-part~="hero-mark"]')
      for (var wait = 0; wait < 40 && !document.body.hasAttribute('data-dsh-claude-custom-mark'); wait++) await sleep(50)
      var read = function () {
        var body = getComputedStyle(document.body)
        var markArt = getComputedStyle(mark, '::before')
        var wordArt = getComputedStyle(name, '::before')
        var heroArt = getComputedStyle(hero, '::before')
        var avatar = document.querySelector('.dsh-claude-account-avatar')
        return {
          markAttr: document.body.getAttribute('data-dsh-claude-custom-mark'),
          wordAttr: document.body.getAttribute('data-dsh-claude-custom-word'),
          tintAttr: document.body.getAttribute('data-dsh-claude-custom-tint'),
          hostArt: getComputedStyle(mark.firstChild).display,
          hostWord: getComputedStyle(name.firstChild).display,
          mark: { image: markArt.backgroundImage, mask: markArt.maskImage, width: markArt.width, fill: markArt.backgroundColor },
          word: { image: wordArt.backgroundImage, width: wordArt.width, height: wordArt.height },
          hero: { image: heroArt.backgroundImage, width: heroArt.width },
          avatar: avatar === null ? null : getComputedStyle(avatar).backgroundImage,
          accent: body.getPropertyValue('--dsw-alias-brand-primary').trim(),
          accentInk: body.getPropertyValue('--dsw-alias-label-primary-foreground').trim(),
        }
      }
      r.customBrand = { images: read() }
      window.__pushForm({ brandInk: 'text', brandAccent: '#1a7f5a', brandName: 'Acme' })
      await sleep(150)
      r.customBrand.tinted = read()
      window.__pushForm({ brandInk: 'original', brandAccent: '' })
      await sleep(150)
      r.customBrand.cleared = read()
      sidebar.remove()
      heroHolder.remove()
    })
  })
})()
