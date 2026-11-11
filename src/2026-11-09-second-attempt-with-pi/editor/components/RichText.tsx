import { defineFocusChangeHandler, defineUpdateHandler, union } from "prosekit/core"
import { ProseKit } from "prosekit/react"
import { createContext, useCallback, useContext, useLayoutEffect, useRef } from "react"

import type { RichTextEditor } from "../rich-text"
import type { StoredRichText } from "../schema/rich-text"
import type { RichTextId } from "../storage/types"

export const FocusContext = createContext<
  (id: RichTextId, editor: RichTextEditor, focused: boolean) => void
>(() => {})

export function RichText({ value, inline = false }: { value: StoredRichText; inline?: boolean }) {
  const editor = value.getEditor()
  const id = value.id
  const host = useRef<HTMLElement>(null)
  const setHost = useCallback((element: HTMLElement | null) => {
    host.current = element
  }, [])
  const updateFocus = useContext(FocusContext)
  const HTMLTag = inline ? "span" : "div"

  useLayoutEffect(() => {
    const remove = editor.use(
      union(
        defineFocusChangeHandler((focused) => updateFocus(id, editor, focused)),
        defineUpdateHandler((view) => {
          if (view.hasFocus()) updateFocus(id, editor, true)
        }),
      ),
    )
    editor.mount(host.current)
    return () => {
      remove()
      editor.unmount()
      updateFocus(id, editor, false)
    }
  }, [editor, id, updateFocus])

  return (
    <ProseKit editor={editor}>
      <HTMLTag
        ref={setHost}
        className={inline ? "editor-rich-text editor-rich-text--inline" : "editor-rich-text"}
      />
    </ProseKit>
  )
}
