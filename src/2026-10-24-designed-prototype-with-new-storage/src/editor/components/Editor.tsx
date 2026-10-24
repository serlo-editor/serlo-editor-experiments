import { useCallback, useState } from "react"

import type { RichTextEditor } from "../rich-text"
import { UnitView } from "../schema"
import type { EditorSession } from "../session"
import type { RichTextId } from "../storage/types"
import { useStorage } from "../use-storage"
import { FocusContext } from "./RichText"
import { Toolbar } from "./Toolbar"

export function Editor({ session }: { session: EditorSession }) {
  useStorage(session.store)
  const [focused, setFocused] = useState<{ id: RichTextId; editor: RichTextEditor } | null>(null)
  const updateFocus = useCallback((id: RichTextId, editor: RichTextEditor, hasFocus: boolean) => {
    setFocused((previous) => (hasFocus ? { id, editor } : previous?.id === id ? null : previous))
  }, [])

  return (
    <form
      className="editor-card panel"
      aria-label={session.name}
      onSubmit={(event) => event.preventDefault()}
    >
      <h2 className="editor-card__title">
        <span
          className="editor-card__accent"
          style={{ backgroundColor: session.color }}
          aria-hidden="true"
        />{" "}
        {session.name}
      </h2>
      <section className="editor-frame surface">
        <div className="editor-toolbar-shell">
          <Toolbar editor={focused?.editor ?? null} />
        </div>
        <FocusContext value={updateFocus}>
          <div className="editor-content">
            {session.document.root.map((handle) => (
              <UnitView key={handle.id} handle={handle} />
            ))}
          </div>
        </FocusContext>
      </section>
    </form>
  )
}
