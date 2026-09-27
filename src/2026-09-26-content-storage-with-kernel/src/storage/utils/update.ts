import type { JSONValue } from "./json-value"

export type Update<Value extends JSONValue> = Value | ((previousValue: Value) => Value)

export function applyUpdate<Value extends JSONValue>(
  previousValue: Value,
  update: Update<Value>,
): Value {
  if (typeof update !== "function") return update
  return update(previousValue)
}
