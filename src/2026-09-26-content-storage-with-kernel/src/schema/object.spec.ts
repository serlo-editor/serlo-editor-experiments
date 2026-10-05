import { test } from "bun:test"
import assert from "node:assert/strict"

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

    assert.deepEqual(root.snapshot(), initial)
    assert.equal(root.field("name").get() satisfies string, "Ada")
    assert.equal(root.field("active").get() satisfies boolean, false)

    root.field("name").set("Grace")
    root.field("active").set(true)
    root.field("tags").insert(1, "code")
    root.field("profile").field("bio").set("Updated")

    assert.deepEqual(root.snapshot(), {
      name: "Grace",
      active: true,
      tags: ["math", "code"],
      profile: { bio: "Updated" },
    })

    // @ts-expect-error Object handles expose field(), not get().
    assert.equal(root.get, undefined)
    // @ts-expect-error Fields are edited through child handles, not replaced.
    assert.equal(root.set, undefined)
    assert.throws(() => {
      // @ts-expect-error Unknown fields are rejected.
      root.field("missing")
    })
  })

  test("adds, edits, replaces, removes, and re-adds optional fields", () => {
    const schema = object({ name: string(), bio: optional(string()) })
    const document = createDocument(getStore(), schema, { name: "Ada" })
    const root = document.root

    assert.equal(root.field("name").get() satisfies string, "Ada")
    assert.equal(
      root.field("bio") satisfies HandleOf<ReturnType<typeof string>> | undefined,
      undefined,
    )
    assert.deepEqual(document.snapshot(), { name: "Ada" })
    assert.equal(Object.hasOwn(document.snapshot(), "bio"), false)

    root.removeOptional("bio")
    root.setOptional("bio", "Hello")
    const bio = root.field("bio")!
    assert.equal(bio.get(), "Hello")
    bio.set("Updated")
    assert.deepEqual(document.snapshot(), { name: "Ada", bio: "Updated" })

    root.setOptional("bio", "Replacement")
    assert.equal(root.field("bio")!.get(), "Replacement")
    root.removeOptional("bio")
    root.removeOptional("bio")
    assert.equal(root.field("bio"), undefined)
    assert.deepEqual(root.snapshot(), { name: "Ada" })
    root.setOptional("bio", "Again")
    assert.deepEqual(root.snapshot(), { name: "Ada", bio: "Again" })

    assert.throws(
      () => {
        // @ts-expect-error Required fields cannot be replaced through setOptional().
        root.setOptional("name", "Grace")
      },
      { message: "Field is not optional: name." },
    )
    assert.throws(
      () => {
        // @ts-expect-error Required fields cannot be removed.
        root.removeOptional("name")
      },
      { message: "Field is not optional: name." },
    )
    assert.throws(
      () => {
        // @ts-expect-error Undefined is not an optional field value.
        root.setOptional("bio", undefined)
      },
      { message: "Undefined field: bio." },
    )
    assert.throws(
      () => {
        // @ts-expect-error Unknown fields cannot be added.
        root.setOptional("missing", "value")
      },
      { message: "Unknown field: missing." },
    )
    assert.throws(
      () => {
        // @ts-expect-error Unknown fields cannot be removed.
        root.removeOptional("missing")
      },
      { message: "Unknown field: missing." },
    )

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
    assert.deepEqual(root.snapshot(), initial)

    root.field("tags")!.insert(0, "math")
    root.field("profile")!.setOptional("note", "Hello")
    assert.deepEqual(root.snapshot(), {
      ...initial,
      tags: ["math"],
      profile: { title: "", note: "Hello" },
    })
    root.removeOptional("profile")
    root.setOptional("profile", { title: "New" })
    root.removeOptional("tags")
    root.setOptional("tags", [])
    assert.deepEqual(root.snapshot(), { ...initial, profile: { title: "New" } })
  })

  test("rejects missing required and explicitly undefined initial fields", () => {
    const schema = object({ name: string(), bio: optional(string()) })
    assert.throws(
      () => {
        // @ts-expect-error Required fields must be present.
        schema.create(getStore(), {})
      },
      { message: "Missing required field: name." },
    )
    assert.throws(
      () => {
        // @ts-expect-error Explicit undefined is not absence.
        schema.create(getStore(), { name: "Ada", bio: undefined })
      },
      { message: "Undefined field: bio." },
    )
    assert.throws(
      () => {
        // @ts-expect-error Required values cannot be undefined either.
        schema.create(getStore(), { name: undefined })
      },
      { message: "Undefined field: name." },
    )

    const store = getStore()
    const ref = store.attach(schema.create(store, { name: "Ada" }))
    const root = schema.bind(store, ref)
    store.transact((tx) => store.map.edit(ref, tx).remove("name"))
    assert.throws(() => root.field("name"), { message: "Missing required field: name." })
    assert.throws(() => root.snapshot(), { message: "Missing required field: name." })
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
    assert.equal(root.field("__proto__"), undefined)
    assert.equal(root.field("constructor"), undefined)
    assert.equal(root.field("toString"), undefined)
    assert.deepEqual(root.snapshot(), {})
    root.setOptional("__proto__", "value")
    assert.deepEqual(root.snapshot(), { ["__proto__"]: "value" })
    root.removeOptional("__proto__")
    assert.deepEqual(root.snapshot(), {})

    const required = object({ constructor: string() })
    assert.throws(
      () => {
        // @ts-expect-error Object.prototype.constructor is not a required field value.
        required.create(getStore(), {})
      },
      { message: "Missing required field: constructor." },
    )
    assert.throws(
      () => {
        // @ts-expect-error Inherited schema properties are not declared fields.
        root.field("hasOwnProperty")
      },
      { message: "Unknown field: hasOwnProperty." },
    )
  })

  test("supports empty objects", () => {
    const { root } = createDocument(getStore(), object({}), {})

    assert.deepEqual(root.snapshot(), {})
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
  assert.equal(second.field("bio")!.get(), "Hello")
  first.removeOptional("bio")
  Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
  assert.equal(second.field("bio"), undefined)
  assert.deepEqual(second.snapshot(), { name: "Ada" })

  first.setOptional("bio", "Existing")
  Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
  first.setOptional("bio", "Concurrent replacement")
  second.removeOptional("bio")
  const firstUpdate = Y.encodeStateAsUpdate(firstDoc)
  const secondUpdate = Y.encodeStateAsUpdate(secondDoc)
  Y.applyUpdate(firstDoc, secondUpdate)
  Y.applyUpdate(secondDoc, firstUpdate)
  assert.deepEqual(first.snapshot(), second.snapshot())
  const bio = first.field("bio")
  assert.ok(bio === undefined || bio.get() === "Concurrent replacement")
  firstDoc.destroy()
  secondDoc.destroy()
})
