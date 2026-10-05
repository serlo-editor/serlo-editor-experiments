import { test } from "bun:test"
import assert from "node:assert/strict"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { createDocument } from "./document.ts"
import { boolean, number, string } from "./primitives.ts"

describeWithStores("primitive schemas", (getStore) => {
  test("creates and edits string documents", () => {
    const { root } = createDocument(getStore(), string(), "Ada")

    assert.equal(root.get(), "Ada")
    assert.equal(root.snapshot(), "Ada")

    root.set("Grace")

    assert.equal(root.get(), "Grace")
    assert.equal(root.snapshot(), "Grace")
  })

  test("creates and edits boolean documents", () => {
    const { root } = createDocument(getStore(), boolean(), false)

    assert.equal(root.get(), false)
    assert.equal(root.snapshot(), false)

    root.set(true)

    assert.equal(root.get(), true)
    assert.equal(root.snapshot(), true)
  })

  test("creates and edits number documents", () => {
    const { root } = createDocument(getStore(), number(), 1)

    assert.equal(root.get(), 1)
    assert.equal(root.snapshot(), 1)

    root.set(2)

    assert.equal(root.get(), 2)
    assert.equal(root.snapshot(), 2)
  })
})
