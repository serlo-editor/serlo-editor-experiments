import type { Awareness } from "prosekit/extensions/yjs"
import type * as Y from "yjs"

/** Transport that keeps the Yjs docs and presence of all peers in a room in sync. */
export interface SyncBackend {
  connect(roomId: string): SyncConnection
}

/** Owns its doc and awareness; both are destroyed on disconnect. */
export interface SyncConnection {
  readonly doc: Y.Doc
  readonly awareness: Awareness
  /** Resolves once remote state is loaded and all local changes are acknowledged. */
  synced(): Promise<void>
  disconnect(): void
}
