import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness"
import * as Y from "yjs"

interface Peer {
  doc: Y.Doc
  awareness: Awareness
}

export function syncCDRTs(first: Peer, second: Peer) {
  const origin = Symbol("demo sync")
  const forwardToSecond = (update: Uint8Array, source: unknown) => {
    if (source !== origin) Y.applyUpdate(second.doc, update, origin)
  }
  const forwardToFirst = (update: Uint8Array, source: unknown) => {
    if (source !== origin) Y.applyUpdate(first.doc, update, origin)
  }
  first.doc.on("update", forwardToSecond)
  second.doc.on("update", forwardToFirst)
  Y.applyUpdate(second.doc, Y.encodeStateAsUpdate(first.doc), origin)
  Y.applyUpdate(first.doc, Y.encodeStateAsUpdate(second.doc), origin)

  const awarenessToSecond = () => forwardAwareness(first, second, origin)
  const awarenessToFirst = () => forwardAwareness(second, first, origin)
  const onFirstAwareness: AwarenessListener = (_, source) => {
    if (source !== origin) awarenessToSecond()
  }
  const onSecondAwareness: AwarenessListener = (_, source) => {
    if (source !== origin) awarenessToFirst()
  }
  first.awareness.on("update", onFirstAwareness)
  second.awareness.on("update", onSecondAwareness)
  awarenessToSecond()
  awarenessToFirst()

  return () => {
    first.doc.off("update", forwardToSecond)
    second.doc.off("update", forwardToFirst)
    first.awareness.off("update", onFirstAwareness)
    second.awareness.off("update", onSecondAwareness)
  }
}

type AwarenessListener = (
  change: { added: number[]; updated: number[]; removed: number[] },
  origin: unknown,
) => void

function forwardAwareness(source: Peer, target: Peer, origin: symbol) {
  // Include tombstones so cursor removals propagate as well as live states.
  applyAwarenessUpdate(
    target.awareness,
    encodeAwarenessUpdate(source.awareness, [...source.awareness.meta.keys()]),
    origin,
  )
}
