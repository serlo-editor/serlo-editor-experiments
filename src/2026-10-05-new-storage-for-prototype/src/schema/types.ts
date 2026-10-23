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
  /** Validate imports before allocating storage. Custom schemas may supply their own validator. */
  validate?(snapshot: unknown): void

  create<Refs extends NodeRefs, Tx>(store: NodeStore<Refs, Tx>, snapshot: Snapshot): Refs[Kind]

  bind<Refs extends NodeRefs, Tx>(store: NodeStore<Refs, Tx>, ref: Refs[Kind]): SchemaHandle
}

export type SnapshotOf<ChildSchema> =
  ChildSchema extends Schema<infer Snapshot, any, any> ? Snapshot : never

export type HandleOf<ChildSchema> =
  ChildSchema extends Schema<any, infer ChildHandle, any> ? ChildHandle : never
