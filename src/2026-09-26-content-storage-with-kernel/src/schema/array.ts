import type { NodeKind } from "../storage/types.ts"
import type { JSONValue } from "../utils/index.ts"
import type { Handle, Schema } from "./types.ts"

export interface ArrayHandle<Item extends JSONValue, Child extends Handle<Item>> extends Handle<
  readonly Item[]
> {
  map<Result>(callback: (child: Child, index: number, array: Child[]) => Result): Result[]
  remove(index: number): void
  insert(index: number, value: Item): void
}

export function array<
  Item extends JSONValue,
  Child extends Handle<Item>,
  ChildKind extends NodeKind,
>(
  childSchema: Schema<Item, Child, ChildKind>,
): Schema<readonly Item[], ArrayHandle<Item, Child>, "array"> {
  return {
    create(store, snapshots) {
      const refs = snapshots.map((snapshot) => childSchema.create(store, snapshot))
      return store.array.create(refs)
    },

    bind(store, ref) {
      return {
        map(callback) {
          const children = store.array.get(ref).map((childRef) => childSchema.bind(store, childRef))
          return children.map(callback)
        },

        remove(index) {
          store.transact((tx) => {
            store.array.edit(ref, tx).remove(index)
          })
        },

        insert(index, snapshot) {
          const childRef = childSchema.create(store, snapshot)
          store.transact((tx) => {
            store.array.edit(ref, tx).insert(index, childRef)
          })
        },

        snapshot() {
          return store.array.get(ref).map((childRef) => {
            return childSchema.bind(store, childRef).snapshot()
          })
        },
      }
    },
  }
}
