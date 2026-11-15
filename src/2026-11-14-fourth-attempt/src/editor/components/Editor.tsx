import type { RootValue } from "@editor/blocks"
import { Answers, Feedback } from "@editor/blocks"
import type { RichTextEditor } from "@editor/rich-text"
import { BlockView, type StoredValueOf } from "@editor/schema"
import { useStorage, type NodeStore, type NodeRefs, type RichTextId } from "@editor/store"
import { WorksheetMode, WorksheetRevisionProvider, type Worksheet } from "@editor/worksheet"
import { useCallback, useState } from "react"

import { FocusContext } from "./RichText"
import { Toolbar } from "./Toolbar"

import styles from "./Editor.module.css"

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
    <form className={styles.card} aria-label={name} onSubmit={(event) => event.preventDefault()}>
      <h2 className={styles.title}>
        <span className={styles.accent} style={{ backgroundColor: color }} aria-hidden="true" />
        {name}
      </h2>
      <section className={styles.frame}>
        {(worksheet.mode === WorksheetMode.EditingContent ||
          worksheet.mode === WorksheetMode.GivingFeedback) && (
          <div className={styles.toolbarShell}>
            <Toolbar editor={focused?.editor ?? null} />
          </div>
        )}
        <WorksheetRevisionProvider worksheet={worksheet}>
          <FocusContext value={updateFocus}>
            <div className={styles.content}>
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
