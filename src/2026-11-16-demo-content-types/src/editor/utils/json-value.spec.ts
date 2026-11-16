import { test } from "bun:test"

import type { JSONValue } from "./index.ts"

test("JSONValue accepts scalars and nested collections, but not undefined or functions", () => {
  const values = [
    null,
    false,
    42,
    "text",
    ["nested", 42] as const,
    { readonly: true, nested: ["value"] },
  ] satisfies JSONValue[]
  // @ts-expect-error undefined cannot be stored.
  const undefinedValue: JSONValue = undefined
  // @ts-expect-error functions cannot be stored.
  const functionValue: JSONValue = () => undefined

  void [values, undefinedValue, functionValue]
})
