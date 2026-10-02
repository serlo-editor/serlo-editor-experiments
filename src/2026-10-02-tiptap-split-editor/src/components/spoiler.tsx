import { Node, mergeAttributes } from "@tiptap/core"
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react"
import { useState } from "react"

import {
  titleKeyboardShortcuts,
  unwrapTitledBlock,
  wrapInTitledBlock,
  type TitledBlockNames,
} from "@/utils/titled-block"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    spoiler: {
      /** wraps the current block in a spoiler, or unwraps the spoiler it is in */
      toggleSpoiler: () => ReturnType
    }
  }
}

const NAMES: TitledBlockNames = {
  wrapper: "spoiler",
  title: "spoilerTitle",
  content: "spoilerContent",
}

function SpoilerView({ editor, getPos }: NodeViewProps) {
  const [isOpen, setIsOpen] = useState(true)

  function toggle() {
    // the collapsed content is hidden, keep the cursor out of it
    if (isOpen) {
      const pos = getPos()
      if (pos !== undefined) editor.commands.setTextSelection(pos + 2)
    }
    setIsOpen((open) => !open)
  }

  return (
    <NodeViewWrapper className="spoiler" data-open={isOpen ? "" : undefined}>
      <button
        type="button"
        contentEditable={false}
        aria-label="Spoiler auf-/zuklappen"
        aria-expanded={isOpen}
        onClick={toggle}
        className="spoiler-toggle"
      />
      <NodeViewContent />
    </NodeViewWrapper>
  )
}

/** `<details>` wrapper, holds exactly a title and a content node */
export const Spoiler = Node.create({
  name: NAMES.wrapper,
  group: "block",
  content: `${NAMES.title} ${NAMES.content}`,
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: "details" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["details", mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SpoilerView)
  },

  addCommands() {
    return {
      toggleSpoiler:
        () =>
        ({ editor, state, chain }) =>
          editor.isActive(this.name)
            ? unwrapTitledBlock(editor, this.name)
            : wrapInTitledBlock({ state, chain }, NAMES),
    }
  },
})

/** `<summary>`, the always visible title */
export const SpoilerTitle = Node.create({
  name: NAMES.title,
  // runs before the editor's generic Enter/Backspace handling
  priority: 200,
  content: "inline*",
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: "summary" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["summary", mergeAttributes(HTMLAttributes), 0]
  },

  addKeyboardShortcuts() {
    return titleKeyboardShortcuts(this.editor, NAMES)
  },
})

/** the part hidden until the spoiler is opened */
export const SpoilerContent = Node.create({
  name: NAMES.content,
  content: "block+",
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: "div[data-spoiler-content]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-spoiler-content": "" }), 0]
  },
})
