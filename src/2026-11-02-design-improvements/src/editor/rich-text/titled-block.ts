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

/** The editor shows a type picker on each box, which is not part of the document. */
function defineBoxTypePicker(): Extension {
  return defineNodeView({
    name: "box",
    constructor: (initialNode, view, getPos) => {
      let node = initialNode
      const dom = document.createElement("div")
      dom.className = "box"
      const picker = document.createElement("select")
      picker.className = "box__picker"
      picker.contentEditable = "false"
      picker.setAttribute("aria-label", "Art der Box")
      for (const { value, label } of boxTypes) picker.append(new Option(label, value))
      picker.addEventListener("change", () => {
        const pos = getPos()
        if (pos === undefined) return
        view.dispatch(
          view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, type: picker.value }),
        )
      })
      const contentDOM = document.createElement("div")
      dom.append(picker, contentDOM)

      const sync = () => {
        const type = String(node.attrs.type)
        dom.dataset.box = type
        picker.value = type
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
