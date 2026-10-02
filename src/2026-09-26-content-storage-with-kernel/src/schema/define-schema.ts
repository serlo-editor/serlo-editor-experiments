import type { NodeKind, NodeRefs, NodeStore } from "../storage/types.ts"
import type { JSONValue } from "../utils/index.ts"
import type { Schema, SnapshotHandle } from "./types.ts"

export interface CreateContext<Refs extends NodeRefs, Tx> {
  readonly store: NodeStore<Refs, Tx>

  createChild<
    Snapshot extends JSONValue,
    Handle extends SnapshotHandle<Snapshot>,
    Kind extends NodeKind,
  >(
    schema: Schema<Snapshot, Handle, Kind>,
    snapshot: Snapshot,
  ): Refs[Kind]
}

export interface BindContext<Refs extends NodeRefs, Tx> extends CreateContext<Refs, Tx> {
  bindChild<
    Snapshot extends JSONValue,
    Handle extends SnapshotHandle<Snapshot>,
    Kind extends NodeKind,
  >(
    schema: Schema<Snapshot, Handle, Kind>,
    ref: Refs[NodeKind],
  ): Handle
}

export interface SchemaInterpreter<
  Snapshot extends JSONValue,
  Handle extends SnapshotHandle<Snapshot>,
  Kind extends NodeKind,
> {
  create<Refs extends NodeRefs, Tx>(ctx: CreateContext<Refs, Tx>, snapshot: Snapshot): Refs[Kind]

  bind<Refs extends NodeRefs, Tx>(ctx: BindContext<Refs, Tx>, ref: Refs[Kind]): Handle
}

const interpreters = new WeakMap<object, unknown>()

export function defineSchema<
  Snapshot extends JSONValue,
  Handle extends SnapshotHandle<Snapshot>,
  Kind extends NodeKind,
>(interpreter: SchemaInterpreter<Snapshot, Handle, Kind>): Schema<Snapshot, Handle, Kind> {
  const schema: Schema<Snapshot, Handle, Kind> = {
    create(store, snapshot) {
      return interpreter.create(createContext(store), snapshot)
    },

    bind(store, rootRef) {
      return interpreter.bind(bindContext(store), rootRef)
    },
  }

  interpreters.set(schema, interpreter)
  return schema
}

function createContext<Refs extends NodeRefs, Tx>(
  store: NodeStore<Refs, Tx>,
): CreateContext<Refs, Tx> {
  return {
    store,

    createChild(schema, snapshot) {
      return lookup(schema).create(createContext(store), snapshot)
    },
  }
}

function bindContext<Refs extends NodeRefs, Tx>(store: NodeStore<Refs, Tx>): BindContext<Refs, Tx> {
  return {
    ...createContext(store),

    bindChild<
      Snapshot extends JSONValue,
      Handle extends SnapshotHandle<Snapshot>,
      Kind extends NodeKind,
    >(schema: Schema<Snapshot, Handle, Kind>, ref: Refs[NodeKind]) {
      // Storage erases child node kinds; trusted composition restores them.
      return lookup(schema).bind(bindContext(store), ref as Refs[Kind])
    },
  }
}

function lookup<
  Snapshot extends JSONValue,
  Handle extends SnapshotHandle<Snapshot>,
  Kind extends NodeKind,
>(schema: Schema<Snapshot, Handle, Kind>): SchemaInterpreter<Snapshot, Handle, Kind> {
  const interpreter = interpreters.get(schema)

  if (!interpreter) {
    throw new TypeError("Schema must be created with defineSchema.")
  }

  // Factory registers each interpreter under its matching schema object.
  return interpreter as SchemaInterpreter<Snapshot, Handle, Kind>
}
