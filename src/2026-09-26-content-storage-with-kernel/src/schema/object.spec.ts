import { expect, test } from "bun:test"

import * as Y from "yjs"

import { YjsNodeStore } from "../storage/index.ts"
import type { NodeKind, NodeStore } from "../storage/types.ts"
import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { array } from "./array.ts"
import { createDocument } from "./document.ts"
import { boolean, number, object, optional, string } from "./index.ts"
import type { HandleOf, SnapshotOf } from "./types.ts"

describeWithStores("object schemas", (getStore) => {
  test("reads typed fields and snapshots child edits", () => {
    const initial = {
      name: "Ada",
      active: false,
      tags: ["math"],
      profile: { bio: "Hello" },
    }
    const { root } = createDocument(
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

    // @ts-expect-error Object handles expose field(), not get().
    expect(root.get).toBe(undefined)
    // @ts-expect-error Fields are edited through child handles, not replaced.
    expect(root.set).toBe(undefined)
    expect(() => {
      // @ts-expect-error Unknown fields are rejected.
      root.field("missing")
    }).toThrow()
  })

  test("adds, edits, replaces, removes, and re-adds optional fields", () => {
    const schema = object({ name: string(), bio: optional(string()) })
    const document = createDocument(getStore(), schema, { name: "Ada" })
    const root = document.root

    expect(root.field("name").get() satisfies string).toBe("Ada")
    expect(root.field("bio") satisfies HandleOf<ReturnType<typeof string>> | undefined).toBe(
      undefined,
    )
    expect(document.snapshot()).toEqual({ name: "Ada" })
    expect(Object.hasOwn(document.snapshot(), "bio")).toBe(false)

    root.removeOptional("bio")
    root.setOptional("bio", "Hello")
    const bio = root.field("bio")!
    expect(bio.get()).toBe("Hello")
    bio.set("Updated")
    expect(document.snapshot()).toEqual({ name: "Ada", bio: "Updated" })

    root.setOptional("bio", "Replacement")
    expect(root.field("bio")!.get()).toBe("Replacement")
    root.removeOptional("bio")
    root.removeOptional("bio")
    expect(root.field("bio")).toBe(undefined)
    expect(root.snapshot()).toEqual({ name: "Ada" })
    root.setOptional("bio", "Again")
    expect(root.snapshot()).toEqual({ name: "Ada", bio: "Again" })

    expect(() => {
      // @ts-expect-error Required fields cannot be replaced through setOptional().
      root.setOptional("name", "Grace")
    }).toThrow("Field is not optional: name.")
    expect(() => {
      // @ts-expect-error Required fields cannot be removed.
      root.removeOptional("name")
    }).toThrow("Field is not optional: name.")
    expect(() => {
      // @ts-expect-error Undefined is not an optional field value.
      root.setOptional("bio", undefined)
    }).toThrow("Undefined field: bio.")
    expect(() => {
      // @ts-expect-error Unknown fields cannot be added.
      root.setOptional("missing", "value")
    }).toThrow("Unknown field: missing.")
    expect(() => {
      // @ts-expect-error Unknown fields cannot be removed.
      root.removeOptional("missing")
    }).toThrow("Unknown field: missing.")

    // @ts-expect-error Optional fields require an undefined check.
    const requiredHandle: HandleOf<ReturnType<typeof string>> = root.field("bio")
    // @ts-expect-error Optional string fields reject numbers.
    const wrongSetter: (key: "bio", value: number) => void = root.setOptional
    // @ts-expect-error Required snapshot fields remain required.
    const missingName: SnapshotOf<typeof schema> = {}
    // @ts-expect-error Optional snapshot properties cannot explicitly contain undefined.
    const undefinedBio: SnapshotOf<typeof schema> = { name: "Ada", bio: undefined }
    void [requiredHandle, wrongSetter, missingName, undefinedBio]
  })

  test("preserves optional falsy values, arrays, and nested objects", () => {
    const schema = object({
      bio: optional(string()),
      active: optional(boolean()),
      count: optional(number()),
      tags: optional(array(string())),
      profile: optional(object({ title: string(), note: optional(string()) })),
    })
    const initial = { bio: "", active: false, count: 0, tags: [], profile: { title: "" } }
    const { root } = createDocument(getStore(), schema, initial)
    expect(root.snapshot()).toEqual(initial)

    root.field("tags")!.insert(0, "math")
    root.field("profile")!.setOptional("note", "Hello")
    expect(root.snapshot()).toEqual({
      ...initial,
      tags: ["math"],
      profile: { title: "", note: "Hello" },
    })
    root.removeOptional("profile")
    root.setOptional("profile", { title: "New" })
    root.removeOptional("tags")
    root.setOptional("tags", [])
    expect(root.snapshot()).toEqual({ ...initial, profile: { title: "New" } })
  })

  test("rejects missing required and explicitly undefined initial fields", () => {
    const schema = object({ name: string(), bio: optional(string()) })
    expect(() => {
      // @ts-expect-error Required fields must be present.
      schema.create(getStore(), {})
    }).toThrow("Missing required field: name.")
    expect(() => {
      // @ts-expect-error Explicit undefined is not absence.
      schema.create(getStore(), { name: "Ada", bio: undefined })
    }).toThrow("Undefined field: bio.")
    expect(() => {
      // @ts-expect-error Required values cannot be undefined either.
      schema.create(getStore(), { name: undefined })
    }).toThrow("Undefined field: name.")

    const store = getStore()
    const ref = store.attach(schema.create(store, { name: "Ada" }))
    const root = schema.bind(store, ref)
    store.transact((tx) => store.map.edit(ref, tx).remove("name"))
    expect(() => root.field("name")).toThrow("Missing required field: name.")
    expect(() => root.snapshot()).toThrow("Missing required field: name.")
  })

  test("handles optional prototype field names without inherited properties", () => {
    const schema = object({
      ["__proto__"]: optional(string()),
      constructor: optional(string()),
      toString: optional(string()),
    })
    const { root } = createDocument(getStore(), schema, { constructor: "ctor", toString: "text" })
    root.removeOptional("constructor")
    root.removeOptional("toString")
    expect(root.field("__proto__")).toBe(undefined)
    expect(root.field("constructor")).toBe(undefined)
    expect(root.field("toString")).toBe(undefined)
    expect(root.snapshot()).toEqual({})
    root.setOptional("__proto__", "value")
    expect(root.snapshot()).toEqual({ ["__proto__"]: "value" })
    root.removeOptional("__proto__")
    expect(root.snapshot()).toEqual({})

    const required = object({ constructor: string() })
    expect(() => {
      // @ts-expect-error Object.prototype.constructor is not a required field value.
      required.create(getStore(), {})
    }).toThrow("Missing required field: constructor.")
    expect(() => {
      // @ts-expect-error Inherited schema properties are not declared fields.
      root.field("hasOwnProperty")
    }).toThrow("Unknown field: hasOwnProperty.")
  })

  test("supports empty objects", () => {
    const { root } = createDocument(getStore(), object({}), {})

    expect(root.snapshot()).toEqual({})
  })
})

test("optional fields observe remote Yjs changes and converge after concurrent add/remove", () => {
  const firstDoc = new Y.Doc()
  const secondDoc = new Y.Doc()
  type YjsRefs = { [Kind in NodeKind]: ReturnType<YjsNodeStore[Kind]["create"]> }
  const firstStore: NodeStore<YjsRefs, Y.Transaction> = new YjsNodeStore(firstDoc)
  const secondStore: NodeStore<YjsRefs, Y.Transaction> = new YjsNodeStore(secondDoc)
  const schema = object({ name: string(), bio: optional(string()) })
  const first = createDocument(firstStore, schema, { name: "Ada" }).root
  Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
  const secondRef = secondDoc.getMap<ReturnType<typeof secondStore.map.create>>("root").get("root")!
  const second = schema.bind(secondStore, secondRef)

  first.setOptional("bio", "Hello")
  Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
  expect(second.field("bio")!.get()).toBe("Hello")
  first.removeOptional("bio")
  Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
  expect(second.field("bio")).toBe(undefined)
  expect(second.snapshot()).toEqual({ name: "Ada" })

  first.setOptional("bio", "Existing")
  Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
  first.setOptional("bio", "Concurrent replacement")
  second.removeOptional("bio")
  const firstUpdate = Y.encodeStateAsUpdate(firstDoc)
  const secondUpdate = Y.encodeStateAsUpdate(secondDoc)
  Y.applyUpdate(firstDoc, secondUpdate)
  Y.applyUpdate(secondDoc, firstUpdate)
  expect(first.snapshot()).toEqual(second.snapshot())
  const bio = first.field("bio")
  expect(bio === undefined || bio.get() === "Concurrent replacement").toBeTruthy()
  firstDoc.destroy()
  secondDoc.destroy()
})
