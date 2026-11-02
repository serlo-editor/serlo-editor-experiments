import { expect, test } from "bun:test"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { array } from "./array.ts"
import { createDocument } from "./document.ts"
import { string } from "./primitives.ts"

describeWithStores("array schemas", (getStore) => {
  test("creates, reads, maps, inserts, and removes children", () => {
    const { root } = createDocument(getStore(), array(string()), ["Ada", "Grace"])

    expect(root.length).toBe(2)
    expect(root.snapshot()).toEqual(["Ada", "Grace"])
    expect(root.children().map((child) => child.get())).toEqual(["Ada", "Grace"])
    expect(root.map((child, index) => `${index}: ${child.get()}`)).toEqual(["0: Ada", "1: Grace"])

    root.insert(1, "Lin")
    expect(root.length).toBe(3)
    expect(root.snapshot()).toEqual(["Ada", "Lin", "Grace"])

    root.remove(0)
    expect(root.length).toBe(2)
    expect(root.snapshot()).toEqual(["Lin", "Grace"])
  })
})
