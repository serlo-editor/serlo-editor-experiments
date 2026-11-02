import type { NodeKind } from "../storage/index.ts"
import { isObject } from "../utils/guard.ts"
import type { AnySchema, Schema, SnapshotOf, StoredValue, StoredValueOf } from "./types.ts"

type RecordSnapshot<ChildSchema extends AnySchema> = Readonly<
  Record<string, SnapshotOf<ChildSchema>>
>

export interface StoredRecord<ChildSchema extends AnySchema> extends StoredValue<
  RecordSnapshot<ChildSchema>
> {
  get(key: string): StoredValueOf<ChildSchema> | undefined
  /** Replaces the child reference; previously bound children may become invalid. */
  set(key: string, snapshot: SnapshotOf<ChildSchema>): void
  remove(key: string): void
}

/** Dynamic string keys; the resolver must remain compatible with stored entries. */
export function record<ChildSchema extends AnySchema>(
  schemaForKey: (key: string) => ChildSchema,
): Schema<RecordSnapshot<ChildSchema>, StoredRecord<ChildSchema>, "map"> {
  // Resolution erases the concrete schema while preserving its snapshot and stored-value unions.
  const schemaOf = (
    key: string,
  ): Schema<SnapshotOf<ChildSchema>, StoredValueOf<ChildSchema>, NodeKind> => schemaForKey(key)

  return {
    create(store, snapshots) {
      if (!isObject(snapshots)) throw new TypeError("Expected record snapshot.")
      const refs = Object.fromEntries(
        Object.entries(snapshots).map(([key, snapshot]) => {
          rejectUndefined(key, snapshot)
          return [key, schemaOf(key).create(store, snapshot)]
        }),
      )
      return store.map.create(refs)
    },

    bind(store, ref) {
      return {
        get(key) {
          const childRef = store.map.getField(ref, key)
          return childRef === undefined ? undefined : schemaOf(key).bind(store, childRef)
        },

        set(key, snapshot) {
          rejectUndefined(key, snapshot)
          store.transact((write) => {
            const childRef = schemaOf(key).create(store, snapshot)
            write.map.set(ref, key, childRef)
          })
        },

        remove(key) {
          store.transact((write) => write.map.remove(ref, key))
        },

        snapshot() {
          return Object.fromEntries(
            Object.entries(store.map.get(ref)).map(([key, childRef]) => [
              key,
              schemaOf(key).bind(store, childRef).snapshot(),
            ]),
          )
        },
      }
    },
  }
}

function rejectUndefined(key: string, snapshot: unknown): void {
  if (snapshot === undefined) throw new TypeError(`Undefined field: ${key}.`)
}
