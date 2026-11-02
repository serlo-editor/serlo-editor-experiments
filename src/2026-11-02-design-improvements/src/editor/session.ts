import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { Root, type RootSnapshot } from "./content"
import { createDocument } from "./schema/document"
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
      destroy() {
        if (destroyed) return
        destroyed = true
        store.unmountEditors()
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
