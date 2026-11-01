import type { NodeKind } from "../storage/index.ts"
import type { JSONValue } from "../utils/index.ts"
import type { Schema, StoredValue } from "./types.ts"

export interface StoredArray<
  Item extends JSONValue,
  Child extends StoredValue<Item>,
> extends StoredValue<readonly Item[]> {
  readonly length: number
  children(): Child[]
  map<Result>(callback: (child: Child, index: number) => Result): Result[]
  remove(index: number): void
  insert(index: number, value: Item): void
}

export function array<
  Item extends JSONValue,
  Child extends StoredValue<Item>,
  ChildKind extends NodeKind,
>(
  childSchema: Schema<Item, Child, ChildKind>,
): Schema<readonly Item[], StoredArray<Item, Child>, "array"> {
  return {
    create(store, snapshots) {
      const refs = snapshots.map((snapshot) => childSchema.create(store, snapshot))
      return store.array.create(refs)
    },

    bind(store, ref) {
      const children = () =>
        store.array.get(ref).map((childRef) => childSchema.bind(store, childRef))

      return {
        get length() {
          return store.array.get(ref).length
        },

        children,

        map(callback) {
          return children().map((child, index) => callback(child, index))
        },

        remove(index) {
          store.transact((write) => write.array.remove(ref, index))
        },

        insert(index, snapshot) {
          const childRef = childSchema.create(store, snapshot)
          store.transact((write) => write.array.insert(ref, index, childRef))
        },

        snapshot() {
          return children().map((child) => child.snapshot())
        },
      }
    },
  }
}
