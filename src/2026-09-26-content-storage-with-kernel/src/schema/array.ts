import type { NodeKind } from "../storage/types.ts"
import type { JSONValue } from "../utils/index.ts"
import type { Handle, Schema } from "./types.ts"

export interface ArrayHandle<Item extends JSONValue, Child extends Handle<Item>> extends Handle<
  readonly Item[]
> {
  at(index: number): Child
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
        at(index) {
          const childRef = store.array.get(ref)[index]
          if (childRef === undefined) {
            throw new RangeError("Array index absent.")
          }
          return childSchema.bind(store, childRef)
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
