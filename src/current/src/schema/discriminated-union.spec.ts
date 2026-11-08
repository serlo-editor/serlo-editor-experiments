import { expect, test } from "bun:test"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { array } from "./array.ts"
import { discriminatedUnion } from "./discriminated-union.ts"
import { boolean, string } from "./primitives.ts"
import { openRoot } from "./root.ts"
import { taggedObject } from "./tagged-object.ts"
import type { SnapshotOf } from "./types.ts"

const choice = taggedObject({ type: "choice", fields: { response: string() } })
const toggle = taggedObject({ type: "toggle", fields: { enabled: boolean() } })

describeWithStores("discriminated unions", (getStore) => {
  test("creates and binds each member with its own fields and literal type", () => {
    const schema = discriminatedUnion([choice, toggle])
    const initial = [
      { type: "choice", response: "First" },
      { type: "toggle", enabled: false },
    ] satisfies SnapshotOf<typeof schema>[]
    const root = openRoot(getStore(), array(schema), initial)

    expect(root.snapshot()).toEqual(initial)
    const [first, second] = root.children()
    if (first?.type !== "choice" || second?.type !== "toggle") {
      throw new Error("Expected choice and toggle.")
    }
    expect(first.response.get() satisfies string).toBe("First")
    expect(second.enabled.get() satisfies boolean).toBe(false)
    first.response.set("Updated")
    second.enabled.set(true)
    root.insert(2, { type: "choice", response: "Another" })
    expect(root.snapshot()).toEqual([
      { type: "choice", response: "Updated" },
      { type: "toggle", enabled: true },
      { type: "choice", response: "Another" },
    ])

    // @ts-expect-error Unknown discriminators are excluded from snapshots.
    const wrongType: SnapshotOf<typeof schema> = { type: "other", response: "First" }
    // @ts-expect-error Each member requires its own fields.
    const wrongFields: SnapshotOf<typeof schema> = { type: "toggle", response: "First" }
    void [wrongType, wrongFields]
  })

  test("rejects missing, inherited, non-string, and unknown snapshot types", () => {
    const store = getStore()
    const schema = discriminatedUnion([choice, toggle])
    const invalidSnapshots: unknown[] = [
      null,
      [],
      {},
      { type: 1 },
      Object.create({ type: "choice" }),
    ]
    for (const snapshot of invalidSnapshots) {
      expect(() => {
        // @ts-expect-error Invalid snapshots must fail at runtime too.
        schema.create(store, snapshot)
      }).toThrow("Expected child type.")
    }
    expect(() => {
      // @ts-expect-error Unknown types must fail at runtime too.
      schema.create(store, { type: "other", response: "First" })
    }).toThrow("Unknown child type: other.")
  })

  test("selects from stored discriminator and rejects missing or unknown types", () => {
    const store = getStore()
    const schema = discriminatedUnion([choice, toggle])
    const ref = store.root.getOrCreate(() =>
      schema.create(store, { type: "choice", response: "First" }),
    )
    expect(schema.bind(store, ref).snapshot()).toEqual({ type: "choice", response: "First" })

    store.transact((write) => write.map.set(ref, "type", store.cell.create("other")))
    expect(() => schema.bind(store, ref)).toThrow("Unknown child type: other.")
    store.transact((write) => write.map.set(ref, "type", store.cell.create(1)))
    expect(() => schema.bind(store, ref)).toThrow("Expected child type.")
    store.transact((write) => write.map.remove(ref, "type"))
    expect(() => schema.bind(store, ref)).toThrow("Expected child type.")
  })
})

test("rejects empty definitions and duplicate types", () => {
  expect(() => discriminatedUnion([])).toThrow("Expected at least one typed definition.")
  expect(() => discriminatedUnion([choice, choice])).toThrow("Duplicate type: choice.")
})
