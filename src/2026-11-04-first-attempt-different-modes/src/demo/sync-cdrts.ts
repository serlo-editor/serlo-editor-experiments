import { applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness"
import * as Y from "yjs"

import type { EditorSession } from "../editor"

/** Explicit transport origin forwards null-origin writes, but never echoes received updates. */
export function syncCDRTs(first: EditorSession, second: EditorSession) {
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
  Y.applyUpdate(second.doc, Y.encodeStateAsUpdate(first.doc), origin)
  Y.applyUpdate(first.doc, Y.encodeStateAsUpdate(second.doc), origin)
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

  first.doc.on("update", forwardFirst)
  second.doc.on("update", forwardSecond)
  first.awareness.on("update", presenceFirst)
  second.awareness.on("update", presenceSecond)
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
