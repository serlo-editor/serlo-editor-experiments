import { applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness.js"
import * as Y from "yjs"

import type { CDRT } from "../editor"

export function syncCDRTs(cdrt1: CDRT, cdrt2: CDRT) {
  const { doc: doc1, awareness: awareness1 } = cdrt1
  const { doc: doc2, awareness: awareness2 } = cdrt2

  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))
  Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2))

  const doc1Listener = doc1.on("update", (update, origin) => {
    if (origin != null) Y.applyUpdate(doc2, update)
  })

  const doc2Listener = doc2.on("update", (update, origin) => {
    if (origin != null) Y.applyUpdate(doc1, update)
  })

  const awareness1Listener: AwarenessListener = ({ added, updated, removed }, origin) => {
    if (origin === "local") {
      const changedClients = added.concat(updated).concat(removed)
      const awarenessUpdate = encodeAwarenessUpdate(awareness1, changedClients)
      applyAwarenessUpdate(awareness2, awarenessUpdate, "remote")
    }
  }

  const awareness2Listener: AwarenessListener = ({ added, updated, removed }, origin) => {
    if (origin === "local") {
      const changedClients = added.concat(updated).concat(removed)
      const awarenessUpdate = encodeAwarenessUpdate(awareness2, changedClients)
      applyAwarenessUpdate(awareness1, awarenessUpdate, "remote")
    }
  }

  awareness1.on("update", awareness1Listener)
  awareness2.on("update", awareness2Listener)

  return () => {
    doc1.off("update", doc1Listener)
    doc2.off("update", doc2Listener)
    awareness1.off("update", awareness1Listener)
    awareness2.off("update", awareness2Listener)
  }
}

type AwarenessListener = (
  args: { added: number[]; updated: number[]; removed: number[] },
  origin: unknown,
) => void
