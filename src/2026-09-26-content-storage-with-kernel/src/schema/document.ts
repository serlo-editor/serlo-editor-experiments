import type { NodeKind, NodeStore } from "../storage/types.ts"
import type { JSONValue } from "../utils/index.ts"
import type { Handle, Schema } from "./types.ts"

export interface Document<Snapshot extends JSONValue, Root extends Handle<Snapshot>> {
  readonly root: Root
  snapshot(): Snapshot
}

export function createDocument<
  Snapshot extends JSONValue,
  Root extends Handle<Snapshot>,
  Kind extends NodeKind,
  Store extends NodeStore<any, any>,
>(
  store: Store,
  schema: Schema<Snapshot, Root, Kind>,
  initialSnapshot: Snapshot,
): Document<Snapshot, Root> {
  const ref = schema.create(store, structuredClone(initialSnapshot))
  const root = schema.bind(store, store.attach(ref))

  return {
    root,
    snapshot() {
      return structuredClone(root.snapshot())
    },
  }
}
