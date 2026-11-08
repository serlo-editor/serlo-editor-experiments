import type { NodeRefs, NodeStore } from "../storage/index.ts"
import type { AnySchema, SnapshotOf, StoredValueOf } from "./types.ts"

export function openRoot<RootSchema extends AnySchema, Refs extends NodeRefs>(
  store: NodeStore<Refs>,
  schema: RootSchema,
  initialSnapshot: SnapshotOf<RootSchema>,
): StoredValueOf<RootSchema> {
  const ref = store.root.getOrCreate(() => schema.create(store, structuredClone(initialSnapshot)))

  return schema.bind(store, ref)
}
