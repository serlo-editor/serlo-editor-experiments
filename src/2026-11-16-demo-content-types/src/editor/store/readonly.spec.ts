import { expect, test } from "bun:test"

import type { JSONValue } from "@editor/utils"

import { ReadonlyNodeStore } from "./index.ts"

test("read-only refs are nested frozen values, independent of caller-owned data", () => {
  const store = new ReadonlyNodeStore()
  const input = { nested: ["Initial"] }
  const root = store.root.getOrCreate(() => {
    const cell = store.cell.create(input)
    const items = store.array.create([cell, store.cell.create(false)])
    const map = store.map.create({ items })
    expect(store.map.get(map)).toBe(map)
    expect(Object.isFrozen(map)).toBe(true)
    expect(Object.isFrozen(items)).toBe(true)
    expect(Reflect.set(map, "added", true)).toBe(false)
    expect(Reflect.set(items, "0", "Changed")).toBe(false)
    return map
  })
  expect(store.cell.get(root)).toEqual({ items: [{ nested: ["Initial"] }, false] })

  // Reopening preserves the root and never invokes its initializer.
  expect(
    store.root.getOrCreate(() => {
      throw new Error("Must not initialize twice.")
    }),
  ).toBe(root)

  input.nested.push("Outside mutation")
  expect(store.cell.get(root)).toEqual({ items: [{ nested: ["Initial"] }, false] })
})

test.each<{ value: JSONValue }>([
  { value: null },
  { value: false },
  { value: 0 },
  { value: "" },
  { value: [] },
  { value: {} },
])("preserves an empty or falsy root: $value", ({ value }) => {
  const store = new ReadonlyNodeStore()
  const ref = store.root.getOrCreate(() => store.cell.create(value))
  expect(store.cell.get(ref)).toEqual(value)
  expect(store.root.getOrCreate(() => store.cell.create("Replacement"))).toBe(ref)
})

test("freezes nested cell JSON and copies array/map inputs", () => {
  const store = new ReadonlyNodeStore()
  store.root.getOrCreate(() => {
    const cell = store.cell.create({ nested: ["Initial"] })
    const items = [cell]
    const fields = { cell }
    const array = store.array.create(items)
    const map = store.map.create(fields)
    items.length = 0
    fields.cell = store.cell.create("Different")
    expect(store.array.get(array)).toBe(array)
    expect(store.cell.get(array)).toEqual([{ nested: ["Initial"] }])
    expect(store.cell.get(map)).toEqual({ cell: { nested: ["Initial"] } })
    expect(Object.isFrozen(cell)).toBe(true)
    const nested = Reflect.get(Object(cell), "nested")
    expect(Object.isFrozen(nested)).toBe(true)
    expect(Reflect.set(nested, "0", "Changed")).toBe(false)
    return map
  })
})

test("gets own map fields without losing falsy references", () => {
  const store = new ReadonlyNodeStore()
  const values = { null: null, false: false, zero: 0, empty: "" }
  const keys = ["", "世界 👋", "__proto__", "constructor", "toString", "hasOwnProperty"]
  store.root.getOrCreate(() => {
    const fields = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, store.cell.create(value)]),
    )
    const specialFields = Object.fromEntries(keys.map((key) => [key, store.cell.create(key)]))
    const map = store.map.create({})
    const root = store.map.create({ ...fields, ...specialFields, map })
    for (const [key, value] of Object.entries(values)) {
      expect<JSONValue | undefined>(store.map.getField(root, key)).toBe(value)
    }
    for (const key of keys) {
      expect<JSONValue | undefined>(store.map.getField(root, key)).toBe(key)
      expect(store.map.getField(map, key)).toBeUndefined()
    }
    expect(store.map.getField(root, "map")).toBe(map)
    expect(store.map.getField(root, "missing")).toBeUndefined()
    return root
  })
  expect(store.getRevision()).toBe(0)
})

test("rejects transactions without executing callbacks and creation outside initialization", () => {
  const store = new ReadonlyNodeStore()
  const forbidden = [
    () => store.cell.create("Added"),
    () => store.array.create([]),
    () => store.map.create({}),
    () =>
      store.transact(() => {
        throw new Error("Callback must not run.")
      }),
  ]
  for (const operation of forbidden) expect(operation).toThrow("Storage is read-only.")
  store.root.getOrCreate(() => {
    expect(() => store.transact(() => {})).toThrow("Storage is read-only.")
    return store.cell.create("Initial")
  })
  for (const operation of forbidden) expect(operation).toThrow("Storage is read-only.")
})

test("closes failed initialization and permits retrying", () => {
  const store = new ReadonlyNodeStore()
  expect(() =>
    store.root.getOrCreate(() => {
      throw new Error("Failed")
    }),
  ).toThrow("Failed")
  expect(() => store.cell.create("Outside initialization")).toThrow("Storage is read-only.")
  const ref = store.root.getOrCreate(() => store.cell.create("Recovered"))
  expect(store.cell.get(ref)).toBe("Recovered")
})

test("immutable stores keep a constant revision and never notify", () => {
  const store = new ReadonlyNodeStore()
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications++
  })
  expect(store.getRevision()).toBe(0)
  const ref = store.root.getOrCreate(() => store.cell.create("Initial"))
  store.cell.get(ref)
  expect(() => store.transact(() => {})).toThrow("Storage is read-only.")
  unsubscribe()
  unsubscribe()
  expect(store.getRevision()).toBe(0)
  expect(notifications).toBe(0)
})
