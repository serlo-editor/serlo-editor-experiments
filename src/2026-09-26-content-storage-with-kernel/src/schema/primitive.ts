import { isString } from "../utils/guard.ts"
import type { Guard } from "../utils/guard.ts"
import type { Primitive } from "../utils/index.ts"
import type { Handle, Schema } from "./types.ts"

export type { Guard } from "../utils/guard.ts"

export function string() {
  return primitive("string", isString)
}

function primitive<Value extends Primitive>(
  expected: string,
  isValue: Guard<Value>,
): Schema<Value, PrimitiveHandle<Value>, "cell"> {
  return {
    create(store, snapshot) {
      return store.cell.create(snapshot)
    },

    bind(store, ref) {
      const read = (): Value => {
        const value = store.cell.get(ref)
        if (!isValue(value)) {
          throw new TypeError(`Expected ${expected} cell.`)
        }
        return value
      }

      return {
        get: read,
        snapshot: read,
        set(value) {
          store.transact((tx) => {
            store.cell.edit(ref, tx).set(value)
          })
        },
      }
    },
  }
}

interface PrimitiveHandle<Value extends Primitive> extends Handle<Value> {
  get(): Value
  set(value: Value): void
}
