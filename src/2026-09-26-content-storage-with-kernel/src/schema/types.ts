import type {
  CellRef,
  NodeKind,
  NodeRefsByKind,
  NodeStore,
  Ref,
  RootRef,
} from "../storage/types.ts"
import type { JSONValue } from "../utils/index.ts"

export interface SnapshotHandle<Snapshot extends JSONValue> {
  snapshot(): Snapshot
}

export interface Schema<
  Snapshot extends JSONValue,
  Handle extends SnapshotHandle<Snapshot>,
  Kind extends NodeKind,
> {
  create<Cell extends Ref, Array extends Ref, Map extends Ref, Tx>(
    store: NodeStore<RefsFor<Cell, Array, Map>, Tx>,
    snapshot: Snapshot,
  ): SchemaRef<RefsFor<Cell, Array, Map>, Kind, Snapshot>

  bind<Cell extends Ref, Array extends Ref, Map extends Ref, Tx>(
    store: NodeStore<RefsFor<Cell, Array, Map>, Tx>,
    ref: NoInfer<SchemaRef<RefsFor<Cell, Array, Map>, Kind, Snapshot>> & RootRef,
  ): Handle
}

export type SchemaRef<
  Refs extends NodeRefsByKind,
  Kind extends NodeKind,
  Snapshot extends JSONValue,
> = Kind extends "cell" ? CellRef<Refs["cell"], Snapshot> : Refs[Kind]

// Infer each ref kind directly; indexed accesses alone cannot infer backend refs.
type RefsFor<Cell extends Ref, Array extends Ref, Map extends Ref> = {
  cell: Cell
  array: Array
  map: Map
}
