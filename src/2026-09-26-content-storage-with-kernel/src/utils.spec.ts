import test from "node:test"

import type { Branded } from "./utils.ts"

declare const firstBrand: unique symbol
declare const secondBrand: unique symbol

type FirstId = Branded<string, typeof firstBrand>
type SecondId = Branded<string, typeof secondBrand>

test("branded values retain their underlying type", () => {
  const firstId = "first" as FirstId
  const value: string = firstId

  void value
})

test("unbranded values are not branded", () => {
  // @ts-expect-error strings do not carry a brand.
  const firstId: FirstId = "first"

  void firstId
})

test("different brands are not interchangeable", () => {
  const firstId = "first" as FirstId
  // @ts-expect-error values with different brands are incompatible.
  const secondId: SecondId = firstId

  void secondId
})
