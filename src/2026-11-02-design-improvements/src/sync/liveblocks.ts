import { createClient } from "@liveblocks/client"
import { LiveblocksYjsProvider } from "@liveblocks/yjs"
import type { Awareness } from "prosekit/extensions/yjs"
import * as Y from "yjs"

import type { SyncBackend } from "./types"

/** Hosted backend for demos. Rooms are created on first connect and persisted by Liveblocks. */
export function createLiveblocksBackend(publicApiKey: string): SyncBackend {
  return {
    connect(roomId) {
      // One client per connection, so peers in the same tab keep separate presences.
      const client = createClient({ publicApiKey })
      const { room, leave } = client.enterRoom(roomId)
      const doc = new Y.Doc()
      const provider = new LiveblocksYjsProvider(room, doc)

      return {
        doc,
        // Implements the y-protocols API at runtime, but its types lack `clientID` (y-prosemirror
        // reads the doc's) and use `Observable<unknown>` instead of `Observable<string>`.
        awareness: provider.awareness as unknown as Awareness,
        synced: () =>
          new Promise((resolve) => {
            if (provider.getStatus() === "synchronized") return resolve()
            const onStatus = (status: string) => {
              if (status !== "synchronized") return
              provider.off("status", onStatus)
              resolve()
            }
            provider.on("status", onStatus)
          }),
        disconnect() {
          provider.destroy()
          leave()
          doc.destroy()
        },
      }
    },
  }
}
