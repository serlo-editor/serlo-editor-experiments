import type { Awareness } from "prosekit/extensions/yjs"
import type * as Y from "yjs"

import { Root, type RootSnapshot } from "./content"
import { createDocument } from "./schema/document"
import { YjsNodeStore } from "./storage"

export type EditorSession = ReturnType<typeof createSession>

/**
 * Binds an editor document to a Yjs doc and awareness owned by the caller (e.g. a sync
 * connection). Load remote state before creating the session, so peers never seed
 * competing roots.
 */
export function createSession({
  user: { name, color },
  doc,
  awareness,
  snapshot = [],
}: {
  user: { name: string; color: string }
  doc: Y.Doc
  awareness: Awareness
  snapshot?: RootSnapshot
}) {
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
    },
  }
}
