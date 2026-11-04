import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness"
import * as Y from "yjs"

import type { SyncBackend } from "./types"

/** Without a reply in this window, the room is assumed to have no other open tab. */
const peerReplyTimeoutMs = 300

/**
 * Offline backend: syncs all tabs (and connections within a tab) of the same origin via
 * `BroadcastChannel`. Nothing leaves the browser, and a room is gone once its last tab closes.
 */
export function createLocalBackend(): SyncBackend {
  return {
    connect(roomId) {
      const channel = new BroadcastChannel(`editor-sync:${roomId}`)
      const doc = new Y.Doc()
      const awareness = new Awareness(doc)
      // Explicit transport origin forwards local writes, but never echoes received updates.
      const remote = Symbol("broadcast-channel")
      const post = (message: Message) => channel.postMessage(message)
      let onFirstReply = () => {}

      channel.onmessage = ({ data }: MessageEvent<Message>) => {
        switch (data.type) {
          case "sync-request":
            post({ type: "sync-reply", update: Y.encodeStateAsUpdate(doc, data.stateVector) })
            post({ type: "awareness", update: encodeAwarenessUpdate(awareness, [doc.clientID]) })
            return
          case "sync-reply":
            Y.applyUpdate(doc, data.update, remote)
            onFirstReply()
            return
          case "update":
            Y.applyUpdate(doc, data.update, remote)
            return
          case "awareness":
            applyAwarenessUpdate(awareness, data.update, remote)
        }
      }

      const forwardDoc = (update: Uint8Array, origin: unknown) => {
        if (origin !== remote) post({ type: "update", update })
      }
      // Every peer listens on the channel itself, so only this peer's own presence is sent.
      const forwardAwareness: AwarenessListener = ({ added, updated, removed }, origin) => {
        const changed = [...added, ...updated, ...removed]
        if (origin === remote || !changed.includes(doc.clientID)) return
        post({ type: "awareness", update: encodeAwarenessUpdate(awareness, [doc.clientID]) })
      }
      doc.on("update", forwardDoc)
      awareness.on("update", forwardAwareness)

      const initialSync = new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, peerReplyTimeoutMs)
        onFirstReply = () => {
          clearTimeout(timer)
          resolve()
        }
      })
      post({ type: "sync-request", stateVector: Y.encodeStateVector(doc) })

      return {
        doc,
        awareness,
        synced: () => initialSync,
        disconnect() {
          removeAwarenessStates(awareness, [doc.clientID], "disconnect")
          doc.off("update", forwardDoc)
          awareness.off("update", forwardAwareness)
          channel.close()
          awareness.destroy()
          doc.destroy()
        },
      }
    },
  }
}

type Message =
  | { type: "sync-request"; stateVector: Uint8Array }
  | { type: "sync-reply"; update: Uint8Array }
  | { type: "update"; update: Uint8Array }
  | { type: "awareness"; update: Uint8Array }

type AwarenessListener = (
  changes: { added: number[]; updated: number[]; removed: number[] },
  origin: unknown,
) => void
