import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { Root, type RootSnapshot, type RootValue } from "./content"
import { bindDocument } from "./documents"
import type { StoredRichText } from "./schema/rich-text"
import { YjsNodeStore } from "./storage"

export type EditorSession = ReturnType<typeof createSession>

/** Import first peer's state before binding, so peers never seed competing roots. */
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
    const content = bindDocument(new YjsNodeStore({ doc, awareness }), Root, snapshot)
    let destroyed = false
    return {
      name,
      color,
      doc,
      awareness,
      ...content,
      destroy() {
        if (destroyed) return
        destroyed = true
        for (const value of richTextValues(content.document.root)) value.getEditor().unmount()
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

export function richTextValues(root: RootValue): StoredRichText[] {
  return root
    .children()
    .flatMap((value) =>
      value.type === "multiple-choice"
        ? [value.field("question"), ...value.field("options").map((option) => option.field("text"))]
        : [value.field("content")],
    )
}
