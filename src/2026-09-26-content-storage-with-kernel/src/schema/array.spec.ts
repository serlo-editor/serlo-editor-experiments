import assert from "node:assert/strict"
import test from "node:test"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { array } from "./array.ts"
import { createDocument } from "./document.ts"
import { string } from "./primitives.ts"

describeWithStores("array schemas", (getStore) => {
  test("creates, reads, maps, inserts, and removes children", () => {
    const { root } = createDocument(getStore(), array(string()), ["Ada", "Grace"])

    assert.equal(root.length, 2)
    assert.deepEqual(root.snapshot(), ["Ada", "Grace"])
    assert.deepEqual(
      root.children().map((child) => child.get()),
      ["Ada", "Grace"],
    )
    assert.deepEqual(
      root.map((child, index) => `${index}: ${child.get()}`),
      ["0: Ada", "1: Grace"],
    )

    root.insert(1, "Lin")
    assert.equal(root.length, 3)
    assert.deepEqual(root.snapshot(), ["Ada", "Lin", "Grace"])

    root.remove(0)
    assert.equal(root.length, 2)
    assert.deepEqual(root.snapshot(), ["Lin", "Grace"])
  })
})
