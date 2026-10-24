import * as Y from "yjs"

import { createSession } from "../editor"
import type { RootSnapshot } from "../editor/content"
import { syncCDRTs } from "./sync-cdrts"

export function createDemoSessions(snapshot: RootSnapshot) {
  const first = createSession({ name: "Editor 1", color: "#2563eb" }, snapshot)
  try {
    const second = createSession(
      { name: "Editor 2", color: "#b45309" },
      [],
      Y.encodeStateAsUpdate(first.doc),
    )
    const disconnect = syncCDRTs(first, second)
    return {
      first,
      second,
      destroy() {
        disconnect()
        first.destroy()
        second.destroy()
      },
    }
  } catch (error) {
    first.destroy()
    throw error
  }
}
