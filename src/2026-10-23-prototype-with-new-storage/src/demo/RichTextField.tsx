import { isMarkActive, toggleMark } from "prosekit/core"
import { ProseKit, useEditor, useStateUpdate } from "prosekit/react"
import { createContext, useCallback, useContext } from "react"

import type { RichTextHandle } from "../editor/schema/rich-text.ts"

export interface LocalSelection {
  editorId: string
  type: string
  from: number
  to: number
}

export const SelectionContext = createContext<(selection: LocalSelection | null) => void>(() => {})

export function RichTextField({
  handle,
  label,
  inline = false,
}: {
  handle: RichTextHandle
  label: string
  inline?: boolean
}) {
  return (
    <ProseKit editor={handle.getEditor()}>
      <RichTextView id={handle.id} label={label} inline={inline} />
    </ProseKit>
  )
}

function RichTextView({ id, label, inline }: { id: string; label: string; inline: boolean }) {
  const editor = useEditor()
  const reportSelection = useContext(SelectionContext)
  const mount = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return editor.unmount()
      editor.mount(element)
      editor.view.dom.setAttribute("role", "textbox")
      editor.view.dom.setAttribute("aria-label", label)
      editor.view.dom.setAttribute("aria-multiline", String(!inline))
    },
    [editor, label, inline],
  )
  const report = () => {
    const selection = editor.state.selection
    reportSelection({
      editorId: id,
      type: selection.toJSON().type,
      from: selection.from,
      to: selection.to,
    })
  }
  useStateUpdate(() => {
    if (editor.mounted && editor.view.hasFocus()) report()
  })

  return (
    <div
      className={inline ? "rich-text-field rich-text-field--inline" : "rich-text-field"}
      onFocusCapture={report}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) reportSelection(null)
      }}
    >
      <Toolbar label={label} />
      <div ref={mount} className="editor-rich-text" />
    </div>
  )
}

function Toolbar({ label }: { label: string }) {
  const editor = useEditor({ update: true })
  const buttons = [
    { mark: "bold", label: "Bold", text: "B" },
    { mark: "italic", label: "Italic", text: "I" },
    { mark: "gap", label: "Gap", text: "Gap" },
  ]
  return (
    <div className="toolbar" role="toolbar" aria-label={`${label} formatting`}>
      {buttons.map((button) => {
        if (!(button.mark in editor.schema.marks)) return null
        const command = toggleMark({ type: button.mark })
        const enabled = editor.mounted && editor.canExec(command)
        const active = isMarkActive(editor.state, button.mark)
        return (
          <button
            key={button.mark}
            type="button"
            aria-label={button.label}
            aria-pressed={active}
            disabled={!enabled}
            className={`toolbar__button ${active ? "toolbar__button--active" : ""}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              editor.focus()
              editor.exec(command)
            }}
          >
            {button.text}
          </button>
        )
      })}
    </div>
  )
}
