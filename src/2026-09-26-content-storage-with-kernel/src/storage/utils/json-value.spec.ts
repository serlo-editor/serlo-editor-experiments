import test from "node:test"

import type { JSONValue } from "./json-value"

test("scalars are of type `JSONValue`", () => {
  const values = [null, false, 42, "text"] satisfies JSONValue[]

  void values
})

test("arrays and objects are of type `JSONValue`", () => {
  const values = [
    ["nested", 42] as const,
    { readonly: true, nested: ["value"] },
  ] satisfies JSONValue[]

  void values
})

test("`undefined` is not a `JSONValue`", () => {
  // @ts-expect-error undefined cannot be stored.
  const undefinedValue: JSONValue = undefined

  void undefinedValue
})

test("functions are not JSONValue", () => {
  // @ts-expect-error functions cannot be stored.
  const functionValue: JSONValue = () => undefined

  void functionValue
})
