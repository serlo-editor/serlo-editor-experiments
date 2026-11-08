import { isObject } from "../utils/guard.ts"
import type { AnySchema, Schema, SnapshotOf, StoredValue, StoredValueOf } from "./types.ts"

export interface StoredRecord<ChildSchema extends AnySchema> extends StoredValue<
  Readonly<Record<string, SnapshotOf<ChildSchema>>>
> {
  get(key: string): StoredValueOf<ChildSchema> | undefined
  /** Replaces the child reference; previously bound children may become invalid. */
  set(key: string, snapshot: SnapshotOf<ChildSchema>): void
  remove(key: string): void
}

/** Dynamic string keys sharing one child schema. */
export function record<ChildSchema extends AnySchema>(
  childSchema: ChildSchema,
): Schema<Readonly<Record<string, SnapshotOf<ChildSchema>>>, StoredRecord<ChildSchema>, "map"> {
  return {
    defaultValue: () => ({}),

    create(store, snapshots) {
      if (!isObject(snapshots)) throw new TypeError("Expected record snapshot.")
      const refs = Object.fromEntries(
        Object.entries(snapshots).map(([key, snapshot]) => {
          rejectUndefined(key, snapshot)
          return [key, childSchema.create(store, snapshot)]
        }),
      )
      return store.map.create(refs)
    },

    bind(store, ref) {
      return {
        get(key) {
          const childRef = store.map.getField(ref, key)
          return childRef === undefined ? undefined : childSchema.bind(store, childRef)
        },

        set(key, snapshot) {
          rejectUndefined(key, snapshot)
          store.transact((write) => {
            const childRef = childSchema.create(store, snapshot)
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
              childSchema.bind(store, childRef).snapshot(),
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
