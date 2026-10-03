import { InputRule, Node, mergeAttributes } from "@tiptap/core"
import { TextSelection } from "@tiptap/pm/state"
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react"

import { BOX_TYPES, boxTypeIcon, resolveBoxType, type BoxType } from "@/utils/box-types"
import {
  findDepth,
  titleKeyboardShortcuts,
  unwrapTitledBlock,
  wrapInTitledBlock,
  type TitledBlockNames,
} from "@/utils/titled-block"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    box: {
      /** wraps the current block in a box, or unwraps the box it is in */
      toggleBox: () => ReturnType
      /** switches the type (and with it the badge) of the surrounding box */
      setBoxType: (type: BoxType) => ReturnType
    }
  }
}

const NAMES: TitledBlockNames = {
  wrapper: "box",
  title: "boxTitle",
  content: "boxContent",
}

function BoxView({ node, updateAttributes, editor }: NodeViewProps) {
  const type = resolveBoxType(node.attrs.type as string | null)
  const Icon = boxTypeIcon(type)

  return (
    <NodeViewWrapper className="box" data-box={type}>
      {editor.isEditable && (
        <div
          contentEditable={false}
          className="box-picker absolute right-2 top-1.5 z-10 flex items-center gap-1 text-indigo-600"
        >
          {Icon && <Icon className="h-4 w-4" />}
          <select
            aria-label="Art der Box"
            value={type}
            onChange={(event) => updateAttributes({ type: event.target.value as BoxType })}
            className="rounded-md border border-indigo-200 bg-white/80 px-1.5 py-0.5 text-xs text-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {BOX_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
      <NodeViewContent />
    </NodeViewWrapper>
  )
}

/**
 * A titled card, like the spoiler but always open, and with a type that adds
 * an icon and a label to its title row. Previews render that badge from the
 * `data-box` attribute, see `renderBoxBadges`.
 */
export const Box = Node.create({
  name: NAMES.wrapper,
  group: "block",
  content: `${NAMES.title} ${NAMES.content}`,
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      type: {
        default: "blank" satisfies BoxType,
        parseHTML: (element) => resolveBoxType(element.getAttribute("data-box")),
        renderHTML: ({ type }) => ({ "data-box": type as string }),
      },
    }
  },

  parseHTML() {
    return [{ tag: "div[data-box]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "box" }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BoxView)
  },

  addInputRules() {
    return [
      // `> ` is markdown's blockquote, the quote box is our version of it
      new InputRule({
        find: /^>\s$/,
        handler: ({ chain, range, state }) => {
          // toggling would unwrap the box we are already in
          if (findDepth(state.selection.$from, this.name) !== null) return null
          chain()
            .deleteRange(range)
            .toggleBox()
            .setBoxType("quote")
            .command(({ tr, dispatch }) => {
              // the quote goes below the title the box opens with
              const depth = findDepth(tr.selection.$from, NAMES.title)
              if (depth === null) return false
              const after = tr.selection.$from.after(depth) + 1
              if (dispatch) dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(after))))
              return true
            })
            .run()
        },
      }),
    ]
  },

  addCommands() {
    return {
      toggleBox:
        () =>
        ({ editor, state, chain }) =>
          editor.isActive(this.name)
            ? unwrapTitledBlock(editor, this.name)
            : wrapInTitledBlock({ state, chain }, NAMES),
      setBoxType:
        (type) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { type }),
    }
  },
})

/** the always visible title, the type badge sits next to it */
export const BoxTitle = Node.create({
  name: NAMES.title,
  // runs before the editor's generic Enter/Backspace handling
  priority: 200,
  content: "inline*",
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: "div[data-box-title]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-box-title": "" }), 0]
  },

  addKeyboardShortcuts() {
    return titleKeyboardShortcuts(this.editor, NAMES)
  },
})

export const BoxContent = Node.create({
  name: NAMES.content,
  content: "block+",
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: "div[data-box-content]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-box-content": "" }), 0]
  },
})
