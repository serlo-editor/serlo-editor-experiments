import { useCallback, useState } from "react"

import type { RootValue } from "../blocks"
import { Answers, Feedback } from "../blocks/responses"
import type { RichTextEditor } from "../rich-text"
import { BlockView } from "../schema"
import type { StoredValueOf } from "../schema/types"
import type { NodeStore, NodeRefs, RichTextId } from "../store"
import { useStorage } from "../store/use-storage"
import { WorksheetMode, WorksheetRevisionProvider, type Worksheet } from "../worksheet"
import { FocusContext } from "./RichText"
import { Toolbar } from "./Toolbar"

export type EditorWorksheet = Worksheet<
  RootValue,
  StoredValueOf<typeof Answers>,
  StoredValueOf<typeof Feedback>
>

export function Editor({
  worksheet,
  store,
  name,
  color = "#5364c8",
}: {
  worksheet: EditorWorksheet
  store: Pick<NodeStore<NodeRefs>, "subscribe" | "getRevision">
  name: string
  color?: string
}) {
  useStorage(store)
  const [focused, setFocused] = useState<{ id: RichTextId; editor: RichTextEditor } | null>(null)
  const updateFocus = useCallback((id: RichTextId, editor: RichTextEditor, hasFocus: boolean) => {
    setFocused((previous) => (hasFocus ? { id, editor } : previous?.id === id ? null : previous))
  }, [])

  return (
    <form
      className="editor-card panel"
      aria-label={name}
      onSubmit={(event) => event.preventDefault()}
    >
      <h2 className="editor-card__title">
        <span
          className="editor-card__accent"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        {name}
      </h2>
      <section className="editor-frame surface">
        {(worksheet.mode === WorksheetMode.EditingContent ||
          worksheet.mode === WorksheetMode.GivingFeedback) && (
          <div className="editor-toolbar-shell">
            <Toolbar editor={focused?.editor ?? null} />
          </div>
        )}
        <WorksheetRevisionProvider worksheet={worksheet}>
          <FocusContext value={updateFocus}>
            <div
              className={
                worksheet.mode === WorksheetMode.EditingContent
                  ? "editor-content"
                  : "learner-content"
              }
            >
              {worksheet.content.map((value) => (
                <BlockView key={value.id} value={value} />
              ))}
            </div>
          </FocusContext>
        </WorksheetRevisionProvider>
      </section>
    </form>
  )
}
