import type { JSONValue } from "./json-value.ts"

export type Guard<Value extends JSONValue> = (value: JSONValue) => value is Value

export function isBoolean(value: JSONValue): value is boolean {
  return typeof value === "boolean"
}

export function isString(value: JSONValue): value is string {
  return typeof value === "string"
}
