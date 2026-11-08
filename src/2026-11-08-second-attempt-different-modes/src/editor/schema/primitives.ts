import { isBoolean, isString } from "../utils/index.ts"
import type { Guard, Primitive } from "../utils/index.ts"
import type { Schema, StoredValue } from "./types.ts"

export function string() {
  return primitive("string", isString, "")
}

export function boolean() {
  return primitive("boolean", isBoolean, false)
}

interface StoredPrimitive<Value extends Primitive> extends StoredValue<Value> {
  get(): Value
  set(value: Value): void
}

function primitive<Value extends Primitive>(
  expected: string,
  isValue: Guard<Value>,
  defaultValue: Value,
): Schema<Value, StoredPrimitive<Value>, "cell"> {
  return {
    defaultValue: () => defaultValue,

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
          store.transact((write) => write.cell.set(ref, value))
        },
      }
    },
  }
}
