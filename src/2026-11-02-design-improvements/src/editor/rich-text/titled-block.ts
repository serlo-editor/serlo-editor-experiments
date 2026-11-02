import {
  defineCommands,
  defineKeymap,
  defineNodeSpec,
  defineNodeView,
  type Extension,
  union,
} from "prosekit/core"
import type { Node as ProseMirrorNode } from "prosekit/pm/model"
import { type Command, TextSelection } from "prosekit/pm/state"
import type { EditorView } from "prosekit/pm/view"

import { createIcon, isIconName } from "./icons.ts"

/** Box types with their label; the type adds a badge to the title row. */
export const boxTypes = [
  { value: "blank", label: "Blanko" },
  { value: "example", label: "Beispiel" },
  { value: "quote", label: "Zitat" },
  { value: "approach", label: "Vorgehen" },
  { value: "attention", label: "Vorsicht" },
  { value: "remember", label: "Merke" },
  { value: "note", label: "Beachte" },
  { value: "definition", label: "Definition" },
  { value: "theorem", label: "Satz" },
  { value: "proof", label: "Beweis" },
] as const

export type BoxType = (typeof boxTypes)[number]["value"]

/** A collapsible block with a title, learners open it to see its content. */
export function defineSpoiler(): Extension {
  return union(
    defineTitledBlockSpecs({
      wrapper: "spoiler",
      title: "spoilerTitle",
      content: "spoilerContent",
    }),
    defineCommands({
      toggleSpoiler: () =>
        toggleTitledBlock({ wrapper: "spoiler", title: "spoilerTitle", content: "spoilerContent" }),
    }),
    defineTitleKeymap("spoilerTitle"),
    defineSpoilerToggle(),
  )
}

/** A titled card that is always open, with a type that adds a badge to its title. */
export function defineBox(): Extension {
  return union(
    defineTitledBlockSpecs({
      wrapper: "box",
      title: "boxTitle",
      content: "boxContent",
      attrs: { type: { default: "blank" } },
      wrapperDOM: (node) => ["div", { class: "box", "data-box": String(node.attrs.type) }, 0],
      parseWrapper: (element) => ({ type: element.getAttribute("data-box") ?? "blank" }),
    }),
    defineCommands({
      toggleBox: () =>
        toggleTitledBlock({ wrapper: "box", title: "boxTitle", content: "boxContent" }),
    }),
    defineTitleKeymap("boxTitle"),
    defineBoxTypePicker(),
  )
}

export function boxTypeLabel(type: string) {
  return boxTypes.find(({ value }) => value === type)?.label ?? ""
}

/** The type's icon, `null` for the blank box. */
export function createBoxIcon(type: string) {
  return isIconName(type) ? createIcon(type) : null
}

interface TitledBlockNames {
  wrapper: string
  title: string
  content: string
}

function defineTitledBlockSpecs({
  wrapper,
  title,
  content,
  attrs,
  wrapperDOM = () => ["div", { class: wrapper }, 0],
  parseWrapper,
}: TitledBlockNames & {
  attrs?: Record<string, { default: string }>
  wrapperDOM?: (node: ProseMirrorNode) => [string, Record<string, string>, 0]
  parseWrapper?: (element: HTMLElement) => Record<string, string>
}): Extension {
  return union(
    defineNodeSpec({
      name: wrapper,
      group: "block",
      content: `${title} ${content}`,
      defining: true,
      isolating: true,
      ...(attrs ? { attrs } : {}),
      toDOM: wrapperDOM,
      parseDOM: [
        {
          tag: `div.${wrapper}`,
          ...(parseWrapper
            ? {
                getAttrs: (element: HTMLElement | string) =>
                  typeof element === "string" ? null : parseWrapper(element),
              }
            : {}),
        },
      ],
    }),
    defineNodeSpec({
      name: title,
      content: "inline*",
      defining: true,
      toDOM: () => ["div", { class: `${wrapper}__title` }, 0],
      parseDOM: [{ tag: `div.${wrapper}__title` }],
    }),
    defineNodeSpec({
      name: content,
      content: "block+",
      defining: true,
      toDOM: () => ["div", { class: `${wrapper}__content` }, 0],
      parseDOM: [{ tag: `div.${wrapper}__content` }],
    }),
  )
}

/**
 * Wraps the selected blocks into the titled block and puts the cursor into its title, or
 * unwraps the titled block around the cursor (its title stays as a paragraph).
 */
