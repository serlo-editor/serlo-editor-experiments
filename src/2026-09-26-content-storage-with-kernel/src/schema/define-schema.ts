import type { NodeKind, NodeRefs, NodeStore } from "../storage/types.ts"
import type { JSONValue } from "../utils/index.ts"
import type { Handle, Schema } from "./types.ts"

export function defineSchema<
  Snapshot extends JSONValue,
  BoundHandle extends Handle<Snapshot>,
  Kind extends NodeKind,
>(
  interpreter: SchemaInterpreter<Snapshot, BoundHandle, Kind>,
): Schema<Snapshot, BoundHandle, Kind> {
  return {
    create(store, snapshot) {
      return interpreter.create({ store }, snapshot)
    },

    bind(store, ref) {
      return interpreter.bind(bindContext(store), ref)
    },
  }
}

export interface SchemaInterpreter<
  Snapshot extends JSONValue,
  BoundHandle extends Handle<Snapshot>,
  Kind extends NodeKind,
> {
  create<Refs extends NodeRefs, Tx>(ctx: CreateContext<Refs, Tx>, snapshot: Snapshot): Refs[Kind]

  bind<Refs extends NodeRefs, Tx>(ctx: BindContext<Refs, Tx>, ref: Refs[Kind]): BoundHandle
}

function bindContext<Refs extends NodeRefs, Tx>(store: NodeStore<Refs, Tx>): BindContext<Refs, Tx> {
  return {
    store,

    bindChild<
      Snapshot extends JSONValue,
      BoundHandle extends Handle<Snapshot>,
      Kind extends NodeKind,
    >(schema: Schema<Snapshot, BoundHandle, Kind>, ref: Refs[NodeKind]) {
      // Storage erases child node kinds; trusted composition restores them.
      return schema.bind(store, ref as Refs[Kind])
    },
  }
}

export interface CreateContext<Refs extends NodeRefs, Tx> {
  readonly store: NodeStore<Refs, Tx>
}

export interface BindContext<Refs extends NodeRefs, Tx> extends CreateContext<Refs, Tx> {
  bindChild<
    Snapshot extends JSONValue,
    BoundHandle extends Handle<Snapshot>,
    Kind extends NodeKind,
  >(
    schema: Schema<Snapshot, BoundHandle, Kind>,
    ref: Refs[NodeKind],
  ): BoundHandle
}
