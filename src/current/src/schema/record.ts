import { ReadonlyNodeStore } from "@editor/store/index.ts"

import { openRoot } from "./root.ts"
import type { AnySchema, Schema, SnapshotOf, StoredValue, StoredValueOf } from "./types.ts"

export interface StoredRecord<ChildSchema extends AnySchema> extends StoredValue<
  Readonly<Record<string, SnapshotOf<ChildSchema>>>
> {
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
      const refs = Object.fromEntries(
        Object.entries(snapshots).map(([key, snapshot]) => {
          return [key, childSchema.create(store, snapshot)]
        }),
      )
      return store.map.create(refs)
    },

    bind(store, ref) {
      return {
        getOrCreate(key, create) {
          const current = store.map.getField(ref, key)
          if (current !== undefined) return childSchema.bind(store, current)
          // TODO: Remove workaround when read-only stores can initialize missing records locally.
          if (store instanceof ReadonlyNodeStore) {
            return openRoot(new ReadonlyNodeStore(), childSchema, create())
          }
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
