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

function registerStorageTests<CellRef, ArrayRef, MapRef, TransactionContext>(
  createStorage: (context: TestContext) => Storage<CellRef, ArrayRef, MapRef, TransactionContext>,
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

  test("attaches and reads an empty root map", (context) => {
    const storage = createStorage(context)
    const ref = storage.map.create({})

    assert.equal(storage.attach(ref), ref)
    assert.deepEqual(storage.map.get(ref), {})
    assert.deepEqual(storage.map.get(ref), {})
  })

  test("reads maps containing cells, arrays, and nested maps", (context) => {
    const storage = createStorage(context)
    const titleRef = storage.cell.create("Title")
    const bodyRef = storage.cell.create({ text: "Body" })
    const emptyRef = storage.map.create({})
    const leafRef = storage.map.create({ body: bodyRef })
    const arrayRef = storage.array.create([emptyRef, leafRef])
    const branchRef = storage.map.create({ items: arrayRef })
    const fields = { title: titleRef, branch: branchRef }
    const rootRef = storage.map.create(fields)

    assert.equal(storage.attach(rootRef), rootRef)
    assert.deepEqual(storage.map.get(rootRef), fields)
    assert.deepEqual(storage.map.get(rootRef), fields, "Repeated reads preserve references")
    assert.equal(storage.map.get(rootRef).title, titleRef)
    assert.deepEqual(storage.map.get(branchRef), { items: arrayRef })
    assert.deepEqual(storage.array.get(arrayRef), [emptyRef, leafRef])
    assert.deepEqual(storage.map.get(emptyRef), {})
    assert.deepEqual(storage.map.get(leafRef), { body: bodyRef })
    assert.equal(storage.cell.get(titleRef), "Title")
    assert.deepEqual(storage.cell.get(bodyRef), { text: "Body" })

    storage.transact((tx) => storage.cell.edit(bodyRef, tx).set("Changed"))
    assert.deepEqual(storage.map.get(leafRef), { body: bodyRef })
    assert.equal(storage.cell.get(bodyRef), "Changed")
  })

  test("sets and replaces map fields inside and after transactions", (context) => {
    const storage = createStorage(context)
    const rootRef = storage.map.create({})
    storage.attach(rootRef)
    const cellRef = storage.cell.create(false)
    const nestedCellRef = storage.cell.create("Nested")
    const arrayRef = storage.array.create([nestedCellRef])
    const mapRef = storage.map.create({})

    for (const ref of [cellRef, arrayRef, mapRef]) {
      storage.transact((tx) => {
        storage.map.edit(rootRef, tx).set("content", ref)
        assert.deepEqual(storage.map.get(rootRef), { content: ref })
      })
      assert.deepEqual(storage.map.get(rootRef), { content: ref })
    }

    const titleRef = storage.cell.create("Title")
    const flagRef = storage.cell.create(false)
    storage.transact((tx) => {
      storage.map.edit(rootRef, tx).set("title", titleRef)
      storage.map.edit(mapRef, tx).set("flag", flagRef)
      assert.deepEqual(storage.map.get(rootRef), { content: mapRef, title: titleRef })
    })
    assert.deepEqual(storage.map.get(rootRef), { content: mapRef, title: titleRef })
    assert.equal(storage.cell.get(titleRef), "Title")
    assert.deepEqual(storage.map.get(mapRef), { flag: flagRef })
    assert.equal(storage.cell.get(flagRef), false)
  })

  test("preserves empty, Unicode, and object-prototype field names", (context) => {
    const storage = createStorage(context)
    const keys = ["", "世界 👋", "__proto__", "constructor", "toString"]
    const fields = Object.fromEntries(keys.map((key) => [key, storage.cell.create(key)]))
    const rootRef = storage.map.create(fields)
    storage.attach(rootRef)

    assert.deepEqual(storage.map.get(rootRef), fields)
    const replacements = Object.fromEntries(
      keys.map((key) => [key, storage.cell.create(`Changed ${key}`)]),
    )
    storage.transact((tx) => {
      const editor = storage.map.edit(rootRef, tx)
      for (const [key, ref] of Object.entries(replacements)) {
        editor.set(key, ref)
      }
      assert.deepEqual(storage.map.get(rootRef), replacements)
    })
    assert.deepEqual(storage.map.get(rootRef), replacements)
    for (const [key, ref] of Object.entries(replacements)) {
      assert.equal(storage.cell.get(ref), `Changed ${key}`)
    }
  })

  test("inserts maps into arrays", (context) => {
    const storage = createStorage(context)
    const rootRef = storage.array.create([])
    const cellRef = storage.cell.create("Nested")
    const mapRef = storage.map.create({ content: cellRef })
    storage.attach(rootRef)

    storage.transact((tx) => {
      storage.array.edit(rootRef, tx).insert(0, mapRef)
      assert.deepEqual(storage.array.get(rootRef), [mapRef])
    })
    assert.deepEqual(storage.array.get(rootRef), [mapRef])
    assert.deepEqual(storage.map.get(mapRef), { content: cellRef })
    assert.equal(storage.cell.get(cellRef), "Nested")
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
    const firstMapRef = storage.map.create({})
    const secondMapRef = storage.map.create({})
    const refs = [firstRef, secondRef, firstArrayRef, secondArrayRef, firstMapRef, secondMapRef]
    const rootRef = storage.array.create(refs)
    storage.attach(rootRef)

    assert.equal(new Set([...refs, rootRef]).size, 7)
    storage.transact((tx) => {
      storage.cell.edit(firstRef, tx).set("Changed")
      storage.array.edit(firstArrayRef, tx).insert(0, storage.cell.create("Added"))
      storage.map.edit(firstMapRef, tx).set("added", storage.cell.create("Added"))
    })

    assert.equal(storage.cell.get(firstRef), "Changed")
    assert.equal(storage.cell.get(secondRef), "Same")
    assert.equal(storage.array.get(firstArrayRef).length, 1)
    assert.deepEqual(storage.array.get(secondArrayRef), [])
    assert.deepEqual(Object.keys(storage.map.get(firstMapRef)), ["added"])
    assert.deepEqual(storage.map.get(secondMapRef), {})
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
