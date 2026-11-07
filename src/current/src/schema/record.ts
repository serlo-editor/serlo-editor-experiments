import type { NodeKind } from "../storage/index.ts"
import { isObject } from "../utils/guard.ts"
import type { JSONValue } from "../utils/index.ts"
import type { Schema, StoredValue } from "./types.ts"

export interface StoredRecord<
  Item extends JSONValue,
  Child extends StoredValue<Item>,
> extends StoredValue<Readonly<Record<string, Item>>> {
  get(key: string): Child | undefined
  /** Replaces the child reference; previously bound children may become invalid. */
  set(key: string, snapshot: Item): void
  remove(key: string): void
}

/** Dynamic string keys sharing one child schema. */
export function record<
  Item extends JSONValue,
  Child extends StoredValue<Item>,
  ChildKind extends NodeKind,
>(
  childSchema: Schema<Item, Child, ChildKind>,
): Schema<Readonly<Record<string, Item>>, StoredRecord<Item, Child>, "map"> {
  return {
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
