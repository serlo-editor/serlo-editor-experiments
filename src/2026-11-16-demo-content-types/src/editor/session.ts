import type { Awareness } from "prosekit/extensions/yjs"
import type * as Y from "yjs"

import { Root, type RootSnapshot } from "./content"
import { openRoot } from "./schema"
import { YjsNodeStore } from "./store"

export type EditorSession = ReturnType<typeof createSession>

export function createSession({
  user: { name, color },
  doc,
  awareness,
  snapshot,
}: {
  user: { name: string; color: string }
  doc: Y.Doc
  awareness: Awareness
  snapshot: RootSnapshot
}) {
  awareness.setLocalStateField("user", { name, color })
  const store = new YjsNodeStore({ doc, awareness, storeName: "content" })
  const root = openRoot(store, Root, snapshot)
  return { name, color, doc, awareness, store, root, destroy: () => store.dispose() }
}
