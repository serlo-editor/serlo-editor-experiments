import { expect, test } from "bun:test"

import { ReadonlyNodeStore, YjsNodeStore } from "@editor/storage"
import { describeWithStores } from "@editor/test-utils"
import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { array, boolean, object, record, string } from "./index.ts"
import { openRoot } from "./root.ts"

describeWithStores("record schemas", (getStore) => {
  test("creates, reads, replaces, removes, and re-adds entries", () => {
    const schema = record(string())
    const initial = schema.defaultValue()
    expect(initial).toEqual({})
    const root = openRoot(getStore(), schema, initial)
    expect(root.snapshot()).toEqual({})
    expect(Object.hasOwn(root.snapshot(), "missing")).toBe(false)
    root.remove("missing")

    root.set("answer", "Initial")
    const original = root.getOrCreate("answer", () => "")
    expect(original.get()).toBe("Initial")
    original.set("Edited")
    expect(root.snapshot()).toEqual({ answer: "Edited" })

    root.set("answer", "Replacement")
    expect(root.getOrCreate("answer", () => "").get()).toBe("Replacement")
    root.remove("answer")
    root.remove("answer")
    expect(Object.hasOwn(root.snapshot(), "answer")).toBe(false)
    expect(root.snapshot()).toEqual({})
    root.set("answer", "Again")
    expect(root.snapshot()).toEqual({ answer: "Again" })
  })

  test("getOrCreate initializes once and preserves edited values", () => {
    const store = getStore()
    const root = openRoot(store, record(string()), {})
    const revision = store.getRevision()
    let calls = 0
    const create = () => {
      calls++
      return "Initial"
    }

    expect(root.getOrCreate("answer", create).get()).toBe("Initial")
    expect(root.getOrCreate("answer", create).get()).toBe("Initial")
    expect(calls).toBe(1)
    expect(store.getRevision()).toBe(revision + 1)
    root.getOrCreate("answer", () => "").set("Edited")
    expect(root.getOrCreate("answer", create).get()).toBe("Edited")
    expect(calls).toBe(1)
  })

  test("infers object child snapshots and stored values", () => {
    const child = object({
      text: string(),
      selected: array(string()),
      active: boolean(),
    })
    const schema = record(child)
    const initial = {
      answer: { text: "", selected: [], active: false },
    }
    const root = openRoot(getStore(), schema, initial)
    expect(root.snapshot()).toEqual(initial)

    const answer = root.getOrCreate("answer", () => ({ text: "", selected: [], active: false }))
    answer.selected.insert(0, "option-a")
    expect(root.snapshot()).toEqual({
      answer: { text: "", selected: ["option-a"], active: false },
    })
    root.set("another", { text: "Other", selected: [], active: true })
    expect(
      root.getOrCreate("another", () => ({ text: "", selected: [], active: false })).active.get(),
    ).toBe(true)
  })

  test("creates, edits, and replaces array children", () => {
    const schema = record(array(string()))
    const root = openRoot(getStore(), schema, { selected: ["option-a"] })
    root.getOrCreate("selected", () => []).insert(1, "option-b")
    expect(root.snapshot()).toEqual({ selected: ["option-a", "option-b"] })
    root.set("selected", ["option-c"])
    expect(root.getOrCreate("selected", () => []).length).toBe(1)
    expect(root.snapshot()).toEqual({ selected: ["option-c"] })
  })

  test("supports empty, Unicode, and prototype-name keys without inherited entries", () => {
    const keys = ["", "世界 👋", "__proto__", "constructor", "toString", "hasOwnProperty"]
    const schema = record(string())
    const root = openRoot(getStore(), schema, {})
    for (const key of keys) {
      expect(Object.hasOwn(root.snapshot(), key)).toBe(false)
      root.set(key, key)
      expect(root.getOrCreate(key, () => "").get()).toBe(key)
    }
    expect(root.snapshot()).toEqual(Object.fromEntries(keys.map((key) => [key, key])))
    const reopened = openRoot(getStore(), schema, { ignored: "Ignored" })
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
      defaultValue: () => child.defaultValue(),
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
    const root = openRoot(store, schema, { answer: "Initial" })
    const revision = store.getRevision()
    available = false

    expect(() => schema.create(store, { answer: "New" })).toThrow(error)
    expect(() => root.getOrCreate("answer", () => "")).toThrow(error)
    expect(() => root.set("answer", "Changed")).toThrow(error)
    expect(() => root.snapshot()).toThrow(error)
    expect(store.getRevision()).toBe(revision)

    root.remove("answer")
    expect(root.snapshot()).toEqual({})
    available = true
    root.set("answer", "Recovered")
    expect(root.snapshot()).toEqual({ answer: "Recovered" })
  })

  test("reads leave revisions unchanged and each entry write notifies once", () => {
    const store = getStore()
    const root = openRoot(store, record(object({ text: string() })), {
      answer: { text: "Initial" },
    })
    const revision = store.getRevision()
    const observed: unknown[] = []
    store.subscribe(() => observed.push(root.snapshot()))

    root.getOrCreate("answer", () => ({ text: "" }))
    root.snapshot()
    root.remove("missing")
    expect(store.getRevision()).toBe(revision)
    expect(observed).toEqual([])

    root.getOrCreate("answer", () => ({ text: "" })).text.set("Edited")
    root.remove("answer")
    expect(observed).toEqual([{ answer: { text: "Edited" } }, {}])
    expect(store.getRevision()).toBe(revision + 2)
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
  const document = openRoot(store, schema, initial)
  expect(document.snapshot()).toEqual(initial)
  for (const [key, value] of Object.entries(initial)) {
    expect(document.getOrCreate(key, () => []).snapshot()).toEqual(value)
  }
  expect(Object.hasOwn(document.snapshot(), "constructor")).toBe(false)
  const beforeWrite = calls
  expect(document.getOrCreate("tags", () => ["Changed"]).snapshot()).toEqual(["tag"])
  expect(() => document.getOrCreate("missing", () => ["New"])).toThrow("Storage is read-only.")
  expect(() => document.set("tags", ["Changed"])).toThrow("Storage is read-only.")
  expect(() => document.remove("tags")).toThrow("Storage is read-only.")
  expect(calls).toBe(beforeWrite)
  const snapshot = document.snapshot()
  const tags = snapshot.tags
  if (!Array.isArray(tags)) throw new Error("Expected tags array.")
  tags.push("Outside mutation")
  expect(document.snapshot()).toEqual(initial)
  expect(openRoot(store, schema, {}).snapshot()).toEqual(initial)
  expect(store.getRevision()).toBe(0)
})

test("read-only records preserve falsy primitive refs", () => {
  const active = openRoot(new ReadonlyNodeStore(), record(boolean()), { answer: false })
  const text = openRoot(new ReadonlyNodeStore(), record(string()), { answer: "" })
  expect(active.getOrCreate("answer", () => true).get()).toBe(false)
  expect(text.getOrCreate("answer", () => "fallback").get()).toBe("")
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
    const first = openRoot(firstStore, schema, { answer: "Initial" })
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    const second = openRoot(secondStore, schema, { ignored: "Ignored" })
    const cached = second.getOrCreate("answer", () => "")
    const observed: unknown[] = []
    secondStore.subscribe(() => observed.push(second.snapshot()))

    first.getOrCreate("answer", () => "").set("Edited")
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
    expect(Object.hasOwn(second.snapshot(), "answer")).toBe(false)
    expect(second.snapshot()).toEqual(first.snapshot())
  } finally {
    firstAwareness.destroy()
    secondAwareness.destroy()
    firstDoc.destroy()
    secondDoc.destroy()
  }
})
