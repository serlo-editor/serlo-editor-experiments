import { isObject } from "@editor/utils"

import type { AnySchema, Schema, SnapshotOf, StoredValue, StoredValueOf } from "./types.ts"

export interface StoredRecord<ChildSchema extends AnySchema> extends StoredValue<
  Readonly<Record<string, SnapshotOf<ChildSchema>>>
> {
  get(key: string): StoredValueOf<ChildSchema> | undefined
  getOrCreate(key: string, create: () => SnapshotOf<ChildSchema>): StoredValueOf<ChildSchema>
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

        getOrCreate(key, create) {
          const current = store.map.getField(ref, key)
          if (current !== undefined) return childSchema.bind(store, current)
          return store.transact((write) => {
            const snapshot = create()
            const childRef = childSchema.create(store, snapshot)
            write.map.set(ref, key, childRef)
            return childSchema.bind(store, childRef)
          })
        },

        set(key, snapshot) {
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
