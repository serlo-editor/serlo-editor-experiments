import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"

import { cn } from "@/utils/cn"

import type { BlankAttributes } from "./blank-extension"
import { BLANK_ATTRIBUTE } from "./state"

/** a blank inside the text editor: its answer is typed right into it */
export function BlankView({ node, updateAttributes, deleteNode, editor, getPos }: NodeViewProps) {
  const { id, answer } = node.attrs as BlankAttributes
  return (
    <NodeViewWrapper as="span" className="mx-0.5 inline-block align-baseline">
      <input
        {...{ [BLANK_ATTRIBUTE]: id }}
        aria-label="Antwort der Lücke"
        value={answer}
        placeholder="Antwort"
        autoFocus={!answer}
        style={{ width: `${Math.max(answer.length, 6) + 2}ch` }}
        onChange={(event) => updateAttributes({ answer: event.target.value })}
        onKeyDown={(event) => {
          // an empty blank is removed like a character
          if (event.key === "Backspace" && !answer) {
            event.preventDefault()
            deleteNode()
            editor.commands.focus()
          }
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault()
            editor.commands.focus()
          }
          // at the edges the caret walks on into the surrounding text
          const input = event.currentTarget
          const caret = input.selectionStart === input.selectionEnd ? input.selectionStart : null
          const pos = getPos()
          if (pos === undefined) return
          if (event.key === "ArrowLeft" && caret === 0) {
            event.preventDefault()
            editor.commands.focus(pos)
          }
          if (event.key === "ArrowRight" && caret === answer.length) {
            event.preventDefault()
            editor.commands.focus(pos + 1)
          }
        }}
        className={cn(
          "rounded-md bg-indigo-50 px-2 text-indigo-900 ring-offset-white placeholder:text-indigo-900/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-1",
        )}
      />
    </NodeViewWrapper>
  )
}
