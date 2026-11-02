import { expect, test } from "bun:test"

import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { ReadonlyNodeStore, YjsNodeStore } from "../storage/index.ts"
import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { createDocument } from "./document.ts"
import { array, boolean, number, object, record, string } from "./index.ts"
import type { SnapshotOf, StoredValueOf } from "./types.ts"

describeWithStores("record schemas", (getStore) => {
  test("creates, reads, replaces, removes, and re-adds entries", () => {
    const resolved: string[] = []
    const schema = record((key) => {
      resolved.push(key)
      return string()
    })
    const { root } = createDocument(getStore(), schema, {})
    expect(root.snapshot()).toEqual({})
    expect(root.get("missing")).toBeUndefined()
    root.remove("missing")
    expect(resolved).toEqual([])

    root.set("answer", "Initial")
    const original = root.get("answer")!
    expect(original.get()).toBe("Initial")
    original.set("Edited")
    expect(root.snapshot()).toEqual({ answer: "Edited" })

    root.set("answer", "Replacement")
    expect(root.get("answer")!.get()).toBe("Replacement")
    root.remove("answer")
    root.remove("answer")
    expect(root.get("answer")).toBeUndefined()
    expect(root.snapshot()).toEqual({})
    root.set("answer", "Again")
    expect(root.snapshot()).toEqual({ answer: "Again" })

    // @ts-expect-error Records intentionally expose no keys() method.
    expect(root.keys).toBeUndefined()
  })

  test("resolves different node kinds and infers snapshot and stored-value unions", () => {
    const text = string()
    const selected = array(string())
    const profile = object({ count: number(), active: boolean() })
    const schema = record((key) => {
      if (key === "text") return text
      if (key === "selected") return selected
      if (key === "profile") return profile
      throw new Error(`Unknown key: ${key}.`)
    })
    const initial: SnapshotOf<typeof schema> = {
      text: "",
      selected: [],
      profile: { count: 0, active: false },
    }
    const { root } = createDocument(getStore(), schema, initial)
    expect(root.snapshot()).toEqual(initial)

    const choices = root.get("selected")
    if (!choices || !("insert" in choices)) throw new Error("Expected stored array.")
    choices.insert(0, "option-a")
    const details = root.get("profile")
    if (!details || !("field" in details)) throw new Error("Expected stored object.")
    details.field("count").set(1)
    expect(root.snapshot()).toEqual({
      text: "",
      selected: ["option-a"],
      profile: { count: 1, active: false },
    })

    root.get("text") satisfies
      | StoredValueOf<typeof text>
      | StoredValueOf<typeof selected>
      | StoredValueOf<typeof profile>
      | undefined
    // @ts-expect-error Dynamic IDs cannot narrow the stored-value union to a string.
    const onlyText: StoredValueOf<typeof text> = root.get("text")
    // @ts-expect-error Number snapshots do not belong to the resolver's snapshot union.
    const invalid: SnapshotOf<typeof schema> = { text: 42 }
    // @ts-expect-error Set accepts only the resolver's snapshot union.
    const wrongSetter: (key: string, value: number) => void = root.set
    void [onlyText, invalid, wrongSetter]
  })

  test("supports empty, Unicode, and prototype-name keys without inherited entries", () => {
    const keys = ["", "世界 👋", "__proto__", "constructor", "toString", "hasOwnProperty"]
    const schema = record(() => string())
    const { root } = createDocument(getStore(), schema, {})
    for (const key of keys) {
      expect(root.get(key)).toBeUndefined()
      root.set(key, key)
      expect(root.get(key)!.get()).toBe(key)
    }
    expect(root.snapshot()).toEqual(Object.fromEntries(keys.map((key) => [key, key])))
    const reopened = createDocument(getStore(), schema, { ignored: "Ignored" }).root
    expect(reopened.snapshot()).toEqual(root.snapshot())
    for (const key of keys) root.remove(key)
    expect(root.snapshot()).toEqual({})
  })

  test("propagates resolver failures and permits removing orphaned entries", () => {
    const store = getStore()
    const error = new Error("Unknown exercise.")
    let available = true
    const schema = record(() => {
      if (!available) throw error
      return string()
    })
    const { root } = createDocument(store, schema, { answer: "Initial" })
    const revision = store.getRevision()
    available = false

    expect(root.get("missing")).toBeUndefined()
    expect(() => schema.create(store, { answer: "New" })).toThrow(error)
    expect(() => root.get("answer")).toThrow(error)
    expect(() => root.set("answer", "Changed")).toThrow(error)
    expect(() => root.snapshot()).toThrow(error)
    expect(store.getRevision()).toBe(revision)

    root.remove("answer")
    expect(root.snapshot()).toEqual({})
    available = true
    root.set("answer", "Recovered")
    expect(root.snapshot()).toEqual({ answer: "Recovered" })
  })

  test("rejects invalid record snapshots and explicit undefined before resolution", () => {
    const store = getStore()
    let calls = 0
    const schema = record(() => {
      calls++
      return string()
    })
    for (const invalid of [null, [], false, 0, ""]) {
      expect(() => {
        // @ts-expect-error Record snapshots must be objects keyed by strings.
        schema.create(store, invalid)
      }).toThrow("Expected record snapshot.")
    }
    expect(() => {
      // @ts-expect-error Explicit undefined is not an absent entry.
      schema.create(store, { answer: undefined })
    }).toThrow("Undefined field: answer.")
    const { root } = createDocument(store, schema, {})
    expect(() => {
      // @ts-expect-error Undefined cannot be stored.
      root.set("answer", undefined)
    }).toThrow("Undefined field: answer.")
    expect(calls).toBe(0)
    expect(root.snapshot()).toEqual({})
  })

  test("reads leave revisions unchanged and each entry write notifies once", () => {
    const store = getStore()
    const { root } = createDocument(
      store,
      record(() => object({ text: string() })),
      {},
    )
    const revision = store.getRevision()
    const observed: unknown[] = []
    store.subscribe(() => observed.push(root.snapshot()))

    root.get("missing")
    root.snapshot()
    root.remove("missing")
    expect(store.getRevision()).toBe(revision)
    expect(observed).toEqual([])

    root.set("answer", { text: "Initial" })
    root.get("answer")!.field("text").set("Edited")
    root.remove("answer")
    expect(observed).toEqual([{ answer: { text: "Initial" } }, { answer: { text: "Edited" } }, {}])
    expect(store.getRevision()).toBe(revision + 3)
  })
})

