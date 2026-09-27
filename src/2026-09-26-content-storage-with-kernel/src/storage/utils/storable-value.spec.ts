import test from "node:test"

import type { StorableValue } from "./storable-value.ts"

test("scalars are of type `StorableValue`", () => {
  const values = [null, false, 42, "text"] satisfies StorableValue[]

  void values
})

test("arrays and objects are of type `StorableValue`", () => {
  const values = [
    ["nested", 42] as const,
    { readonly: true, nested: ["value"] },
  ] satisfies StorableValue[]

  void values
})

test("`undefined` is not a `StorableValue`", () => {
  // @ts-expect-error undefined cannot be stored.
  const undefinedValue: StorableValue = undefined

  void undefinedValue
})

test("functions are not StorableValue", () => {
  // @ts-expect-error functions cannot be stored.
  const functionValue: StorableValue = () => undefined

  void functionValue
})
