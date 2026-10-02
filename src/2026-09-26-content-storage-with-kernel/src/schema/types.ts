import type { CellRef, NodeKind, NodeRefs, NodeStore, RootRef } from "../storage/types.ts"
import type { JSONValue } from "../utils/index.ts"

export interface SnapshotHandle<Snapshot extends JSONValue> {
  snapshot(): Snapshot
}

export interface Schema<
  Snapshot extends JSONValue,
  Handle extends SnapshotHandle<Snapshot>,
  Kind extends NodeKind,
> {
  create<Refs extends NodeRefs, Tx>(
    store: NodeStore<Refs, Tx>,
    snapshot: Snapshot,
  ): SchemaRef<Refs, Kind, Snapshot>

  bind<Refs extends NodeRefs, Tx>(
    store: NodeStore<Refs, Tx>,
    ref: NoInfer<SchemaRef<Refs, Kind, Snapshot>> & RootRef,
  ): Handle
}

export type SchemaRef<
  Refs extends NodeRefs,
  Kind extends NodeKind,
  Snapshot extends JSONValue,
> = Kind extends "cell" ? CellRef<Refs["cell"], Snapshot> : Refs[Kind]
