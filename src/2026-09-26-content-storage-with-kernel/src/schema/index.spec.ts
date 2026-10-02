import assert from "node:assert/strict"
import test from "node:test"
import type { TestContext } from "node:test"

import * as Y from "yjs"

import { FlatNodeStore, YjsNodeStore } from "../storage/index.ts"
import type { NodeStore, Ref } from "../storage/types.ts"
import * as schema from "./index.ts"

test("exports only array and string", () => {
  assert.deepEqual(Object.keys(schema).sort(), ["array", "string"])
})

test.describe("FlatNodeStore schemas", () => {
  registerSchemaTests(() => new FlatNodeStore())
})

test.describe("YjsNodeStore schemas", () => {
  registerSchemaTests(createYjsNodeStore)
})

function registerSchemaTests<Cell extends Ref, Array extends Ref, Map extends Ref, Tx>(
  createStore: (context: TestContext) => NodeStore<{ cell: Cell; array: Array; map: Map }, Tx>,
): void {
  test("creates, attaches, reads, edits, and rebinds a string", (context) => {
    const store = createStore(context)
    const textSchema = schema.string()
    const root = store.attach(textSchema.create(store, "Ada"))
    const text = textSchema.bind(store, root)
    const other = textSchema.bind(store, root)

    assert.equal(text.get(), "Ada")
    assert.equal(text.snapshot(), "Ada")

    text.set("Grace")
    assert.equal(other.get(), "Grace")
    assert.equal(other.snapshot(), "Grace")

    other.set("")
    assert.equal(text.get(), "")
    assert.equal(text.snapshot(), "")

    text.set("Hello, 世界 👋")
    assert.equal(text.get(), "Hello, 世界 👋")
    assert.equal(text.snapshot(), "Hello, 世界 👋")
  })

  test("rejects non-string cell values when reading string handles", (context) => {
    const store = createStore(context)
    const textSchema = schema.string()

    for (const value of [null, false, 42, [], {}]) {
      const root = store.attach(store.cell.create(value))
      const text = textSchema.bind(store, root)

      assert.throws(() => text.get(), { name: "TypeError", message: "Expected string cell." })
      assert.throws(() => text.snapshot(), TypeError)
    }
  })

  test("validates child reads after storage writes and permits recovery", (context) => {
    const store = createStore(context)
    const childRef = store.cell.create("Ada")
    const root = store.attach(store.array.create([childRef]))
    const names = schema.array(schema.string()).bind(store, root)
    const child = names.at(0)
    const directChild = schema.string().bind(store, childRef)

    assert.equal(directChild.get(), "Ada")
    assert.equal(child.get(), "Ada")
    store.transact((tx) => store.cell.edit(childRef, tx).set(42))

    assert.throws(() => child.get(), TypeError)
    assert.throws(() => child.snapshot(), TypeError)
    assert.throws(() => names.snapshot(), TypeError)

    child.set("Grace")
    assert.equal(directChild.get(), "Grace")
    assert.equal(child.get(), "Grace")
    assert.deepEqual(names.snapshot(), ["Grace"])
  })

  test("creates a string array, edits children, inserts, and retrieves", (context) => {
    const store = createStore(context)
    const namesSchema = schema.array(schema.string())
    const root = store.attach(namesSchema.create(store, ["Ada", "Linus"] as const))
    const names = namesSchema.bind(store, root)
    const before = names.snapshot()

    assert.equal(names.at(0).get(), "Ada")
    assert.deepEqual(before, ["Ada", "Linus"])

    names.at(1).set("Alan")
    names.insert(1, "Grace")

    assert.deepEqual(names.snapshot(), ["Ada", "Grace", "Alan"])
    assert.deepEqual(before, ["Ada", "Linus"], "Earlier snapshots remain unchanged")

    const retrieved = namesSchema.bind(store, root)
    assert.equal(retrieved.at(1).get(), "Grace")
    assert.deepEqual(retrieved.snapshot(), ["Ada", "Grace", "Alan"])

    retrieved.at(0).set("Katherine")
    assert.equal(names.at(0).get(), "Katherine")
  })

  test("inserts into empty arrays and at beginning, middle, and end", (context) => {
    const store = createStore(context)
    const namesSchema = schema.array(schema.string())
    const root = store.attach(namesSchema.create(store, []))
    const names = namesSchema.bind(store, root)

    assert.deepEqual(names.snapshot(), [])
    names.insert(0, "Grace")
    names.insert(0, "Ada")
    names.insert(1, "Alan")
    names.insert(3, "Linus")

    assert.deepEqual(names.snapshot(), ["Ada", "Alan", "Grace", "Linus"])
  })

  test("retained child handles follow nodes, not shifted indices", (context) => {
    const store = createStore(context)
    const namesSchema = schema.array(schema.string())
    const root = store.attach(namesSchema.create(store, ["Ada", "Ada"]))
    const names = namesSchema.bind(store, root)
    const retained = names.at(1)

    names.insert(0, "Grace")
    retained.set("Alan")

    assert.equal(retained.get(), "Alan")
    assert.deepEqual(names.snapshot(), ["Grace", "Ada", "Alan"])
    assert.equal(names.at(1).get(), "Ada", "Equal initial values have distinct cells")
  })

  test("composes nested arrays and inserts fresh child graphs", (context) => {
    const store = createStore(context)
    const rowsSchema = schema.array(schema.array(schema.string()))
    const root = store.attach(rowsSchema.create(store, [["Ada"], [], ["Ada"]]))
    const rows = rowsSchema.bind(store, root)

    assert.deepEqual(rows.snapshot(), [["Ada"], [], ["Ada"]])
    rows.at(0).at(0).set("Grace")
    rows.at(1).insert(0, "Linus")
    rows.insert(1, ["Alan", "Tim"])
    rows.at(1).at(1).set("Katherine")

    assert.deepEqual(rows.snapshot(), [["Grace"], ["Alan", "Katherine"], ["Linus"], ["Ada"]])
    assert.deepEqual(rowsSchema.bind(store, root).snapshot(), rows.snapshot())
  })

  test("throws RangeError when requested child index is absent", (context) => {
    const store = createStore(context)
    const namesSchema = schema.array(schema.string())
    const root = store.attach(namesSchema.create(store, []))
    const names = namesSchema.bind(store, root)

    assert.throws(() => names.at(0), RangeError)
    names.insert(0, "Ada")

    for (const index of [-1, 1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => names.at(index), RangeError)
    }
    assert.deepEqual(names.snapshot(), ["Ada"])
  })

  test("binds plain refs and preserves inferred string handle types", (context) => {
    const store = createStore(context)
    const namesSchema = schema.array(schema.string())
    const ref = namesSchema.create(store, ["Ada"])
    store.attach(ref)
    const names = namesSchema.bind(store, ref)
    const value: string = names.at(0).get()
    const snapshot: readonly string[] = names.snapshot()

    assert.equal(value, "Ada")
    assert.deepEqual(snapshot, ["Ada"])

    // Compile-time checks only: invalid operations must not run.
    const invalidUsage = () => {
      // @ts-expect-error String cells cannot be set to numbers.
      names.at(0).set(42)
      // @ts-expect-error String arrays cannot insert numbers.
      names.insert(0, 42)
      // @ts-expect-error String array snapshots cannot contain numbers.
      namesSchema.create(store, [42])
    }
    void invalidUsage
  })
}

function createYjsNodeStore(context: TestContext): YjsNodeStore {
  const doc = new Y.Doc()
  context.after(() => doc.destroy())
  return new YjsNodeStore(doc)
}
