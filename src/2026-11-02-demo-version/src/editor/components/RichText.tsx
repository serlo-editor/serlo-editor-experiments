import clsx from "clsx"
import { defineKeymap, Priority, withPriority } from "prosekit/core"
import { ProseKit } from "prosekit/react"
import { useCallback, useLayoutEffect, useRef } from "react"

import type { RichTextHandle } from "../schema/rich-text"
import { leaveAtEdge } from "./arrow-navigation"
import { Toolbar } from "./Toolbar"

/** Bordered editable area with its own toolbar, which keeps its space while hidden. */
export function RichTextField({
  handle,
  inline = false,
  className,
}: {
  handle: RichTextHandle
  inline?: boolean
  className?: string
}) {
  return (
    <ProseKit editor={handle.getEditor()}>
      <div className={clsx("rich-text-field", className)}>
        <Toolbar />
        <div className="rich-text-field__content">
          <RichTextHost handle={handle} inline={inline} />
        </div>
      </div>
    </ProseKit>
  )
}

/** Callbacks for list items, e.g. answers that are added and removed from the keyboard. */
export interface ItemKeys {
  /** replaces Enter in a non-empty editor, e.g. to add the next answer */
  onEnter?: (() => void) | undefined
  /** Backspace in an empty editor, e.g. to remove the answer */
  onDeleteEmpty?: (() => void) | undefined
}

export function RichText({
  handle,
  inline = false,
  onEnter,
  onDeleteEmpty,
}: {
  handle: RichTextHandle
  inline?: boolean
} & ItemKeys) {
  return (
    <ProseKit editor={handle.getEditor()}>
      <RichTextHost
        handle={handle}
        inline={inline}
        onEnter={onEnter}
        onDeleteEmpty={onDeleteEmpty}
      />
    </ProseKit>
  )
}

function RichTextHost({
  handle,
  inline,
  onEnter,
  onDeleteEmpty,
}: {
  handle: RichTextHandle
  inline: boolean
} & ItemKeys) {
  const editor = handle.getEditor()
  const host = useRef<HTMLElement>(null)
  const setHost = useCallback((element: HTMLElement | null) => {
    host.current = element
  }, [])
  // the keymap is registered once, the latest callbacks are read on key press
  const keys = useRef<ItemKeys>({})
  keys.current = { onEnter, onDeleteEmpty }
  const hasEnter = onEnter !== undefined
  const hasDeleteEmpty = onDeleteEmpty !== undefined
  const HTMLTag = inline ? "span" : "div"

  useLayoutEffect(() => {
    const removeKeymap = editor.use(
      withPriority(
        defineKeymap({
          ArrowUp: leaveAtEdge(-1),
          ArrowDown: leaveAtEdge(1),
          ...(hasEnter
            ? {
                Enter: (state) => {
                  if (state.doc.textContent.trim()) keys.current.onEnter?.()
                  return true
                },
              }
            : {}),
          ...(hasDeleteEmpty
            ? {
                Backspace: (state) => {
                  if (state.doc.textContent) return false
                  keys.current.onDeleteEmpty?.()
                  return true
                },
              }
            : {}),
        }),
        Priority.high,
      ),
    )
    editor.mount(host.current)
    return () => {
      removeKeymap()
      editor.unmount()
    }
  }, [editor, hasEnter, hasDeleteEmpty])

  return (
    <HTMLTag
      ref={setHost}
      className={inline ? "editor-rich-text editor-rich-text--inline" : "editor-rich-text"}
    />
  )
}
