import type { NodeKind, NodeRefs, NodeStore } from "../storage/types.ts"
import type { JSONValue } from "../utils/index.ts"
import type { Handle, Schema } from "./types.ts"

export function bindChild<
  Refs extends NodeRefs,
  Tx,
  Snapshot extends JSONValue,
  BoundHandle extends Handle<Snapshot>,
  Kind extends NodeKind,
>(
  store: NodeStore<Refs, Tx>,
  schema: Schema<Snapshot, BoundHandle, Kind>,
  ref: Refs[NodeKind],
): BoundHandle {
  // Storage erases child node kinds; trusted composition restores them.
  return schema.bind(store, ref as Refs[Kind])
}
