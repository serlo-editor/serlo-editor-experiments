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
    expect(root.name.get() satisfies string).toBe("Ada")
    expect(root.active.get() satisfies boolean).toBe(false)

    root.name.set("Grace")
    root.active.set(true)
    root.tags.insert(1, "code")
    root.profile.bio.set("Updated")

    expect(root.snapshot()).toEqual({
      name: "Grace",
      active: true,
      tags: ["math", "code"],
      profile: { bio: "Updated" },
    })

    // @ts-expect-error Object stored values expose child properties, not get().
    expect(root.get).toBe(undefined)
    // @ts-expect-error Fields are edited through child stored values, not replaced.
    expect(root.set).toBe(undefined)
    // @ts-expect-error Field access method was removed.
    expect(root.field).toBeUndefined()
    // @ts-expect-error Unknown fields are not exposed.
    expect(root.missing).toBeUndefined()
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
    expect(() => root.name).toThrow("Missing required field: name.")
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
    expect(root.__proto__.get()).toBe("proto")
    expect(root.constructor.get()).toBe("ctor")
    expect(root.toString.get()).toBe("text")
    expect(() => {
      // @ts-expect-error Object.prototype.constructor is not a field value.
      schema.create(getStore(), { ["__proto__"]: "proto", toString: "text" })
    }).toThrow("Missing required field: constructor.")
    expect(Object.hasOwn(root, "hasOwnProperty")).toBe(false)
  })

  test("supports field as a schema key and reserves snapshot", () => {
    const root = openRoot(getStore(), object({ field: string() }), { field: "Value" })
    expect(root.field.get()).toBe("Value")
    expect(root.snapshot()).toEqual({ field: "Value" })

    // @ts-expect-error `snapshot` is reserved for the stored object's snapshot method.
    object({ snapshot: string() })
  })

  test("supports empty objects", () => {
    const root = openRoot(getStore(), object({}), {})

    expect(root.snapshot()).toEqual({})
  })
})
