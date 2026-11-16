import { expect, test } from "bun:test"

import { describeWithStores } from "@editor/test-utils"

import { string } from "./primitives.ts"
import { openRoot } from "./root.ts"
import { isTaggedObject, taggedObject } from "./tagged-object.ts"
import type { SnapshotOf } from "./types.ts"

describeWithStores("tagged objects", (getStore) => {
  test("stores fixed type alongside editable fields", () => {
    const schema = taggedObject({ type: "choice", fields: { response: string() } })
    expect(schema.defaultValue() satisfies SnapshotOf<typeof schema>).toEqual({
      type: "choice",
      response: "",
    })
    const snapshot = { type: "choice", response: "First" } satisfies SnapshotOf<typeof schema>
    const value = openRoot(getStore(), schema, snapshot)
    expect(value.type satisfies "choice").toBe("choice")
    expect(value.snapshot()).toEqual(snapshot)
    value.response.set("Updated")
    expect(value.snapshot()).toEqual({ type: "choice", response: "Updated" })
    expect(isTaggedObject(schema, value)).toBe(true)
    expect(isTaggedObject(taggedObject({ type: "toggle", fields: {} }), value)).toBe(false)
  })
})

test("rejects reserved discriminator and empty types", () => {
  expect(() => taggedObject({ type: "", fields: {} })).toThrow("Expected object type.")
})