function toggleTitledBlock({ wrapper, title, content }: TitledBlockNames): Command {
  return (state, dispatch) => {
    const { $from, $to } = state.selection
    const types = state.schema.nodes
    const wrapperType = types[wrapper]
    const titleType = types[title]
    const contentType = types[content]
    if (!wrapperType || !titleType || !contentType) return false

    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth)
      if (node.type !== wrapperType) continue
      const titleNode = node.firstChild
      const blocks = node.lastChild?.content
      const paragraph = types.paragraph
      if (!blocks) return false
      const replacement =
        titleNode && titleNode.content.size > 0 && paragraph
          ? blocks.addToStart(paragraph.create(null, titleNode.content))
          : blocks
      const pos = $from.before(depth)
      dispatch?.(state.tr.replaceWith(pos, pos + node.nodeSize, replacement).scrollIntoView())
      return true
    }

    const range = $from.blockRange($to)
    if (!range || !range.parent.canReplaceWith(range.startIndex, range.endIndex, wrapperType)) {
      return false
    }
    const blocks: ProseMirrorNode[] = []
    for (let index = range.startIndex; index < range.endIndex; index++) {
      blocks.push(range.parent.child(index))
    }
    const node = wrapperType.createChecked(null, [
      titleType.create(),
      contentType.create(null, blocks),
    ])
    if (dispatch) {
      const tr = state.tr.replaceWith(range.start, range.end, node)
      // inside the wrapper, then inside its title
      tr.setSelection(TextSelection.create(tr.doc, range.start + 2))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

/** Enter in the title continues in the content instead of splitting the title. */
function defineTitleKeymap(title: string): Extension {
  return defineKeymap({
    Enter: (state, dispatch) => {
      const { $from } = state.selection
      if ($from.parent.type.name !== title) return false
      // after the title, into the content, into its first block
      const target = $from.after() + 2
      dispatch?.(state.tr.setSelection(TextSelection.near(state.doc.resolve(target))))
      return true
    },
  })
}

/**
 * In the editor, a spoiler is open unless the author collapses it with its arrow. That state
 * is local to the editor and not part of the document; learners always start collapsed.
 */
function defineSpoilerToggle(): Extension {
  return defineNodeView({
    name: "spoiler",
    constructor: (_node, view, getPos) => {
      const dom = document.createElement("div")
      dom.className = "spoiler"
      dom.dataset.open = ""
      const toggle = document.createElement("button")
      toggle.type = "button"
      toggle.className = "spoiler__toggle"
      toggle.contentEditable = "false"
      toggle.setAttribute("aria-label", "Spoiler auf- oder zuklappen")
      toggle.setAttribute("aria-expanded", "true")
      // keep the cursor where it is, the click only opens or closes
      toggle.addEventListener("mousedown", (event) => event.preventDefault())
      toggle.addEventListener("click", () => {
        const isOpen = dom.dataset.open === undefined
        if (isOpen) dom.dataset.open = ""
        else delete dom.dataset.open
        toggle.setAttribute("aria-expanded", String(isOpen))
        if (!isOpen) moveCursorOutOfContent(view, getPos())
      })
      const contentDOM = document.createElement("div")
      dom.append(toggle, contentDOM)

      return {
        dom,
        contentDOM,
        stopEvent: (event) => event.target instanceof Node && toggle.contains(event.target),
        // the open state lives on the wrapper only, the toggle is not part of the document
        ignoreMutation: (mutation) =>
          (mutation.type === "attributes" && mutation.target === dom) ||
          (mutation.type !== "selection" && toggle.contains(mutation.target)),
      }
    },
  })
}

/** A collapsed spoiler hides its content, so a cursor in there moves to the end of the title. */
function moveCursorOutOfContent(view: EditorView, pos?: number) {
  if (pos === undefined) return
  const spoiler = view.state.doc.nodeAt(pos)
  const title = spoiler?.firstChild
  if (!spoiler || !title) return
  const { from } = view.state.selection
  const contentStart = pos + 1 + title.nodeSize
  if (from < contentStart || from > pos + spoiler.nodeSize) return
  const titleEnd = pos + 1 + title.nodeSize - 1
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, titleEnd)))
}

/** The editor shows a type picker on each box, which is not part of the document. */
function defineBoxTypePicker(): Extension {
  return defineNodeView({
    name: "box",
    constructor: (initialNode, view, getPos) => {
      let node = initialNode
      const dom = document.createElement("div")
      dom.className = "box"
      const picker = document.createElement("label")
      picker.className = "box__picker"
      picker.contentEditable = "false"
      const icon = document.createElement("span")
      icon.className = "box__picker-icon"
      const select = document.createElement("select")
      select.setAttribute("aria-label", "Art der Box")
      for (const { value, label } of boxTypes) select.append(new Option(label, value))
      select.addEventListener("change", () => {
        const pos = getPos()
        if (pos === undefined) return
        view.dispatch(
          view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, type: select.value }),
        )
      })
      picker.append(icon, select)
      const contentDOM = document.createElement("div")
      dom.append(picker, contentDOM)

      const sync = () => {
        const type = String(node.attrs.type)
        dom.dataset.box = type
        select.value = type
        icon.replaceChildren(...[createBoxIcon(type)].filter((child) => child !== null))
      }
      sync()

      return {
        dom,
        contentDOM,
        update(next) {
          if (next.type !== node.type) return false
          node = next
          sync()
          return true
        },
        stopEvent: (event) => event.target instanceof Node && picker.contains(event.target),
        ignoreMutation: (mutation) =>
          mutation.type !== "selection" && picker.contains(mutation.target),
      }
    },
  })
}
