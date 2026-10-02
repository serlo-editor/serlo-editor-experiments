import type { JSONValue } from "../utils/index.ts"
import type { Handle, Schema } from "./types.ts"

export function string(): Schema<string, StringHandle, "cell"> {
  return primitive("string", (value): value is string => typeof value === "string")
}

type StringHandle = PrimitiveHandle<string>

function primitive<Value extends Primitive>(
  expected: string,
  isValue: PrimitiveGuard<Value>,
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

type Primitive = null | boolean | number | string
type PrimitiveGuard<Value extends Primitive> = (value: JSONValue) => value is Value
