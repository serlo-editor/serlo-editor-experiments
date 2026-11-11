import type { NodeKind, NodeRefs, NodeStore } from "@editor/storage"
import type { JSONValue } from "@editor/utils"

/** Schema-bound access to stored data. Snapshot returns its current JSON representation. */
export interface StoredValue<Snapshot extends JSONValue = JSONValue> {
  snapshot(): Snapshot
}

export interface Schema<
  Snapshot extends JSONValue,
  BoundValue extends StoredValue<Snapshot>,
  Kind extends NodeKind,
> {
  /** Builds a detached snapshot without creating stored nodes. */
  defaultValue(): Snapshot

  create<Refs extends NodeRefs>(store: NodeStore<Refs>, snapshot: Snapshot): Refs[Kind]

  bind<Refs extends NodeRefs>(store: NodeStore<Refs>, ref: Refs[Kind]): BoundValue
}

export type AnySchema = Schema<any, any, NodeKind>

export type SnapshotOf<ChildSchema> =
  ChildSchema extends Schema<infer Snapshot, any, any> ? Snapshot : never

export type StoredValueOf<ChildSchema> =
  ChildSchema extends Schema<any, infer ChildValue, any> ? ChildValue : never
