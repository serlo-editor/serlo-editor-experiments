import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { YjsNodeStore } from "../editor/storage"
import { syncCDRTs } from "./sync-cdrts"

export interface EditorSession {
  name: string
  color: string
  doc: Y.Doc
  awareness: Awareness
  store: YjsNodeStore
  destroy(): void
}

export interface DemoSessions {
  first: EditorSession
  second: EditorSession
  destroy(): void
}

/** A fresh document per editor; synchronization starts before either editor opens its root. */
export function createDemoSessions(): DemoSessions {
  const first = createSession("Editor 1", "#2563eb")
  const second = createSession("Editor 2", "#b45309")
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
}

function createSession(name: string, color: string) {
  const doc = new Y.Doc()
  const awareness = new Awareness(doc)
  awareness.setLocalStateField("user", { name, color })
  return {
    name,
    color,
    doc,
    awareness,
    store: new YjsNodeStore({ doc, awareness }),
    destroy() {
      doc.destroy()
    },
  }
}
