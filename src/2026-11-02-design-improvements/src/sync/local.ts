import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from "y-protocols/awareness"
import * as Y from "yjs"

import type { SyncBackend } from "./types"

/** In-memory backend: connections in the same page share rooms, nothing leaves the browser. */
export function createLocalBackend(): SyncBackend {
  const rooms = new Map<string, Set<Peer>>()
  // Explicit transport origin forwards local writes, but never echoes relayed updates.
  const relay = Symbol("local-relay")

  return {
    connect(roomId) {
      const peers = rooms.get(roomId) ?? new Set<Peer>()
      rooms.set(roomId, peers)
      const doc = new Y.Doc()
      const awareness = new Awareness(doc)
      const self: Peer = { doc, awareness }

      for (const peer of peers) {
        Y.applyUpdate(doc, Y.encodeStateAsUpdate(peer.doc), relay)
        const clients = [...peer.awareness.getStates().keys()]
        applyAwarenessUpdate(awareness, encodeAwarenessUpdate(peer.awareness, clients), relay)
      }

      const forwardDoc = (update: Uint8Array, origin: unknown) => {
        if (origin === relay) return
        for (const peer of peers) if (peer !== self) Y.applyUpdate(peer.doc, update, relay)
      }
      const forwardAwareness: AwarenessListener = ({ added, updated, removed }, origin) => {
        if (origin === relay) return
        const update = encodeAwarenessUpdate(awareness, [...added, ...updated, ...removed])
        for (const peer of peers) {
          if (peer !== self) applyAwarenessUpdate(peer.awareness, update, relay)
        }
      }
      doc.on("update", forwardDoc)
      awareness.on("update", forwardAwareness)
      peers.add(self)

      return {
        doc,
        awareness,
        synced: () => Promise.resolve(),
        disconnect() {
          // Destroying awareness first forwards the removal of this peer's presence.
          awareness.destroy()
          doc.off("update", forwardDoc)
          awareness.off("update", forwardAwareness)
          peers.delete(self)
          if (peers.size === 0) rooms.delete(roomId)
          doc.destroy()
        },
      }
    },
  }
}

interface Peer {
  doc: Y.Doc
  awareness: Awareness
}

type AwarenessListener = (
  changes: { added: number[]; updated: number[]; removed: number[] },
  origin: unknown,
) => void
