import { useCallback, useSyncExternalStore } from "react"
import { Awareness } from "y-protocols/awareness"
import { Doc } from "yjs"

import { createDocument } from "../editor/schema/document.ts"
import { YjsNodeStore } from "../editor/storage/index.ts"
import type { NodeStore } from "../editor/storage/types.ts"
import { Prototype } from "./content.tsx"
import { initialContent } from "./initial-content.ts"
import { syncCDRTs } from "./sync-cdrts.ts"

export type PrototypeSession = ReturnType<typeof createPrototypeSessions>["first"]

export function createPrototypeSessions() {
  const first = createSession("Editor 1", "#2563eb")
  const second = createSession("Editor 2", "#b45309")
  const firstDocument = createDocument(first.store, Prototype, initialContent)
  const disconnect = syncCDRTs(first, second)
  const secondDocument = createDocument(second.store, Prototype, initialContent)
  return {
    first: { ...first, document: firstDocument },
    second: { ...second, document: secondDocument },
    destroy() {
      disconnect()
      first.awareness.destroy()
      second.awareness.destroy()
      first.doc.destroy()
      second.doc.destroy()
    },
  }
}

export function useStorageRevision(store: Pick<NodeStore, "subscribe" | "getRevision">) {
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  const getRevision = useCallback(() => store.getRevision(), [store])
  return useSyncExternalStore(subscribe, getRevision)
}

function createSession(name: string, color: string) {
  const doc = new Doc()
  const awareness = new Awareness(doc)
  awareness.setLocalStateField("user", { name, color })
  return { name, color, doc, awareness, store: new YjsNodeStore({ doc, awareness }) }
}
