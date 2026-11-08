import type { NodeKind, NodeRefs, NodeStore } from "../storage/index.ts"
import type { JSONValue } from "../utils/index.ts"
import type { Schema, StoredValue } from "./types.ts"

export function openRoot<
  Snapshot extends JSONValue,
  Root extends StoredValue<Snapshot>,
  Kind extends NodeKind,
  Refs extends NodeRefs,
>(store: NodeStore<Refs>, schema: Schema<Snapshot, Root, Kind>, initialSnapshot: Snapshot): Root {
  const ref = store.root.getOrCreate(() => schema.create(store, structuredClone(initialSnapshot)))

  return schema.bind(store, ref)
}
