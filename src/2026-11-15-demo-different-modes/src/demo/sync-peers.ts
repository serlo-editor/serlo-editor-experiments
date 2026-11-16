import { applyAwarenessUpdate, encodeAwarenessUpdate, type Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

/** Forward document edits and cursor presence without echoing received updates. */
export function syncPeers(
  first: { doc: Y.Doc; awareness: Awareness },
  second: { doc: Y.Doc; awareness: Awareness },
) {
  const origin = Symbol("demo-transport")
  const forwardFirst = (update: Uint8Array, source: unknown) => {
    if (source !== origin) Y.applyUpdate(second.doc, update, origin)
  }
  const forwardSecond = (update: Uint8Array, source: unknown) => {
    if (source !== origin) Y.applyUpdate(first.doc, update, origin)
  }
  const presenceFirst: AwarenessListener = ({ added, updated, removed }, source) => {
    if (source !== origin)
      applyAwarenessUpdate(
        second.awareness,
        encodeAwarenessUpdate(first.awareness, [...added, ...updated, ...removed]),
        origin,
      )
  }
  const presenceSecond: AwarenessListener = ({ added, updated, removed }, source) => {
    if (source !== origin)
      applyAwarenessUpdate(
        first.awareness,
        encodeAwarenessUpdate(second.awareness, [...added, ...updated, ...removed]),
        origin,
      )
  }

  first.doc.on("update", forwardFirst)
  second.doc.on("update", forwardSecond)
  first.awareness.on("update", presenceFirst)
  second.awareness.on("update", presenceSecond)
  applyAwarenessUpdate(
    second.awareness,
    encodeAwarenessUpdate(first.awareness, [...first.awareness.getStates().keys()]),
    origin,
  )
  applyAwarenessUpdate(
    first.awareness,
    encodeAwarenessUpdate(second.awareness, [...second.awareness.getStates().keys()]),
    origin,
  )
  return () => {
    first.doc.off("update", forwardFirst)
    second.doc.off("update", forwardSecond)
    first.awareness.off("update", presenceFirst)
    second.awareness.off("update", presenceSecond)
  }
}

type AwarenessListener = (
  changes: { added: number[]; updated: number[]; removed: number[] },
  origin: unknown,
) => void
