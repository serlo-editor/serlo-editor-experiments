import { mergeAttributes, Node } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import { Plugin, type Transaction } from "@tiptap/pm/state"
import { ReactNodeViewRenderer } from "@tiptap/react"

import { createSimpleUID } from "@/utils/create-simple-uid"

import { BlankView } from "./blank-view"
import { ANSWER_ATTRIBUTE, BLANK_ATTRIBUTE, readAnswer } from "./state"

export const BLANK_NODE = "dndBlank"

export interface BlankAttributes {
  id: string
  answer: string
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    dndBlank: {
      /** inserts a blank, selected text becomes its answer */
      insertDndBlank: () => ReturnType
    }
  }
}

/** position of the blank with the given id, undefined if there is none */
export function findBlankPos(doc: PMNode, id: string) {
  let found: number | undefined
  doc.descendants((node, pos) => {
    if (found !== undefined) return false
    if (node.type.name === BLANK_NODE && node.attrs.id === id) found = pos
  })
  return found
}

/** moves focus into the input of a blank's node view, caret at the given edge */
function focusBlankInput(dom: globalThis.Node | null, caret: "start" | "end") {
  const input = dom instanceof HTMLElement ? dom.querySelector("input") : null
  if (!input) return false
  input.focus()
  const position = caret === "start" ? 0 : input.value.length
  input.setSelectionRange(position, position)
  return true
}

/**
 * A blank whose single answer is typed straight into the blank, see
 * `BlankView`. Stored like the blanks of the plain blanks exercise, only with
 * one answer instead of a list.
 */
export const DndBlank = Node.create({
  name: BLANK_NODE,
  group: "inline",
  inline: true,
  atom: true,
  // the input inside handles clicks and keys, a node selection would only
  // get in the way
  selectable: false,
  draggable: false,
  marks: "",

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute(BLANK_ATTRIBUTE),
        renderHTML: (attributes) => ({ [BLANK_ATTRIBUTE]: attributes.id }),
      },
      answer: {
        default: "",
        parseHTML: readAnswer,
        renderHTML: (attributes) => ({
          [ANSWER_ATTRIBUTE]: attributes.answer,
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: `span[${BLANK_ATTRIBUTE}]` }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlankView, { as: "span" })
  },

  addCommands() {
    return {
      insertDndBlank:
        () =>
        ({ state, tr, dispatch }) => {
          const { from, to, empty } = state.selection
          const answer = empty ? "" : state.doc.textBetween(from, to, " ").trim()
          const node = this.type.create({ id: createSimpleUID(), answer })
          if (dispatch) tr.replaceSelectionWith(node, false)
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    // the caret walks into a blank's input like into a word, see `BlankView`
    // for the way back out
    return {
      ArrowRight: ({ editor }) => {
        const { selection } = editor.state
        if (!selection.empty) return false
        const node = selection.$from.nodeAfter
        if (node?.type.name !== BLANK_NODE) return false
        return focusBlankInput(editor.view.nodeDOM(selection.from), "start")
      },
      ArrowLeft: ({ editor }) => {
        const { selection } = editor.state
        if (!selection.empty) return false
        const node = selection.$from.nodeBefore
        if (node?.type.name !== BLANK_NODE) return false
        return focusBlankInput(editor.view.nodeDOM(selection.from - node.nodeSize), "end")
      },
    }
  },

  addProseMirrorPlugins() {
    // pasted or duplicated blanks would share an id, give them a fresh one
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null
          const seen = new Set<string>()
          let tr: Transaction | null = null
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== BLANK_NODE) return
            const id = node.attrs.id as string | null
            if (id && !seen.has(id)) {
              seen.add(id)
              return
            }
            tr ??= newState.tr
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              id: createSimpleUID(),
            })
          })
          return tr
        },
      }),
    ]
  },
})