test("read-only records initialize and preserve falsy refs but reject writes before resolution", () => {
  const store = new ReadonlyNodeStore()
  let calls = 0
  const schema = record((key) => {
    calls++
    if (key === "active") return boolean()
    if (key === "count") return number()
    if (key === "tags") return array(string())
    return string()
  })
  const initial = { active: false, count: 0, text: "", tags: ["tag"], ["__proto__"]: "safe" }
  const document = createDocument(store, schema, initial)
  expect(document.snapshot()).toEqual(initial)
  for (const [key, value] of Object.entries(initial)) {
    expect(document.root.get(key)?.snapshot()).toEqual(value)
  }
  expect(document.root.get("constructor")).toBeUndefined()
  const beforeWrite = calls
  expect(() => document.root.set("text", "Changed")).toThrow("Storage is read-only.")
  expect(() => document.root.remove("text")).toThrow("Storage is read-only.")
  expect(calls).toBe(beforeWrite)
  const snapshot = document.snapshot()
  const tags = snapshot.tags
  if (!Array.isArray(tags)) throw new Error("Expected tags array.")
  tags.push("Outside mutation")
  expect(document.snapshot()).toEqual(initial)
  expect(createDocument(store, schema, {}).snapshot()).toEqual(initial)
  expect(store.getRevision()).toBe(0)
})

test("Yjs records reopen, observe remote edits, and converge after concurrent additions", () => {
  const firstDoc = new Y.Doc()
  const secondDoc = new Y.Doc()
  const firstAwareness = new Awareness(firstDoc)
  const secondAwareness = new Awareness(secondDoc)
  try {
    const firstStore = new YjsNodeStore({ doc: firstDoc, awareness: firstAwareness })
    const secondStore = new YjsNodeStore({ doc: secondDoc, awareness: secondAwareness })
    const schema = record(() => string())
    const first = createDocument(firstStore, schema, { answer: "Initial" })
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    const second = createDocument(secondStore, schema, { ignored: "Ignored" })
    const cached = second.root.get("answer")!
    const observed: unknown[] = []
    secondStore.subscribe(() => observed.push(second.snapshot()))

    first.root.get("answer")!.set("Edited")
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    expect(cached.get()).toBe("Edited")
    expect(observed).toEqual([{ answer: "Edited" }])

    first.root.set("first", "A")
    second.root.set("second", "B")
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    Y.applyUpdate(firstDoc, Y.encodeStateAsUpdate(secondDoc))
    expect(first.snapshot()).toEqual({ answer: "Edited", first: "A", second: "B" })
    expect(second.snapshot()).toEqual(first.snapshot())

    first.root.remove("answer")
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    expect(second.root.get("answer")).toBeUndefined()
    expect(second.snapshot()).toEqual(first.snapshot())
  } finally {
    firstAwareness.destroy()
    secondAwareness.destroy()
    firstDoc.destroy()
    secondDoc.destroy()
  }
})
