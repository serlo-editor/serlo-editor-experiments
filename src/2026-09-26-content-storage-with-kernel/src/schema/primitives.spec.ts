import assert from "node:assert/strict"
import test from "node:test"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { createDocument } from "./document.ts"
import { boolean, string } from "./primitives.ts"

describeWithStores("primitive schemas", (getStore) => {
  test("creates and edits string documents", () => {
    const document = createDocument(getStore(), string(), "Ada")

    assert.equal(document.root.get(), "Ada")
    assert.equal(document.root.snapshot(), "Ada")
    assert.equal(document.snapshot(), "Ada")

    document.root.set("Grace")

    assert.equal(document.root.get(), "Grace")
    assert.equal(document.snapshot(), "Grace")
  })

  test("creates and edits boolean documents", () => {
    const document = createDocument(getStore(), boolean(), false)

    assert.equal(document.root.get(), false)
    assert.equal(document.root.snapshot(), false)
    assert.equal(document.snapshot(), false)

    document.root.set(true)

    assert.equal(document.root.get(), true)
    assert.equal(document.snapshot(), true)
  })
})
