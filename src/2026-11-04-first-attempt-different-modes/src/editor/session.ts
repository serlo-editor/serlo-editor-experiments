import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { Root, type RootSnapshot } from "./blocks"
import { bindDocument } from "./documents"
import type { Schema, StoredValue } from "./schema/types"
import { type NodeKind, YjsNodeStore } from "./storage"
import type { JSONValue } from "./utils"

export type EditorSession = ReturnType<typeof createSession>

export function createSession(
  user: { name: string; color: string },
  snapshot: RootSnapshot = [],
  state?: Uint8Array,
) {
  return createDocumentSession(user, Root, snapshot, state)
}

/** Import first peer's state before binding, so peers never seed competing roots. */
export function createDocumentSession<
  Snapshot extends JSONValue,
  Value extends StoredValue<Snapshot>,
  Kind extends NodeKind,
>(
  { name, color }: { name: string; color: string },
  schema: Schema<Snapshot, Value, Kind>,
  snapshot: Snapshot,
  state?: Uint8Array,
) {
  const doc = new Y.Doc()
  const awareness = new Awareness(doc)
  try {
    if (state) Y.applyUpdate(doc, state)
    awareness.setLocalStateField("user", { name, color })
    const document = bindDocument(new YjsNodeStore({ doc, awareness }), schema, snapshot)
    let destroyed = false
    return {
      name,
      color,
      doc,
      awareness,
      ...document,
      destroy() {
        if (destroyed) return
        destroyed = true
        // Document lifetime also owns awareness and cached rich-text views.
        doc.destroy()
      },
    }
  } catch (error) {
    doc.destroy()
    throw error
  }
}
