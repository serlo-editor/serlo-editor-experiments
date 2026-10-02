import type { NodeKind } from "../storage/types.ts"
import type { JSONValue } from "../utils/index.ts"
import { defineSchema } from "./define-schema.ts"
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
  return defineSchema<readonly Item[], ArrayHandle<Item, Child>, "array">({
    create(ctx, snapshots) {
      const refs = snapshots.map((snapshot) => childSchema.create(ctx.store, snapshot))
      return ctx.store.array.create(refs)
    },

    bind(ctx, ref) {
      return {
        at(index) {
          const childRef = ctx.store.array.get(ref)[index]
          if (childRef === undefined) {
            throw new RangeError("Array index absent.")
          }
          return ctx.bindChild(childSchema, childRef)
        },

        insert(index, snapshot) {
          const childRef = childSchema.create(ctx.store, snapshot)
          ctx.store.transact((tx) => {
            ctx.store.array.edit(ref, tx).insert(index, childRef)
          })
        },

        snapshot() {
          return ctx.store.array.get(ref).map((childRef) => {
            return ctx.bindChild(childSchema, childRef).snapshot()
          })
        },
      }
    },
  })
}
