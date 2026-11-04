import YProvider from "y-partyserver/provider"
import * as Y from "yjs"

import type { SyncBackend } from "./types"

/** Native Yjs backend: our Cloudflare worker in `server/`, one Durable Object per room. */
export function createPartyServerBackend(host: string): SyncBackend {
  return {
    connect(roomId) {
      const doc = new Y.Doc()
      // Tabs already sync through the server; y-partyserver's BroadcastChannel would duplicate it.
      const provider = new YProvider(host, roomId, doc, { party: "document", disableBc: true })

      return {
        doc,
        awareness: provider.awareness,
        synced: () =>
          new Promise((resolve) => {
            if (provider.synced) return resolve()
            const onSynced = (synced: boolean) => {
              if (!synced) return
              provider.off("synced", onSynced)
              resolve()
            }
            provider.on("synced", onSynced)
          }),
        disconnect() {
          provider.destroy()
          // The provider leaves its awareness (and its renewal timer) running.
          provider.awareness.destroy()
          doc.destroy()
        },
      }
    },
  }
}
