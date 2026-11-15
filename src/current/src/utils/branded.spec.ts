import { test } from "bun:test"

import type { Branded } from "./branded.ts"

type FirstId = Branded<string, "FirstId">
type SecondId = Branded<string, "SecondId">

test("branded values are strings, but strings and other brands are not interchangeable", () => {
  const firstId = "first" as FirstId
  const value: string = firstId
  // @ts-expect-error strings do not carry a brand.
  const unbranded: FirstId = "first"
  // @ts-expect-error values with different brands are incompatible.
  const secondId: SecondId = firstId

  void [value, unbranded, secondId]
})
