import { createDocument, type Document } from "./schema/document"
import type { AnySchema, Schema, SnapshotOf, StoredValue, StoredValueOf } from "./schema/types"
import { type NodeKind, type NodeRefs, type NodeStore } from "./storage"
import type { JSONValue } from "./utils"

/** Roles belong to worksheet composition, not storage or schema metadata. */
export type BoundDocument<S extends AnySchema> = {
  document: Document<SnapshotOf<S>, StoredValueOf<S>>
  store: Pick<NodeStore, "subscribe" | "getRevision">
}

export function bindDocument<
  Snapshot extends JSONValue,
  Root extends StoredValue<Snapshot>,
  Kind extends NodeKind,
  Refs extends NodeRefs,
>(store: NodeStore<Refs>, schema: Schema<Snapshot, Root, Kind>, snapshot: Snapshot) {
  return { store, document: createDocument(store, schema, snapshot) }
}
