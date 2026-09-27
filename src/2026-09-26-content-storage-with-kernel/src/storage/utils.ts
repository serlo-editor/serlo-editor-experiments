export type Update<Value> = Value | ((previousValue: Value) => Value)

export function applyUpdate<Value>(previousValue: Value, update: Update<Value>): Value {
  if (typeof update !== "function") return update
  return (update as (previousValue: Value) => Value)(previousValue)
}
