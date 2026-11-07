import { useCallback, useState } from "react"

import { OverallFeedback } from "../blocks/shared/feedback"
import type { RichTextEditor } from "../rich-text"
import { BlockView } from "../schema"
import type { RichTextId } from "../storage/types"
import { useStorage } from "../use-storage"
import { WorksheetMode, type WorksheetDocuments } from "../worksheet"
import { WorksheetContext } from "../worksheet-context"
import { FocusContext } from "./RichText"
import { Toolbar } from "./Toolbar"

export function Editor({
  worksheet,
  name,
  color = "#5364c8",
}: {
  worksheet: WorksheetDocuments
  name: string
  color?: string
}) {
  useStorage(worksheet.content.store)
  useStorage(worksheet.answers?.store)
  useStorage(worksheet.feedback?.store)
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
        <WorksheetContext value={worksheet}>
          <FocusContext value={updateFocus}>
            <div
              className={
                worksheet.mode === WorksheetMode.EditingContent
                  ? "editor-content"
                  : "learner-content"
              }
            >
              {worksheet.content.document.root.map((value) => (
                <BlockView key={value.id} value={value} />
              ))}
              <OverallFeedback />
            </div>
          </FocusContext>
        </WorksheetContext>
      </section>
    </form>
  )
}
