import type { NodeKind, NodeRefs, NodeStore } from "../storage/types.ts"
import type { JSONValue } from "../utils/index.ts"

export interface Handle<Snapshot extends JSONValue> {
  snapshot(): Snapshot
}

export interface Schema<
  Snapshot extends JSONValue,
  SchemaHandle extends Handle<Snapshot>,
  Kind extends NodeKind,
> {
  create<Refs extends NodeRefs, Tx>(store: NodeStore<Refs, Tx>, snapshot: Snapshot): Refs[Kind]

  bind<Refs extends NodeRefs, Tx>(store: NodeStore<Refs, Tx>, ref: Refs[Kind]): SchemaHandle
}
