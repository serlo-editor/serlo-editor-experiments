import { InputRule, Node, mergeAttributes, type Editor } from "@tiptap/core"
import { NodeSelection, Selection } from "@tiptap/pm/state"
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react"
import { Keyboard, Sigma, SquareSigma } from "lucide-react"
import { MathfieldElement } from "mathlive"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"

import type { Direction } from "@/utils/arrow-key-navigation"
import { cn } from "@/utils/cn"

export const MATH_NODE = "math"
export const MATH_BLOCK_NODE = "mathBlock"
export const MATH_ATTRIBUTE = "data-math"
export const MATH_BLOCK_ATTRIBUTE = "data-math-block"

// the fonts ship with `mathlive/static.css` (imported in main.tsx), which also
// tells MathLive not to load them a second time at runtime; the keypress
// sounds are not part of the bundle
MathfieldElement.fontsDirectory = null
MathfieldElement.soundsDirectory = null

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    math: {
      /** inserts a formula in the text, selected text becomes its LaTeX */
      insertMath: (options?: InsertMathOptions) => ReturnType
      /** inserts a formula on a line of its own */
      insertMathBlock: (options?: InsertMathOptions) => ReturnType
      /** moves the formula at `pos` into its own line, or back into the text */
      setMathDisplay: (pos: number, isBlock: boolean) => ReturnType
    }
  }
}

export interface InsertMathOptions {
  latex?: string
  /** selects the new formula, which puts the caret inside it (default true) */
  select?: boolean
}

/** the LaTeX lives in the element's text, so plain HTML stays readable */
const latexAttribute = {
  latex: {
    default: "",
    parseHTML: (element: HTMLElement) => element.textContent ?? "",
    // written as the element's content by `renderHTML` instead
    renderHTML: () => ({}),
  },
}

/** puts the caret before (-1) / after (1) the formula and focuses the document */
function leaveMath(editor: Editor, pos: number, nodeSize: number, direction: Direction) {
  const { state, view } = editor
  const target = direction === 1 ? pos + nodeSize : pos
  view.dispatch(
    state.tr.setSelection(Selection.near(state.doc.resolve(target), direction)).scrollIntoView(),
  )
  view.focus()
}

/** round icon button sitting inside the formula, next to the field */
function MathButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // keep the focus (and the caret) in the formula
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-200/90 text-neutral-600 transition-colors hover:bg-indigo-100 hover:text-indigo-700 [&>svg]:h-3 [&>svg]:w-3"
    >
      {children}
    </button>
  )
}

/**
 * A MathLive `<math-field>` in place of the node: it brings its own editing
 * (LaTeX shortcuts, a symbol keyboard) and hands the LaTeX back on every
 * keystroke.
 */
function MathView(props: NodeViewProps) {
  const { node, selected, editor, getPos } = props
  const isBlock = node.type.name === MATH_BLOCK_NODE
  const latex = node.attrs.latex as string
  // the buttons would clutter the text if every formula showed them
  const [isEditing, setIsEditing] = useState(false)

  const host = useRef<HTMLSpanElement>(null)
  const field = useRef<MathfieldElement | null>(null)
  // the listeners below live as long as the field, the props do not
  const latest = useRef(props)
  latest.current = props

  useLayoutEffect(() => {
    const container = host.current
    if (!container) return

    const mathfield = new MathfieldElement({
      // "math" is TeX's display style, for formulas standing on their own
      defaultMode: isBlock ? "math" : "inline-math",
    })
    field.current = mathfield
    // properties are only accepted once the element is in the document
    container.append(mathfield)
    mathfield.value = latest.current.node.attrs.latex as string
    mathfield.readOnly = !latest.current.editor.isEditable
    // the context menu offers exports and settings we do not support here
    mathfield.menuItems = []

    const move = (direction: Direction) => {
      const pos = latest.current.getPos()
      if (pos === undefined) return
      leaveMath(latest.current.editor, pos, latest.current.node.nodeSize, direction)
    }

    mathfield.addEventListener("input", () =>
      latest.current.updateAttributes({ latex: mathfield.value }),
    )

    mathfield.addEventListener("focusin", () => setIsEditing(true))
    mathfield.addEventListener("focusout", () => setIsEditing(false))

    // an arrow or tab key with nowhere left to go inside the formula
    mathfield.addEventListener("move-out", (event) => {
      event.preventDefault()
      const { direction } = event.detail
      move(direction === "backward" || direction === "upward" ? -1 : 1)
    })

    mathfield.addEventListener("keydown", (event) => {
      // Enter stays with MathLive in a block formula, where it adds matrix rows
      if (event.key === "Escape" || (event.key === "Enter" && !isBlock)) {
        event.preventDefault()
        move(1)
        return
      }
      // backspace past the last character removes the formula
      if (event.key === "Backspace" && mathfield.value === "") {
        event.preventDefault()
        latest.current.deleteNode()
        latest.current.editor.commands.focus()
      }
    })

    return () => {
      mathfield.remove()
      field.current = null
    }
  }, [isBlock])

  // changes from outside the field, e.g. undo
  useEffect(() => {
    const mathfield = field.current
    if (mathfield && mathfield.value !== latex)
      mathfield.setValue(latex, { silenceNotifications: true })
  }, [latex])

  // a formula is selected as a whole right after it was inserted, and whenever
  // the caret runs into it from the document — both mean "edit this one"
  useEffect(() => {
    const mathfield = field.current
    if (selected && mathfield && !mathfield.hasFocus()) mathfield.focus()
  }, [selected])

  const toggleKeyboard = () => {
    field.current?.focus()
    const keyboard = window.mathVirtualKeyboard
    keyboard.visible = !keyboard.visible
  }

  const switchDisplay = () => {
    const pos = getPos()
    if (pos !== undefined) editor.commands.setMathDisplay(pos, !isBlock)
  }

  return (
    <NodeViewWrapper
      as={isBlock ? "div" : "span"}
      className={cn(
        "math",
        isBlock ? "math-block" : "math-inline",
        !latex && "math-empty",
        selected && "math-selected",
      )}
    >
      {/* the field manages its own DOM, ProseMirror must keep out of it */}
      <span ref={host} className="math-host" contentEditable={false} />
      {(isEditing || selected) && (
        <span className="math-controls" contentEditable={false}>
          <MathButton label="Tastatur" onClick={toggleKeyboard}>
            <Keyboard />
          </MathButton>
          <MathButton
            label={isBlock ? "In den Text holen" : "In eine eigene Zeile"}
            onClick={switchDisplay}
          >
            {isBlock ? <Sigma /> : <SquareSigma />}
          </MathButton>
        </span>
      )}
    </NodeViewWrapper>
  )
}

