import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { type RootHandle, Root, type RootSnapshot } from "./content"
import { exportContent } from "./content/io"
import { createDocument } from "./schema/document"
import type { RichTextHandle } from "./schema/rich-text"
import { YjsNodeStore } from "./storage"

export type EditorSession = ReturnType<typeof createSession>

/** Initial state is applied before root binding, so peers never seed competing roots. */
export function createSession(
  { name, color }: { name: string; color: string },
  snapshot: RootSnapshot = [],
  state?: Uint8Array,
) {
  const doc = new Y.Doc()
  const awareness = new Awareness(doc)
  try {
    if (state) Y.applyUpdate(doc, state)
    awareness.setLocalStateField("user", { name, color })
    const store = new YjsNodeStore({ doc, awareness })
    const document = createDocument(store, Root, snapshot)
    let destroyed = false
    return {
      name,
      color,
      doc,
      awareness,
      store,
      document,
      exportContent: () => exportContent(document.snapshot()),
      destroy() {
        if (destroyed) return
        destroyed = true
        for (const handle of richTextHandles(document.root)) handle.getEditor().unmount()
        awareness.destroy()
        doc.destroy()
      },
    }
  } catch (error) {
    awareness.destroy()
    doc.destroy()
    throw error
  }
}

export function richTextHandles(root: RootHandle): RichTextHandle[] {
  return root
    .children()
    .flatMap((unit) =>
      unit.type === "multiple-choice"
        ? [unit.field("question"), ...unit.field("options").map((option) => option.field("text"))]
        : [unit.field("content")],
    )
}
