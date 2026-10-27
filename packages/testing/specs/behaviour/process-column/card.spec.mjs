/**
 * Under the column layout an open process group's rows stand in one bordered
 * card: one row a line, a separator between them, no icon leading a row and a
 * chevron trailing every row that opens. A thought reads as the thought itself;
 * a named call keeps its verb, and a row with nothing after its title keeps the
 * title. The flat layout is the host's own list, untouched.
 *
 * @capability process-column
 * @features process-column
 * @risk The column layout leaves a group as the host's flat list, hides the only words a row has, stacks rows over each other, or leaves its card behind once the reader goes back to the flat layout.
 */
import { CONVERSATION_PARTS, PAGE_PARTS } from '@dsh-claude-style/engine/parts-table'
import { spec, host } from '../../fixtures/behaviour.mjs'

/** The class the part walk reads for one part name, with the fixture's own hash. */
function partClass(table, part) {
  const stem = Object.keys(table).find((candidate) => table[candidate] === part)
  if (stem === undefined) throw new Error(`no class stem marks the part "${part}"`)
  return `_${stem}_x_1`
}

/**
 * One process group in the conversation's scroller: a thought with its
 * description, a named call, and a thought whose title stands alone. Each row
 * is the host's DisclosureRow: the icon's seat, the title, the separator and
 * the description, the last two only where there is a description.
 */
async function mountGroup(t) {
  await t.page.evaluate((m) => {
    const element = (pairs, className, tag = 'div') => {
      const node = document.createElement(tag)
      for (const [name, value] of pairs) node.setAttribute(name, value)
      if (className !== undefined) node.className = className
      return node
    }
    const row = (kind, part, variant, title, description) => {
      const item = element([[m.kind, kind], ...(part === null ? [] : [[m.part, part]])])
      const root = element(variant)
      const header = element(m.header)
      const disclosure = element([...m.disclosure, ...m.expandable, ['aria-expanded', 'false']], m.rowClass)
      const leading = element([], m.leadingClass, 'span')
      leading.textContent = '•'
      const words = document.createElement('span')
      const titleWords = element([], m.titleClass, 'span')
      titleWords.textContent = title
      words.append(titleWords)
      if (description !== null) {
        words.append(element(m.decoration, undefined, 'span'))
        const text = document.createElement('span')
        text.textContent = description
        words.append(text)
      }
      disclosure.append(leading, words)
      header.append(disclosure)
      root.append(header)
      item.append(root)
      return item
    }
    const group = element(m.group)
    group.id = 'process-group'
    const body = element(m.body)
    const content = element(m.content)
    content.append(
      row(m.stepKind, m.reasoning, [...m.think, [m.preview, 'true']], '思考', '先看清工作区里有哪些文件'),
      row(m.toolKind, null, [], '查找文件', '*.md'),
      row(m.stepKind, m.reasoning, m.think, '思考', null),
    )
    body.append(content)
    group.append(body)
    document.querySelector(m.scroller).append(group)
  }, {
    scroller: host('chat.scroller'),
    group: host.attributes('process.group'),
    body: host.attributes('process.body'),
    content: host.attributes('process.content'),
    kind: host('chat.user-row'),
    part: host('chat.group-part'),
    stepKind: host('chat.assistant-step-kind'),
    toolKind: host('chat.tool-call-kind'),
    reasoning: host('chat.group-part-reasoning'),
    think: host.attributes('chat.think-row'),
    preview: host('chat.think-preview'),
    header: host.attributes('fold.disclosure-header'),
    disclosure: host.attributes('fold.disclosure'),
    expandable: host.attributes('fold.expandable'),
    decoration: host.attributes('fold.shimmer-decoration'),
    rowClass: partClass(CONVERSATION_PARTS, 'row'),
    leadingClass: partClass(CONVERSATION_PARTS, 'row-leading'),
    titleClass: partClass(PAGE_PARTS, 'text-title'),
  })
  await t.settle()
}

/** What the reader sees of the group: its edge, each row's height and words, and what leads and trails each row. */
async function readGroup(t) {
  return t.page.evaluate(([bodySelector, contentSelector, disclosureSelector]) => {
    const body = document.querySelector(bodySelector)
    const rows = [...document.querySelector(contentSelector).children]
    return {
      border: getComputedStyle(body).borderTopWidth,
      rows: rows.map((item) => {
        const disclosure = item.querySelector(disclosureSelector)
        const leading = disclosure.firstElementChild
        return {
          height: Math.round(item.getBoundingClientRect().height),
          lineHeight: Math.round(disclosure.getBoundingClientRect().height),
          bottomPadding: getComputedStyle(item).paddingBottom,
          separator: getComputedStyle(item).borderTopWidth !== '0px',
          // The separator is a box of its own, so the words are read without the breaks around it.
          words: disclosure.lastElementChild.innerText.replace(/\s+/g, ''),
          leads: leading.checkVisibility(),
          trails: getComputedStyle(disclosure, '::after').content !== 'none',
        }
      }),
    }
  }, [host('process.body'), host('process.content'), host('fold.disclosure')])
}

