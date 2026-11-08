import { expect, test } from "bun:test"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { boolean, number, string } from "./primitives.ts"
import { createRoot } from "./root.ts"

describeWithStores("primitive schemas", (getStore) => {
  test("creates and edits string documents", () => {
    const root = createRoot(getStore(), string(), "Ada")

    expect(root.get()).toBe("Ada")
    expect(root.snapshot()).toBe("Ada")

    root.set("Grace")

    expect(root.get()).toBe("Grace")
    expect(root.snapshot()).toBe("Grace")
  })

  test("creates and edits boolean documents", () => {
    const root = createRoot(getStore(), boolean(), false)

    expect(root.get()).toBe(false)
    expect(root.snapshot()).toBe(false)

    root.set(true)

    expect(root.get()).toBe(true)
    expect(root.snapshot()).toBe(true)
  })

  test("creates and edits number documents", () => {
    const root = createRoot(getStore(), number(), 1)

    expect(root.get()).toBe(1)
    expect(root.snapshot()).toBe(1)

    root.set(2)

    expect(root.get()).toBe(2)
    expect(root.snapshot()).toBe(2)
  })
})
