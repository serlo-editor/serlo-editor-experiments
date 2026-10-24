import * as Y from "yjs"

import { createSession, importContent } from "../editor"
import { syncCDRTs } from "./sync-cdrts"

export function createDemoSessions(content: unknown) {
  const snapshot = importContent(content)
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