export default spec({ page: 'composer' }, ({ test }) => {
  test('the column layout draws the group as one card of single-line rows, and the flat layout gives the host its list back', async (t) => {
    await mountGroup(t)
    const flat = await readGroup(t)
    t.expectThat.equal(flat.border, '0px', 'the flat layout draws no card')
    t.expectThat.equal(flat.rows.map((row) => [row.leads, row.trails, row.separator]), [[true, false, false], [true, false, false], [true, false, false]], 'the flat layout keeps every icon and adds no chevron or separator')

    await t.prefs({ processRows: 'column' })
    const column = await readGroup(t)
    t.expectThat.equal(column.border, '1px', 'the column layout draws the body as a card')
    t.expectThat.equal(column.rows.map((row) => row.words), ['先看清工作区里有哪些文件', '查找文件*.md', '思考'], 'a thought reads as itself, a call keeps its verb, and a lone title stays')
    t.expectThat.equal(column.rows.map((row) => [row.leads, row.trails]), [[false, true], [false, true], [false, true]], 'no icon leads a row and a chevron trails each')
    t.expectThat.equal(column.rows.map((row) => row.separator), [false, true, true], 'a separator stands between rows and none above the first')
    t.expectThat.equal(column.rows.map((row) => row.bottomPadding), ['0px', '0px', '6px'], 'a trailing thought leaves room above the card’s bottom edge')
    const [first, ...rest] = column.rows.map((row) => row.lineHeight)
    t.expectThat.equal(rest.map((height) => Math.abs(height - first) <= 1), [true, true], 'every row stands at one height, a thought and a call alike')

    const expandedMode = host('process.expanded-mode')
    for (const mode of ['compact', 'standard', 'detailed', 'fully-expanded']) {
      await t.page.evaluate(([attribute, value]) => {
        document.querySelector('#process-group').setAttribute(attribute, value)
      }, [expandedMode, mode])
      t.expectThat.equal((await readGroup(t)).border, '1px', `the ${mode} tier keeps the card around its body`)
    }

    await t.prefs({ processRows: 'flat' })
    t.expectThat.equal(await readGroup(t), flat, 'going back to the flat layout leaves the group as the host drew it')
  })

  test('the column layout leaves the group uncapped and keeps only an opened thought capped', async (t) => {
    await mountGroup(t)
    await t.prefs({ processRows: 'column' })
    const reading = await t.page.evaluate(([bodySelector, contentSelector, thinkSelector, headerSelector, expanded]) => {
      const thought = [...document.querySelector(contentSelector).querySelectorAll(thinkSelector)].at(-1)
      thought.setAttribute(expanded, '')
      const detail = document.createElement('div')
      detail.style.height = '800px'
      thought.querySelector(headerSelector).after(detail)
      const groupStyle = getComputedStyle(document.querySelector(bodySelector))
      const detailStyle = getComputedStyle(detail)
      return {
        groupMax: groupStyle.maxHeight,
        groupOverflow: groupStyle.overflowY,
        detailOverflow: detailStyle.overflowY,
        bottomPadding: getComputedStyle(document.querySelector(contentSelector).lastElementChild).paddingBottom,
        detailHeight: Math.round(detail.getBoundingClientRect().height),
        cap: Math.round(Math.min(400, window.innerHeight / 2)),
      }
    }, [host('process.body'), host('process.content'), host('chat.think-row'), host('fold.disclosure-header'), host('fold.expanded')])
    t.expectThat.equal(reading.groupMax, 'none', 'the group has no maximum height')
    t.expectThat.equal(reading.groupOverflow, 'visible', 'the group does not scroll')
    t.expectThat.equal(reading.detailOverflow, 'auto', 'the opened thought keeps its own scrollbar')
    t.expectThat.equal(reading.bottomPadding, '6px', 'the trailing opened thought keeps room below its details')
    t.expectThat.equal(reading.detailHeight, reading.cap, 'the opened thought reaches its cap and no further')
  })
})
