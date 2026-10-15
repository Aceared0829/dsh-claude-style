/**
 * The host-palette case: the host's own colours and type, the tokens and frames
 * the skin must leave alone, and what a wallpaper plugin's cleared canvas
 * reaches. Then the settings case: the section rendered through the stand-in
 * React, tab by tab, with the sub-rows that grey out behind a parent, and the
 * heading's link to the plugin's repository.
 */
(function () {
  var probe = window.__dshSmokeProbe
  var sleep = probe.sleep
  var r = probe.report

  probe.step(async function () {
    // Following the host's colours and type: with the host's palette in the
    // page, the skin writes none of the host's tokens, paints none of the
    // host's frame, and its own surfaces read the host's tokens; a wallpaper
    // plugin's cleared canvas and glass then reach both. Back on Claude the
    // skin's own palette returns.
    await probe.onlyFor(['host-palette'], async function () {
      var hostProbe = function (html) {
        var holder = document.createElement('div')
        holder.innerHTML = html
        document.body.appendChild(holder.firstChild)
        return document.body.lastChild
      }
      var hostNodes = {
        sidebar: hostProbe('<div data-pane="sidebar">s</div>'),
        conversation: hostProbe('<div data-pane="conversation">c</div>'),
        popover: hostProbe('<div class="dsh-claude-popover-card" data-open="true">p</div>'),
        search: hostProbe('<div class="dsh-claude-search-dialog">q</div>'),
        group: hostProbe('<span class="dsh-claude-model-group">g</span>'),
        heading: hostProbe('<h1>h</h1>'),
        code: hostProbe('<pre><code>c</code></pre>'),
      }
      var readHost = async function (patch, wallpaper) {
        if (patch !== null) window.__pushForm(patch)
        if (wallpaper) document.body.setAttribute('data-we-wallpaper', '')
        else document.body.removeAttribute('data-we-wallpaper')
        await sleep(120)
        var bodyStyle = getComputedStyle(document.body)
        return {
          base: bodyStyle.getPropertyValue('--dsw-alias-bg-base').trim(),
          family: bodyStyle.getPropertyValue('--dsw-font-family').trim(),
          body: bodyStyle.backgroundColor,
          // The mask the Claude palette lays over a wallpaper (D61).
          mask: getComputedStyle(document.body, '::after').backgroundColor,
          maskPosition: getComputedStyle(document.body, '::after').position,
          html: getComputedStyle(document.documentElement).backgroundColor,
          sidebar: getComputedStyle(hostNodes.sidebar).backgroundColor,
          // The sidebar element carries this token itself: the Claude canvas
          // while the palette paints it, cleared while a wallpaper is up.
          sidebarFill: getComputedStyle(hostNodes.sidebar).getPropertyValue('--dsw-specific-sidebar-fill').trim(),
          conversation: getComputedStyle(hostNodes.conversation).backgroundColor,
          popover: getComputedStyle(hostNodes.popover).backgroundColor,
          popoverBlur: getComputedStyle(hostNodes.popover).backdropFilter,
          // The account drawer the footer feature built (it sweeps any other copy).
          account: getComputedStyle(document.querySelector('.dsh-claude-account-popover')).backgroundColor,
          search: getComputedStyle(hostNodes.search).backgroundColor,
          group: getComputedStyle(hostNodes.group).backgroundColor,
          groupInk: getComputedStyle(hostNodes.group).color,
          heading: getComputedStyle(hostNodes.heading).fontFamily,
          code: getComputedStyle(hostNodes.code.firstChild).fontFamily,
        }
      }
      await sleep(300)
      r.hostPalette = {
        host: await readHost({ palette: 'host', typeface: 'host' }, false),
        wallpaper: await readHost(null, true),
        claude: await readHost({ palette: 'claude', typeface: 'claude' }, false),
        // The wallpaper plugin showing one under the Claude palette (D61): the
        // shell stands down, one mask lies over the wallpaper, and the base
        // canvas and the skin's own faces keep their fill.
        claudeWallpaper: await readHost(null, true),
      }
      document.body.removeAttribute('data-we-wallpaper')
      await sleep(120)
      for (var hostKey in hostNodes) hostNodes[hostKey].remove()
    })
    // The settings page, rendered through the stand-in React into a plain tree:
    // the tab strip, which rows each tab carries, and the sub-rows that grey
    // out while their parent is off. A tab is opened by standing the tab state
    // in for a click (the stand-in's `states`).
    await probe.onlyFor(['settings'], async function () {
      var Section = (window.__slotComponents || {})['claude-style']
      var walk = function (node, visit) {
        if (node === null || node === undefined || typeof node !== 'object') return
        if (Array.isArray(node)) { node.forEach(function (child) { walk(child, visit) }); return }
        visit(node)
        walk(node.props && node.props.children, visit)
      }
      var renderTab = function (tabId) {
        var react = window.__react
        react.rendering = true
        react.states = tabId === 'general' ? null : { general: tabId }
        var tree = Section({})
        react.rendering = false
        react.states = null
        var out = { tabs: [], selected: null, rows: [], disabled: [], notes: [], notice: null, link: null }
        walk(tree, function (node) {
          var props = node.props || {}
          if (props.role === 'tab') {
            out.tabs.push(props.key)
            if (props['aria-selected'] === 'true') out.selected = props.key
          }
          if (typeof props.className === 'string' && /(^| )dsh-claude-settings-row( |$)/.test(props.className)) {
            var rowKey = props.key
            out.rows.push(rowKey)
            if (props['data-disabled'] === '') out.disabled.push(rowKey)
            walk(props.children, function (child) {
              if (((child.props || {}).className || '') === 'dsh-claude-settings-row-note' && out.notes.indexOf(rowKey) < 0) out.notes.push(rowKey)
            })
          }
          if (typeof props.className === 'string' && /(^| )dsh-claude-settings-tab-notice( |$)/.test(props.className)) {
            out.notice = [].concat(props.children).filter(function (child) { return typeof child === 'string' }).join('')
          }
          if (props.className === 'dsh-claude-settings-repo') {
            out.link = { href: props.href, target: props.target, rel: props.rel, label: props['aria-label'] }
          }
        })
        return out
      }
      r.settings = { registered: typeof Section === 'function', pages: {} }
      if (r.settings.registered) {
        var tabIds = ['general', 'appearance', 'composer', 'sidebar', 'conversation', 'motion']
        for (var ti = 0; ti < tabIds.length; ti++) r.settings.pages[tabIds[ti]] = renderTab(tabIds[ti])
        r.settings.link = r.settings.pages.general.link
        // The heading's mark: the build inlines the asset into the token sheet
        // and the rule paints it as a mask over the link's own box, so the
        // address and the size are read off the rendered pseudo-element.
        var linkNode = document.createElement('a')
        linkNode.className = 'dsh-claude-settings-repo'
        document.body.appendChild(linkNode)
        var markStyle = getComputedStyle(linkNode, '::before')
        r.settings.mark = {
          mask: (markStyle.maskImage === 'none' ? markStyle.webkitMaskImage : markStyle.maskImage).slice(0, 48),
          size: markStyle.width + '×' + markStyle.height,
          ink: markStyle.backgroundColor,
        }
        linkNode.remove()
        // The waiting line's paint cards: the stand-in renders the page as a
        // plain tree, so the two previews are stood up here with the classes and
        // the wordings the cards carry, and read through their own boxes — the
        // layer count is how many radial washes a paint really holds, and the
        // two wordings' animation names, delays and places are the taking-turns.
        r.settings.paintCards = (function () {
          var out = { cards: [], previews: {} }
          var react = window.__react
          react.rendering = true
          react.states = { general: 'motion' }
          var tree = Section({})
          react.rendering = false
          react.states = null
          walk(tree, function (node) {
            var props = node.props || {}
            if (typeof props.className === 'string' && /(^| )dsh-claude-motion-card( |$)/.test(props.className)) {
              var kids = [].concat(props.children || [])
              var sample = kids[0] || {}
              var sampleProps = sample.props || {}
              // The two wordings, read through the tree: the sample's children
              // arrive nested (the module passes the mapped array as one child,
              // as React flattens it), so the walk is what finds the words.
              var words = []
              walk(sampleProps.children, function (word) {
                var wordProps = word.props || {}
                if (/(^| )dsh-claude-motion-word( |$)/.test(wordProps.className || '')) words.push([].concat(wordProps.children || []).join(''))
              })
              out.cards.push({
                label: props['aria-label'],
                active: props['data-active'] === '',
                pressed: props['aria-pressed'],
                // The card's only content is its sample: the choice carries no
                // text of its own, and the sample is the words taking turns.
                sample: kids.length === 1 && /(^| )dsh-claude-motion-sample( |$)/.test(sampleProps.className || ''),
                words: words,
                sampleHidden: sampleProps['aria-hidden'] === 'true',
              })
            }
          })
          var kinds = ['sweep', 'wash']
          var wordings = (out.cards[0] || {}).words || []
          for (var ki = 0; ki < kinds.length; ki += 1) {
            // Inside a card, where the sample is a flex item: its box then takes
            // the room the card gives it, as it does on the page.
            var card = document.createElement('button')
            card.className = 'dsh-claude-motion-card'
            var box = document.createElement('span')
            box.className = 'dsh-claude-motion-sample'
            for (var wi = 0; wi < wordings.length; wi += 1) {
              var word = document.createElement('span')
              word.className = 'dsh-claude-motion-word dsh-claude-' + kinds[ki]
              word.setAttribute('data-text', wordings[wi])
              word.textContent = wordings[wi]
              box.appendChild(word)
            }
            card.appendChild(box)
            document.body.appendChild(card)
            var nodes = [].slice.call(box.children)
            var style = nodes.length === 0 ? null : getComputedStyle(nodes[0])
            var paint = nodes.length === 0 ? null : getComputedStyle(nodes[0], '::before')
            var round = function (value) { return Math.round(value) }
            var centreOf = function (node) {
              var rect = node.getBoundingClientRect()
              return round((rect.left + rect.right) / 2)
            }
            out.previews[kinds[ki]] = {
              words: nodes.map(function (node) { return node.textContent }),
              wordAnimations: nodes.map(function (node) { return getComputedStyle(node).animationName }),
              wordDelays: nodes.map(function (node) { return getComputedStyle(node).animationDelay }),
              wordCentres: nodes.map(centreOf),
              wordWidths: nodes.map(function (node) { return round(node.getBoundingClientRect().width) }),
              width: round(box.getBoundingClientRect().width),
              animation: paint === null ? null : paint.animationName,
              washes: paint === null ? 0 : (paint.backgroundImage.match(/url\("data:image\/svg/g) || []).length,
              ink: style === null ? null : style.color,
            }
            card.remove()
          }
          return out
        })()
        // The caret row's preview cards: two cards, the stored choice active,
        // each holding one sample line with one bar; the on bar glides and
        // blinks, the off bar blinks alone. The stand-in renders the page as a
        // plain tree, so the cards are read off a fresh render of the tab.
        var react2 = window.__react
        react2.rendering = true
        react2.states = { general: 'motion' }
        var motionTree = Section({})
        react2.rendering = false
        react2.states = null
        var caretCards = []
        walk(motionTree, function (el) {
          var props = el.props || {}
          if (typeof props.className === 'string' && /(^| )dsh-claude-caret-card( |$)/.test(props.className)) {
            var barClass = null
            walk(props.children, function (part) {
              var partProps = part.props || {}
              if (typeof partProps.className === 'string' && /(^| )dsh-claude-caret-sample-bar( |$)/.test(partProps.className)) barClass = partProps.className
            })
            caretCards.push({ label: props['aria-label'], active: props['data-active'] === '', pressed: props['aria-pressed'], bar: barClass })
          }
        })
        r.settings.caretCards = caretCards
        var barHost = document.createElement('div')
        barHost.style.cssText = 'position:absolute;left:-10000px;top:-10000px'
        var bars = []
        for (var kb = 0; kb < 2; kb++) {
          var caretBar = document.createElement('span')
          caretBar.className = 'dsh-claude-caret-sample-bar dsh-claude-caret-' + (kb === 0 ? 'typing' : 'off')
          barHost.appendChild(caretBar)
          bars.push(caretBar)
        }
        document.body.appendChild(barHost)
        r.settings.caretPreview = bars.map(function (b) { return getComputedStyle(b).animationName })
        barHost.remove()
        // The new-text fade row's cards: the fade card hands each character its
        // turn and lets it land faint, settling over the reveal's own duration,
        // while the other card's characters stand solid the moment they arrive
        // and a character still waiting for its turn is unseen. The stand-in
        // renders the page as a plain tree and the cards' clock lives in a
        // component, so the pieces are stood up here with the classes and the
        // attributes the cards carry and read through their own boxes.
        var revealHost = document.createElement('div')
        revealHost.style.cssText = 'position:absolute;left:-10000px;top:-10000px'
        var revealCard = function (fade) {
          var card = document.createElement('button')
          card.className = 'dsh-claude-reveal-card'
          if (fade) card.setAttribute('data-fade', '')
          var piece = function (inTurn) {
            var span = document.createElement('span')
            span.className = 'dsh-claude-reveal-piece'
            if (inTurn) span.setAttribute('data-in', '')
            span.textContent = 'x'
            card.appendChild(span)
            return span
          }
          revealHost.appendChild(card)
          return piece
        }
        var fadePiece = revealCard(true)(true)
        var waitingPiece = revealCard(true)(false)
        var plainPiece = revealCard(false)(true)
        document.body.appendChild(revealHost)
        var readPiece = function (piece) {
          var style = getComputedStyle(piece)
          return { opacity: style.opacity, animation: style.animationName, duration: style.animationDuration, fill: style.animationFillMode }
        }
        r.settings.revealPreview = { fade: readPiece(fadePiece), waiting: readPiece(waitingPiece), plain: readPiece(plainPiece) }
        revealHost.remove()
        window.__pushForm({ modelPicker: false, mascot: 'off', sidebarSearch: false, palette: 'host' })
        r.settings.parentsOff = { appearance: renderTab('appearance'), composer: renderTab('composer'), sidebar: renderTab('sidebar') }
        window.__pushForm({ modelPicker: true, mascot: 'brand', sidebarSearch: true, palette: 'claude' })
        // The rows that wait for another setting: the composer restyle off greys
        // the picker, its sub-rows, the permission control and the statistics'
        // position; the footer takeover off greys the easter egg under it. Home
        // only still leaves the statistics without a conversation to stand in.
        window.__pushForm({ composerScope: 'off', collapseFooter: false })
        r.settings.requirementsOff = { composer: renderTab('composer'), conversation: renderTab('conversation'), sidebar: renderTab('sidebar') }
        window.__pushForm({ composerScope: 'hero', collapseFooter: true })
        r.settings.heroOnly = { composer: renderTab('composer'), conversation: renderTab('conversation') }
        window.__pushForm({ composerScope: 'all' })
        // On the Windows window the title-bar row takes input; everywhere else
        // it stays greyed with its note.
        document.documentElement.setAttribute('data-windows-titlebar', '')
        r.settings.onWindows = renderTab('conversation')
        document.documentElement.removeAttribute('data-windows-titlebar')
      }
    })
  })
})()