const nodeView = (as: "span" | "div") =>
  ReactNodeViewRenderer(MathView, {
    as,
    // everything inside the formula belongs to MathLive
    stopEvent: () => true,
    ignoreMutation: () => true,
  })

/** formula in the flow of the text */
export const Math = Node.create({
  name: MATH_NODE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  // no bold, italic, links etc. on a formula
  marks: "",

  addAttributes: () => latexAttribute,

  parseHTML() {
    return [{ tag: `span[${MATH_ATTRIBUTE}]` }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { [MATH_ATTRIBUTE]: "" }),
      node.attrs.latex as string,
    ]
  },

  addNodeView() {
    return nodeView("span")
  },

  addCommands() {
    return {
      insertMath:
        ({ latex, select = true } = {}) =>
        ({ state, tr, dispatch }) => {
          const { from, to, empty } = state.selection
          const value = latex ?? (empty ? "" : state.doc.textBetween(from, to, " ").trim())
          if (dispatch) {
            const node = this.type.create({ latex: value })
            tr.replaceWith(from, to, node)
            if (select) tr.setSelection(NodeSelection.create(tr.doc, from))
          }
          return true
        },

      setMathDisplay:
        (pos, isBlock) =>
        ({ state, tr, dispatch }) => {
          const node = state.doc.nodeAt(pos)
          const target = isBlock ? MATH_BLOCK_NODE : MATH_NODE
          if (!node || node.type.name === target) return false
          const { latex } = node.attrs
          const replacement = state.schema.nodes[target].create({ latex })
          if (!dispatch) return true

          if (!isBlock) {
            // back into the text: a paragraph of its own, holding the formula
            tr.replaceWith(
              pos,
              pos + node.nodeSize,
              state.schema.nodes.paragraph.create(null, replacement),
            )
            tr.setSelection(NodeSelection.create(tr.doc, pos + 1))
            return true
          }

          // out of the text: a block cannot live in a paragraph, so the
          // paragraph has to make room for it — by being replaced when the
          // formula was all it held, and by being split around it otherwise
          const $pos = state.doc.resolve(pos)
          const depth = $pos.depth
          const hasTextBefore = pos > $pos.start(depth)
          const hasTextAfter = pos + node.nodeSize < $pos.end(depth)
          let at: number
          if (!hasTextBefore && !hasTextAfter) {
            at = $pos.before(depth)
            tr.replaceWith(at, $pos.after(depth), replacement)
          } else if (!hasTextBefore) {
            at = $pos.before(depth)
            tr.delete(pos, pos + node.nodeSize)
            tr.insert(at, replacement)
          } else if (!hasTextAfter) {
            tr.delete(pos, pos + node.nodeSize)
            at = tr.mapping.map($pos.after(depth))
            tr.insert(at, replacement)
          } else {
            tr.delete(pos, pos + node.nodeSize)
            tr.split(pos)
            at = pos + 1
            tr.insert(at, replacement)
          }
          tr.setSelection(NodeSelection.create(tr.doc, at))
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-m": () => this.editor.commands.insertMath(),
    }
  },

  addInputRules() {
    return [
      // `$$` opens an empty formula to type into
      new InputRule({
        find: /\$\$$/,
        handler: ({ chain, range }) => {
          chain().deleteRange(range).insertMath().run()
        },
      }),
      // `$x^2$` turns what was typed in between into a formula; the inner
      // text may not start or end with a space, so prices stay prices
      new InputRule({
        find: /\$([^\s$](?:[^$]*[^\s$])?)\$$/,
        handler: ({ chain, range, match }) => {
          chain().deleteRange(range).insertMath({ latex: match[1], select: false }).run()
        },
      }),
    ]
  },
})

/** formula on a line of its own, typeset in TeX's display style */
export const MathBlock = Node.create({
  name: MATH_BLOCK_NODE,
  group: "block",
  atom: true,
  selectable: true,

  addAttributes: () => latexAttribute,

  parseHTML() {
    return [{ tag: `div[${MATH_BLOCK_ATTRIBUTE}]` }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { [MATH_BLOCK_ATTRIBUTE]: "" }),
      node.attrs.latex as string,
    ]
  },

  addNodeView() {
    return nodeView("div")
  },

  addCommands() {
    return {
      insertMathBlock:
        ({ latex = "", select = true } = {}) =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection
          if ($from.depth === 0) return false
          // an empty paragraph makes room for the formula, otherwise it goes
          // below the block the caret is in
          const isEmpty = $from.parent.isTextblock && !$from.parent.content.size
          const from = isEmpty ? $from.before() : $from.after()
          const to = isEmpty ? $from.after() : from
          if (dispatch) {
            tr.replaceWith(from, to, this.type.create({ latex }))
            if (select) tr.setSelection(NodeSelection.create(tr.doc, from))
          }
          return true
        },
    }
  },
})
