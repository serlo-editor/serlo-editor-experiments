import assert from "node:assert/strict"
import test from "node:test"
import type { TestContext } from "node:test"

import * as Y from "yjs"

import { FlatStorage } from "./flat.ts"
import type { Storage } from "./types.ts"
import type { JSONValue } from "./utils/json-value.ts"
import { YjsStorage } from "./yjs.ts"

const storageImplementations = [
  ["FlatStorage", () => registerStorageTests(() => new FlatStorage())],
  ["YjsStorage", () => registerStorageTests(createYjsStorage)],
] as const

describeEach(storageImplementations, (registerTests) => registerTests())

// node:test has no built-in describe.each.
function describeEach<T>(
  cases: readonly (readonly [string, T])[],
  callback: (value: T) => void,
): void {
  for (const [name, value] of cases) {
    test.describe(name, () => callback(value))
  }
}

function registerStorageTests<CellRef, ArrayRef, TransactionContext>(
  createStorage: (context: TestContext) => Storage<CellRef, ArrayRef, TransactionContext>,
): void {
  test("reads every JSON value kind without losing empty or falsy values", (context) => {
    const storage = createStorage(context)
    const values: readonly JSONValue[] = [
      null,
      false,
      true,
      0,
      -42,
      1.5,
      "",
      "Hello, 世界 👋",
      [],
      [null, false, 0, ""],
      {},
      { title: "Draft", published: false },
      { sections: [{ heading: "Introduction", content: ["Text", { visible: true }] }] },
    ]
    const cells = values.map((value) => ({ ref: storage.cell.create(value), value }))
    const rootRef = storage.array.create(cells.map(({ ref }) => ref))
    storage.attach(rootRef)

    assert.deepEqual(
      storage.array.get(rootRef),
      cells.map(({ ref }) => ref),
    )
    for (const { ref, value } of cells) {
      assert.deepEqual(storage.cell.get(ref), value)
      assert.deepEqual(storage.cell.get(ref), value, "Repeated reads preserve values")
    }
  })

  test("attaches and reads a standalone cell", (context) => {
    const storage = createStorage(context)
    const ref = storage.cell.create("Standalone")

    assert.equal(storage.attach(ref), ref)
    assert.equal(storage.cell.get(ref), "Standalone")
  })

  test("attaches and reads an empty root array", (context) => {
    const storage = createStorage(context)
    const ref = storage.array.create([])

    assert.equal(storage.attach(ref), ref)
    assert.deepEqual(storage.array.get(ref), [])
    assert.deepEqual(storage.array.get(ref), [])
  })

  test("reads ordered mixed arrays and their nested references", (context) => {
    const storage = createStorage(context)
    const titleRef = storage.cell.create("Title")
    const bodyRef = storage.cell.create({ text: "Body" })
    const flagRef = storage.cell.create(false)
    const emptyRef = storage.array.create([])
    const leafRef = storage.array.create([bodyRef])
    const branchRef = storage.array.create([emptyRef, leafRef, flagRef])
    const rootRef = storage.array.create([titleRef, branchRef])

    assert.equal(storage.attach(rootRef), rootRef)
    assert.deepEqual(storage.array.get(rootRef), [titleRef, branchRef])
    assert.deepEqual(storage.array.get(branchRef), [emptyRef, leafRef, flagRef])
    assert.deepEqual(storage.array.get(emptyRef), [])
    assert.deepEqual(storage.array.get(leafRef), [bodyRef])
    assert.equal(storage.array.get(rootRef)[0], titleRef)
    assert.equal(storage.array.get(rootRef)[1], branchRef)
    assert.equal(storage.cell.get(titleRef), "Title")
    assert.deepEqual(storage.cell.get(bodyRef), { text: "Body" })
    assert.equal(storage.cell.get(flagRef), false)
  })

  test("creates distinct references for equal values and edits them independently", (context) => {
    const storage = createStorage(context)
    const firstRef = storage.cell.create("Same")
    const secondRef = storage.cell.create("Same")
    const firstArrayRef = storage.array.create([])
    const secondArrayRef = storage.array.create([])
    const rootRef = storage.array.create([firstRef, secondRef, firstArrayRef, secondArrayRef])
    storage.attach(rootRef)

    assert.equal(new Set([firstRef, secondRef, firstArrayRef, secondArrayRef, rootRef]).size, 5)
    storage.transact((tx) => {
      storage.cell.edit(firstRef, tx).set("Changed")
      storage.array.edit(firstArrayRef, tx).insert(0, storage.cell.create("Added"))
    })

    assert.equal(storage.cell.get(firstRef), "Changed")
    assert.equal(storage.cell.get(secondRef), "Same")
    assert.equal(storage.array.get(firstArrayRef).length, 1)
    assert.deepEqual(storage.array.get(secondArrayRef), [])
  })

  test("reads replacements inside and after transactions, including type changes", (context) => {
    const storage = createStorage(context)
    const ref = storage.cell.create("Draft")
    storage.attach(ref)
    const replacements: readonly JSONValue[] = [
      { title: "Published" },
      [1, null],
      false,
      0,
      "",
      null,
    ]

    for (const value of replacements) {
      const result = storage.transact((tx) => {
        storage.cell.edit(ref, tx).set(value)
        assert.deepEqual(storage.cell.get(ref), value)
        return value
      })

      assert.deepEqual(result, value)
      assert.deepEqual(storage.cell.get(ref), value)
    }
  })

  test("reads insertions into empty arrays and at beginning, middle, and end", (context) => {
    const storage = createStorage(context)
    const firstRef = storage.cell.create("First")
    const secondRef = storage.cell.create("Second")
    const thirdRef = storage.cell.create("Third")
    const nestedCellRef = storage.cell.create("Nested")
    const nestedRef = storage.array.create([nestedCellRef])
    const rootRef = storage.array.create([])
    storage.attach(rootRef)

    storage.transact((tx) => {
      const editor = storage.array.edit(rootRef, tx)
      editor.insert(0, secondRef)
      assert.deepEqual(storage.array.get(rootRef), [secondRef])
      editor.insert(0, firstRef)
      assert.deepEqual(storage.array.get(rootRef), [firstRef, secondRef])
      editor.insert(1, nestedRef)
      assert.deepEqual(storage.array.get(rootRef), [firstRef, nestedRef, secondRef])
      editor.insert(3, thirdRef)
      assert.deepEqual(storage.array.get(rootRef), [firstRef, nestedRef, secondRef, thirdRef])
    })

    assert.deepEqual(storage.array.get(rootRef), [firstRef, nestedRef, secondRef, thirdRef])
    assert.deepEqual(storage.array.get(nestedRef), [nestedCellRef])
    assert.equal(storage.cell.get(nestedCellRef), "Nested")
    assert.equal(storage.cell.get(firstRef), "First")
    assert.equal(storage.cell.get(secondRef), "Second")
    assert.equal(storage.cell.get(thirdRef), "Third")
  })

  test("returns callback results even when they are unrelated to stored values", (context) => {
    const storage = createStorage(context)
    const result = { status: "Done" }

    assert.equal(
      storage.transact(() => result),
      result,
    )
    assert.equal(
      storage.transact(() => 0),
      0,
    )
    assert.equal(
      storage.transact(() => undefined),
      undefined,
    )
  })

  test("propagates callback errors and permits subsequent transactions", (context) => {
    const storage = createStorage(context)
    const ref = storage.cell.create("Draft")
    storage.attach(ref)
    const error = new Error("Transaction failed")

    assert.throws(
      () =>
        storage.transact(() => {
          throw error
        }),
      (caught) => caught === error,
    )
    storage.transact((tx) => storage.cell.edit(ref, tx).set("Recovered"))

    assert.equal(storage.cell.get(ref), "Recovered")
  })
}

function createYjsStorage(context: TestContext): YjsStorage {
  const doc = new Y.Doc()
  context.after(() => doc.destroy())
  return new YjsStorage(doc)
}
