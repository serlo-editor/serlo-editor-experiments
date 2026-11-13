import { expect, test } from "bun:test"

import { describeWithStores } from "@editor/test-utils"

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
  })

  test("builds typed nested defaults and opens them as a document", () => {
    const schema = object({
      title: string(),
      enabled: boolean(),
      profile: object({ label: string() }),
    })
    const initial = schema.defaultValue() satisfies SnapshotOf<typeof schema>
    expect(initial).toEqual({ title: "", enabled: false, profile: { label: "" } })
    expect(initial.profile).not.toBe(schema.defaultValue().profile)
    expect(openRoot(getStore(), schema, initial).snapshot()).toEqual(initial)
  })

  test("rejects fields removed from stored objects", () => {
    const schema = object({ name: string(), bio: string() })
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
    expect(Object.hasOwn(root, "hasOwnProperty")).toBe(false)
  })

  test("supports field as a schema key and reserves snapshot", () => {
    const root = openRoot(getStore(), object({ field: string() }), { field: "Value" })
    expect(root.field.get()).toBe("Value")
    expect(root.snapshot()).toEqual({ field: "Value" })
  })

  test("supports empty objects", () => {
    const root = openRoot(getStore(), object({}), {})

    expect(root.snapshot()).toEqual({})
  })
})
