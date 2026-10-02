import { Fragment, type ResolvedPos } from "@tiptap/pm/model"
import { TextSelection, type EditorState } from "@tiptap/pm/state"
import type { ChainedCommands, Editor } from "@tiptap/react"

/**
 * Helpers shared by the block types that wrap content in a titled container
 * (the spoiler and the box): a `wrapper` node holding a `title` and a
 * `content` node.
 */
export type TitledBlockNames = {
  wrapper: string
  title: string
  content: string
}

/** the depth of the closest ancestor of `$pos` with the given node type */
export function findDepth($pos: ResolvedPos, typeName: string) {
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type.name === typeName) return depth
  }
  return null
}

/** replaces the wrapper around the selection with its title and its content */
export function unwrapTitledBlock(editor: Editor, wrapper: string) {
  const { state, view } = editor
  const { $from } = state.selection
  const depth = findDepth($from, wrapper)
  if (depth === null) return false
  const node = $from.node(depth)
  const [title, content] = [node.firstChild, node.lastChild]
  if (!title || !content) return false
  const paragraph = state.schema.nodes.paragraph.create(null, title.content)
  const fragment = title.content.size
    ? Fragment.from(paragraph).append(content.content)
    : content.content
  const start = $from.before(depth)
  const tr = state.tr.replaceWith(start, $from.after(depth), fragment)
  tr.setSelection(TextSelection.near(tr.doc.resolve(start + 1)))
  view.dispatch(tr.scrollIntoView())
  return true
}

/** wraps the selected blocks in a new wrapper, the cursor lands in its title */
export function wrapInTitledBlock(
  { state, chain }: { state: EditorState; chain: () => ChainedCommands },
  names: TitledBlockNames,
  attrs?: Record<string, unknown>,
) {
  // the selected block becomes the wrapper's first content block
  const { $from, $to } = state.selection
  const depth = Math.min($from.depth, $to.depth)
  const range = depth ? { from: $from.before(depth), to: $to.after(depth) } : null
  const content = range
    ? state.doc.slice(range.from, range.to).content.toJSON()
    : [{ type: "paragraph" }]
  return chain()
    .insertContentAt(range ?? state.selection.from, {
      type: names.wrapper,
      attrs,
      content: [{ type: names.title }, { type: names.content, content }],
    })
    .setTextSelection((range?.from ?? state.selection.from) + 2)
    .focus()
    .run()
}

/**
 * Enter moves on to the content instead of splitting the title, Backspace at
 * the start of the title unwraps the whole block.
 */
export function titleKeyboardShortcuts(
  editor: Editor,
  names: Pick<TitledBlockNames, "wrapper" | "title">,
) {
  const isInTitle = () => editor.state.selection.$from.parent.type.name === names.title

  return {
    Enter: () => {
      if (!isInTitle()) return false
      const { $from } = editor.state.selection
      return editor.commands.command(({ tr, dispatch }) => {
        const selection = TextSelection.near(tr.doc.resolve($from.after($from.depth) + 1))
        if (dispatch) dispatch(tr.setSelection(selection).scrollIntoView())
        return true
      })
    },
    Backspace: () => {
      const { empty, $from } = editor.state.selection
      if (!empty || !isInTitle() || $from.parentOffset !== 0) return false
      return unwrapTitledBlock(editor, names.wrapper)
    },
  }
}
