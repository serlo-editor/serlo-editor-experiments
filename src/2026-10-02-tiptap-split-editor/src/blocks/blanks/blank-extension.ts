import { mergeAttributes, Node } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import { NodeSelection, Plugin, type Transaction } from "@tiptap/pm/state"
import { ReactNodeViewRenderer } from "@tiptap/react"

import { createSimpleUID } from "@/utils/create-simple-uid"

import { BlankView } from "./blank-view"
import { ANSWERS_ATTRIBUTE, BLANK_ATTRIBUTE, readAnswers } from "./state"

export const BLANK_NODE = "blank"

export interface BlankAttributes {
  id: string
  answers: string[]
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blank: {
      /** inserts a blank, selected text becomes its first valid answer */
      insertBlank: () => ReturnType
      updateBlankAnswers: (id: string, answers: string[]) => ReturnType
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

/** the blank that is currently selected as a whole, if any */
export function selectedBlank(selection: Transaction["selection"]): BlankAttributes | null {
  if (!(selection instanceof NodeSelection)) return null
  if (selection.node.type.name !== BLANK_NODE) return null
  return selection.node.attrs as BlankAttributes
}

export const Blank = Node.create({
  name: BLANK_NODE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  // no bold, italic, links etc. on a blank
  marks: "",

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute(BLANK_ATTRIBUTE),
        renderHTML: (attributes) => ({ [BLANK_ATTRIBUTE]: attributes.id }),
      },
      answers: {
        default: [],
        parseHTML: readAnswers,
        renderHTML: (attributes) => ({
          [ANSWERS_ATTRIBUTE]: JSON.stringify(attributes.answers),
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
      insertBlank:
        () =>
        ({ state, tr, dispatch }) => {
          const { from, to, empty } = state.selection
          const text = empty ? "" : state.doc.textBetween(from, to, " ").trim()
          const id = createSimpleUID()
          const node = this.type.create({ id, answers: text ? [text] : [] })
          if (dispatch) {
            tr.replaceSelectionWith(node, false)
            // select the new blank so its answers can be edited right away
            const pos = findBlankPos(tr.doc, id)
            if (pos !== undefined) tr.setSelection(NodeSelection.create(tr.doc, pos))
          }
          return true
        },
      updateBlankAnswers:
        (id, answers) =>
        ({ state, tr, dispatch }) => {
          const pos = findBlankPos(state.doc, id)
          if (pos === undefined) return false
          if (dispatch) {
            const node = state.doc.nodeAt(pos)!
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, answers })
            // keep the blank selected, the panel stays open
            if (state.selection instanceof NodeSelection)
              tr.setSelection(NodeSelection.create(tr.doc, pos))
          }
          return true
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
