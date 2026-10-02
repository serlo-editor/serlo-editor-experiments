import type { NodeKind, NodeRefs, NodeStore, RootRef } from "../storage/types.ts"
import type { JSONValue } from "../utils/index.ts"

export interface SnapshotHandle<Snapshot extends JSONValue> {
  snapshot(): Snapshot
}

export interface Schema<
  Snapshot extends JSONValue,
  Handle extends SnapshotHandle<Snapshot>,
  Kind extends NodeKind,
> {
  create<Refs extends NodeRefs, Tx>(store: NodeStore<Refs, Tx>, snapshot: Snapshot): Refs[Kind]

  bind<Refs extends NodeRefs, Tx>(
    store: NodeStore<Refs, Tx>,
    ref: NoInfer<Refs[Kind]> & RootRef,
  ): Handle
}
