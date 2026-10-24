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
  create<Refs extends NodeRefs>(store: NodeStore<Refs>, snapshot: Snapshot): Refs[Kind]

  bind<Refs extends NodeRefs>(store: NodeStore<Refs>, ref: Refs[Kind]): SchemaHandle
}

export type SnapshotOf<ChildSchema> =
  ChildSchema extends Schema<infer Snapshot, any, any> ? Snapshot : never

export type HandleOf<ChildSchema> =
  ChildSchema extends Schema<any, infer ChildHandle, any> ? ChildHandle : never
