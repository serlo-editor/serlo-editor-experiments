import { expect, test } from "bun:test"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { string } from "./primitives.ts"
import { openRoot } from "./root.ts"
import { taggedObject } from "./tagged-object.ts"
import type { SnapshotOf } from "./types.ts"

describeWithStores("tagged objects", (getStore) => {
  test("stores fixed type alongside editable fields without block ID or renderer", () => {
    const schema = taggedObject({ type: "choice", fields: { response: string() } })
    const snapshot = { type: "choice", response: "First" } satisfies SnapshotOf<typeof schema>
    const value = openRoot(getStore(), schema, snapshot)
    expect(value.type satisfies "choice").toBe("choice")
    expect(value.snapshot()).toEqual(snapshot)
    value.field("response").set("Updated")
    expect(value.snapshot()).toEqual({ type: "choice", response: "Updated" })
    expect(value).not.toHaveProperty("id")

    // @ts-expect-error A tagged object rejects other literal types.
    const wrongType: SnapshotOf<typeof schema> = { type: "other", response: "First" }
    void wrongType
  })

  test("rejects invalid and unknown fields on import and wrong stored types on bind", () => {
    const schema = taggedObject({ type: "choice", fields: { response: string() } })
    for (const snapshot of [
      {},
      { response: "First" },
      { type: "other", response: "First" },
      { type: "choice" },
      { type: "choice", response: "First", extra: true },
    ]) {
      expect(() => openRoot(getStore(), schema, JSON.parse(JSON.stringify(snapshot)))).toThrow()
    }
    const store = getStore()
    const other = taggedObject({ type: "other", fields: { response: string() } })
    openRoot(store, other, { type: "other", response: "First" })
    expect(() => openRoot(store, schema, { type: "choice", response: "Ignored" })).toThrow(
      "Expected object type: choice.",
    )
  })
})

test("rejects reserved discriminator and empty types", () => {
  expect(() => {
    // @ts-expect-error Type is reserved for discriminator.
    taggedObject({ type: "choice", fields: { type: string() } })
  }).toThrow("Reserved object field: type.")
  expect(() => taggedObject({ type: "", fields: {} })).toThrow("Expected object type.")
})
