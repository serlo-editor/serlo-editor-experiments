import { expect, test } from "bun:test"

import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness"
import * as Y from "yjs"

import { createEditorSpecificAwareness } from "./editor-awareness.ts"

// Presence transport is shared; only cursor reads/writes are scoped to an editor.
test("scoped awareness filters peers, forwards events, and preserves unrelated presence", () => {
  const localDoc = new Y.Doc()
  const remoteDoc = new Y.Doc()
  const local = new Awareness(localDoc)
  const remote = new Awareness(remoteDoc)
  try {
    const first = createEditorSpecificAwareness("rich-text:first", local)
    const second = createEditorSpecificAwareness("rich-text:second", local)
    local.setLocalStateField("user", { name: "Local" })
    expect(first.getLocalState()).toBeNull()
    expect(second.getLocalState()).toBeNull()
    expect(first.clientID).toBe(local.clientID)

    first.setLocalStateField("cursor", { anchor: 1, head: 1 })
    expect(first.getLocalState()).toEqual({
      user: { name: "Local" },
      editorId: "rich-text:first",
      cursor: { anchor: 1, head: 1 },
    })
    expect(second.getLocalState()).toBeNull()

    let events = 0
    const listener = () => {
      events++
    }
    first.on("change", listener)
    remote.setLocalState({ editorId: "rich-text:first", user: { name: "Remote" } })
    applyAwarenessUpdate(local, encodeAwarenessUpdate(remote, [remote.clientID]), "remote")
    expect(events).toBe(1)
    expect([...first.getStates().keys()]).toEqual([local.clientID, remote.clientID])
    expect(second.getStates().size).toBe(0)

    first.off("change", listener)
    remote.setLocalState({ editorId: "rich-text:second", user: { name: "Remote" } })
    applyAwarenessUpdate(local, encodeAwarenessUpdate(remote, [remote.clientID]), "remote")
    expect(events).toBe(1)
    expect([...first.getStates().keys()]).toEqual([local.clientID])
    expect([...second.getStates().keys()]).toEqual([remote.clientID])

    second.setLocalStateField("cursor", { anchor: 2, head: 2 })
    first.setLocalStateField("cursor", null)
    expect(local.getLocalState()).toEqual({
      user: { name: "Local" },
      editorId: "rich-text:second",
      cursor: { anchor: 2, head: 2 },
    })
    second.setLocalStateField("cursor", null)
    expect(local.getLocalState()?.cursor).toBeNull()

    local.setLocalState(null)
    expect(first.getLocalState()).toBeNull()
    first.setLocalStateField("cursor", null)
    expect(local.getLocalState()).toBeNull()
  } finally {
    local.destroy()
    remote.destroy()
    localDoc.destroy()
    remoteDoc.destroy()
  }
})
