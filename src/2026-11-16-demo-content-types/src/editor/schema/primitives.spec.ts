import { expect, test } from "bun:test"

import { describeWithStores } from "@editor/test-utils"

import { boolean, number, string } from "./primitives.ts"
import { openRoot } from "./root.ts"

describeWithStores("primitive schemas", (getStore) => {
  test("creates and edits string documents", () => {
    const root = openRoot(getStore(), string(), "Ada")
    expect(string().defaultValue()).toBe("")

    expect(root.get()).toBe("Ada")

    root.set("Grace")

    expect(root.snapshot()).toBe("Grace")
  })

  test("creates and edits number documents", () => {
    const root = openRoot(getStore(), number(), 50)
    root.set(10)
    expect(root.snapshot()).toBe(10)
  })

  test("creates and edits boolean documents", () => {
    const root = openRoot(getStore(), boolean(), false)
    expect(boolean().defaultValue()).toBe(false)

    expect(root.get()).toBe(false)

    root.set(true)

    expect(root.snapshot()).toBe(true)
  })
})
