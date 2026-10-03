import type { NodeKind, NodeRefs, NodeStore } from "../storage/types.ts"
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
  Refs extends NodeRefs,
  Tx,
>(
  store: NodeStore<Refs, Tx>,
  schema: Schema<Snapshot, Root, Kind>,
  initialSnapshot: Snapshot,
): Document<Snapshot, Root> {
  const ref = store.attach(schema.create(store, structuredClone(initialSnapshot)))

  return {
    get root() {
      return schema.bind(store, ref)
    },
    snapshot() {
      return structuredClone(this.root.snapshot())
    },
  }
}
