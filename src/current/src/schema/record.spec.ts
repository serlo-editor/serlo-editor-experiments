import { expect, test } from "bun:test"

import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { ReadonlyNodeStore, YjsNodeStore } from "../storage/index.ts"
import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { array, boolean, number, object, record, string } from "./index.ts"
import { createRoot } from "./root.ts"
import type { SnapshotOf, StoredValueOf } from "./types.ts"

describeWithStores("record schemas", (getStore) => {
  test("creates, reads, replaces, removes, and re-adds entries", () => {
    const schema = record(string())
    const root = createRoot(getStore(), schema, {})
    expect(root.snapshot()).toEqual({})
    expect(root.get("missing")).toBeUndefined()
    root.remove("missing")

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

  test("infers object child snapshots and stored values", () => {
    const child = object({
      text: string(),
      selected: array(string()),
      count: number(),
      active: boolean(),
    })
    const schema = record(child)
    const initial: SnapshotOf<typeof schema> = {
      answer: { text: "", selected: [], count: 0, active: false },
    }
    const root = createRoot(getStore(), schema, initial)
    expect(root.snapshot()).toEqual(initial)

    const answer = root.get("answer")
    answer satisfies StoredValueOf<typeof child> | undefined
    answer!.field("selected").insert(0, "option-a")
    answer!.field("count").set(1)
    expect(root.snapshot()).toEqual({
      answer: { text: "", selected: ["option-a"], count: 1, active: false },
    })
    root.set("another", { text: "Other", selected: [], count: 2, active: true })
    expect(root.get("another")!.field("active").get()).toBe(true)

    // @ts-expect-error Missing entries require an undefined check.
    const required: StoredValueOf<typeof child> = answer
    // @ts-expect-error Number snapshots do not match the child schema.
    const invalid: SnapshotOf<typeof schema> = { answer: 42 }
    // @ts-expect-error Set accepts only snapshots matching the child schema.
    const wrongSetter: (key: string, value: number) => void = root.set
    void [required, invalid, wrongSetter]
  })

  test("creates, edits, and replaces array children", () => {
    const schema = record(array(string()))
    const root = createRoot(getStore(), schema, { selected: ["option-a"] })
    root.get("selected")!.insert(1, "option-b")
    expect(root.snapshot()).toEqual({ selected: ["option-a", "option-b"] })
    root.set("selected", ["option-c"])
    expect(root.get("selected")!.length).toBe(1)
    expect(root.snapshot()).toEqual({ selected: ["option-c"] })
  })

  test("supports empty, Unicode, and prototype-name keys without inherited entries", () => {
    const keys = ["", "世界 👋", "__proto__", "constructor", "toString", "hasOwnProperty"]
    const schema = record(string())
    const root = createRoot(getStore(), schema, {})
    for (const key of keys) {
      expect(root.get(key)).toBeUndefined()
      root.set(key, key)
      expect(root.get(key)!.get()).toBe(key)
    }
    expect(root.snapshot()).toEqual(Object.fromEntries(keys.map((key) => [key, key])))
    const reopened = createRoot(getStore(), schema, { ignored: "Ignored" })
    expect(reopened.snapshot()).toEqual(root.snapshot())
    for (const key of keys) root.remove(key)
    expect(root.snapshot()).toEqual({})
  })

  test("propagates child schema failures and permits removing unreadable entries", () => {
    const store = getStore()
    const child = string()
    const error = new Error("Unavailable child schema.")
    let available = true
    const guarded: typeof child = {
      create(store, snapshot) {
        if (!available) throw error
        return child.create(store, snapshot)
      },
      bind(store, ref) {
        if (!available) throw error
        return child.bind(store, ref)
      },
    }
    const schema = record(guarded)
    const root = createRoot(store, schema, { answer: "Initial" })
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

  test("rejects invalid record snapshots and explicit undefined before child creation", () => {
    const store = getStore()
    const child = string()
    let calls = 0
    const counted: typeof child = {
      ...child,
      create(store, snapshot) {
        calls++
        return child.create(store, snapshot)
      },
    }
    const schema = record(counted)
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
    const root = createRoot(store, schema, {})
    expect(() => {
      // @ts-expect-error Undefined cannot be stored.
      root.set("answer", undefined)
    }).toThrow("Undefined field: answer.")
    expect(calls).toBe(0)
    expect(root.snapshot()).toEqual({})
  })

  test("reads leave revisions unchanged and each entry write notifies once", () => {
    const store = getStore()
    const root = createRoot(store, record(object({ text: string() })), {})
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

test("read-only records initialize but reject writes before child creation", () => {
  const store = new ReadonlyNodeStore()
  const child = array(string())
  let calls = 0
  const counted: typeof child = {
    ...child,
    create(store, snapshot) {
      calls++
      return child.create(store, snapshot)
    },
  }
  const schema = record(counted)
  const initial = { tags: ["tag"], ["__proto__"]: ["safe"] }
  const document = createRoot(store, schema, initial)
  expect(document.snapshot()).toEqual(initial)
  for (const [key, value] of Object.entries(initial)) {
    expect(document.get(key)?.snapshot()).toEqual(value)
  }
  expect(document.get("constructor")).toBeUndefined()
  const beforeWrite = calls
  expect(() => document.set("tags", ["Changed"])).toThrow("Storage is read-only.")
  expect(() => document.remove("tags")).toThrow("Storage is read-only.")
  expect(calls).toBe(beforeWrite)
  const snapshot = document.snapshot()
  const tags = snapshot.tags
  if (!Array.isArray(tags)) throw new Error("Expected tags array.")
  tags.push("Outside mutation")
  expect(document.snapshot()).toEqual(initial)
  expect(createRoot(store, schema, {}).snapshot()).toEqual(initial)
  expect(store.getRevision()).toBe(0)
})

test("read-only records preserve falsy primitive refs", () => {
  const active = createRoot(new ReadonlyNodeStore(), record(boolean()), { answer: false })
  const count = createRoot(new ReadonlyNodeStore(), record(number()), { answer: 0 })
  const text = createRoot(new ReadonlyNodeStore(), record(string()), { answer: "" })
  expect(active.get("answer")!.get()).toBe(false)
  expect(count.get("answer")!.get()).toBe(0)
  expect(text.get("answer")!.get()).toBe("")
})

test("Yjs records reopen, observe remote edits, and converge after concurrent additions", () => {
  const firstDoc = new Y.Doc()
  const secondDoc = new Y.Doc()
  const firstAwareness = new Awareness(firstDoc)
  const secondAwareness = new Awareness(secondDoc)
  try {
    const firstStore = new YjsNodeStore({ doc: firstDoc, awareness: firstAwareness })
    const secondStore = new YjsNodeStore({ doc: secondDoc, awareness: secondAwareness })
    const schema = record(string())
    const first = createRoot(firstStore, schema, { answer: "Initial" })
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    const second = createRoot(secondStore, schema, { ignored: "Ignored" })
    const cached = second.get("answer")!
    const observed: unknown[] = []
    secondStore.subscribe(() => observed.push(second.snapshot()))

    first.get("answer")!.set("Edited")
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    expect(cached.get()).toBe("Edited")
    expect(observed).toEqual([{ answer: "Edited" }])

    first.set("first", "A")
    second.set("second", "B")
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    Y.applyUpdate(firstDoc, Y.encodeStateAsUpdate(secondDoc))
    expect(first.snapshot()).toEqual({ answer: "Edited", first: "A", second: "B" })
    expect(second.snapshot()).toEqual(first.snapshot())

    first.remove("answer")
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    expect(second.get("answer")).toBeUndefined()
    expect(second.snapshot()).toEqual(first.snapshot())
  } finally {
    firstAwareness.destroy()
    secondAwareness.destroy()
    firstDoc.destroy()
    secondDoc.destroy()
  }
})
