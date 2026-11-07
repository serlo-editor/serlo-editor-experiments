import { createDocument, type Document } from "./schema/document"
import type { AnySchema, Schema, SnapshotOf, StoredValue, StoredValueOf } from "./schema/types"
import { ReadonlyNodeStore, type NodeKind, type NodeRefs, type NodeStore } from "./storage"
import type { JSONValue } from "./utils"

/** Roles belong to worksheet composition, not storage or schema metadata. */
export type BoundDocument<S extends AnySchema> = {
  document: Document<SnapshotOf<S>, StoredValueOf<S>>
  store: Pick<NodeStore, "subscribe" | "getRevision">
}

/** Cache an immutable projection per source revision; subscriptions remain live. */
export function readOnlyDocument<S extends AnySchema>(
  source: BoundDocument<S>,
  schema: S,
): BoundDocument<S> {
  let revision = -1
  let projection: BoundDocument<S> | undefined
  return {
    store: {
      subscribe: (listener) => source.store.subscribe(listener),
      getRevision: () => source.store.getRevision(),
    },
    document: {
      get root() {
        return current().document.root
      },
      snapshot() {
        return current().document.snapshot()
      },
    },
  }

  function current() {
    const nextRevision = source.store.getRevision()
    if (!projection || revision !== nextRevision) {
      projection = bindDocument(new ReadonlyNodeStore(), schema, source.document.snapshot())
      revision = nextRevision
    }
    return projection
  }
}

export function bindDocument<
  Snapshot extends JSONValue,
  Root extends StoredValue<Snapshot>,
  Kind extends NodeKind,
  Refs extends NodeRefs,
>(store: NodeStore<Refs>, schema: Schema<Snapshot, Root, Kind>, snapshot: Snapshot) {
  return { store, document: createDocument(store, schema, snapshot) }
}
