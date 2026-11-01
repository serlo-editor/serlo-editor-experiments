import type { NodeKind, NodeRefs, NodeStore } from "../storage/index.ts"
import type { JSONValue } from "../utils/index.ts"
import type { Schema, StoredValue } from "./types.ts"

export interface Document<Snapshot extends JSONValue, Root extends StoredValue<Snapshot>> {
  readonly root: Root
  snapshot(): Snapshot
}

export function createDocument<
  Snapshot extends JSONValue,
  Root extends StoredValue<Snapshot>,
  Kind extends NodeKind,
  Refs extends NodeRefs,
>(
  store: NodeStore<Refs>,
  schema: Schema<Snapshot, Root, Kind>,
  initialSnapshot: Snapshot,
): Document<Snapshot, Root> {
  const ref = store.root.getOrCreate(() => schema.create(store, structuredClone(initialSnapshot)))

  return {
    get root() {
      return schema.bind(store, ref)
    },
    snapshot() {
      return structuredClone(this.root.snapshot())
    },
  }
}
