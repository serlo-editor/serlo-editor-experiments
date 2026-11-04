import { createDocument, type Document } from "./schema/document"
import type { AnySchema, Schema, SnapshotOf, StoredValue, StoredValueOf } from "./schema/types"
import { type NodeKind, type NodeRefs, type NodeStore, ReadonlyNodeStore } from "./storage"
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

/** Follow source revisions without exposing writable schema values or rich-text editors. */
export function bindReadonlyDocument<
  Snapshot extends JSONValue,
  Root extends StoredValue<Snapshot>,
  Kind extends NodeKind,
>(
  source: {
    store: Pick<NodeStore, "subscribe" | "getRevision">
    document: Document<Snapshot, Root>
  },
  schema: Schema<Snapshot, Root, Kind>,
) {
  let revision = source.store.getRevision()
  let document = createDocument(new ReadonlyNodeStore(), schema, source.document.snapshot())
  return {
    store: source.store,
    get document() {
      const current = source.store.getRevision()
      if (revision !== current) {
        document = createDocument(new ReadonlyNodeStore(), schema, source.document.snapshot())
        revision = current
      }
      return document
    },
  }
}
