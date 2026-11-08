import { expect, test } from "bun:test"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { array } from "./array.ts"
import { boolean, object, string } from "./index.ts"
import { openRoot } from "./root.ts"
import type { SnapshotOf } from "./types.ts"

describeWithStores("object schemas", (getStore) => {
  test("reads typed fields and snapshots child edits", () => {
    const initial = {
      name: "Ada",
      active: false,
      tags: ["math"],
      profile: { bio: "Hello" },
    }
    const root = openRoot(
      getStore(),
      object({
        name: string(),
        active: boolean(),
        tags: array(string()),
        profile: object({ bio: string() }),
      }),
      initial,
    )

    expect(root.snapshot()).toEqual(initial)
    expect(root.field("name").get() satisfies string).toBe("Ada")
    expect(root.field("active").get() satisfies boolean).toBe(false)

    root.field("name").set("Grace")
    root.field("active").set(true)
    root.field("tags").insert(1, "code")
    root.field("profile").field("bio").set("Updated")

    expect(root.snapshot()).toEqual({
      name: "Grace",
      active: true,
      tags: ["math", "code"],
      profile: { bio: "Updated" },
    })

    // @ts-expect-error Object stored values expose field(), not get().
    expect(root.get).toBe(undefined)
    // @ts-expect-error Fields are edited through child stored values, not replaced.
    expect(root.set).toBe(undefined)
    expect(() => {
      // @ts-expect-error Unknown fields are rejected.
      root.field("missing")
    }).toThrow()
  })

  test("rejects missing and explicitly undefined fields", () => {
    const schema = object({ name: string(), bio: string() })
    expect(() => {
      // @ts-expect-error All fields must be present.
      schema.create(getStore(), { name: "Ada" })
    }).toThrow("Missing required field: bio.")
    expect(() => {
      // @ts-expect-error Explicit undefined is not a field value.
      schema.create(getStore(), { name: "Ada", bio: undefined })
    }).toThrow("Undefined field: bio.")
    // @ts-expect-error Snapshot fields are required.
    const missingBio: SnapshotOf<typeof schema> = { name: "Ada" }
    void missingBio

    const store = getStore()
    const ref = store.transact((write) =>
      write.root.save(schema.create(store, { name: "Ada", bio: "Hello" })),
    )
    const root = schema.bind(store, ref)
    store.transact((write) => write.map.remove(ref, "name"))
    expect(() => root.field("name")).toThrow("Missing required field: name.")
    expect(() => root.snapshot()).toThrow("Missing required field: name.")
  })

  test("supports prototype field names without inherited properties", () => {
    const schema = object({
      ["__proto__"]: string(),
      constructor: string(),
      toString: string(),
    })
    const initial = { ["__proto__"]: "proto", constructor: "ctor", toString: "text" }
    const root = openRoot(getStore(), schema, initial)
    expect(root.snapshot()).toEqual(initial)
    expect(root.field("__proto__").get()).toBe("proto")
    expect(() => {
      // @ts-expect-error Object.prototype.constructor is not a field value.
      schema.create(getStore(), { ["__proto__"]: "proto", toString: "text" })
    }).toThrow("Missing required field: constructor.")
    expect(() => {
      // @ts-expect-error Inherited schema properties are not declared fields.
      root.field("hasOwnProperty")
    }).toThrow("Unknown field: hasOwnProperty.")
  })

  test("supports empty objects", () => {
    const root = openRoot(getStore(), object({}), {})

    expect(root.snapshot()).toEqual({})
  })
})
