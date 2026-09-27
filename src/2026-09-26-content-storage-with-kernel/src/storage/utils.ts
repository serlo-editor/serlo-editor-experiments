export type StorableValue =
  | readonly unknown[]
  | { readonly [key: string]: unknown }
  | null
  | string
  | number
  | boolean

export type Update<Value extends StorableValue> = Value | ((previousValue: Value) => Value)

export function applyUpdate<Value extends StorableValue>(
  previousValue: Value,
  update: Update<Value>,
): Value {
  if (typeof update !== "function") return update
  return update(previousValue)
}
