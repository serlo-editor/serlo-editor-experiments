import assert from "node:assert/strict"
import test from "node:test"

import * as Y from "yjs"

import { FlatStorage } from "./index.ts"
import { YjsStorage } from "./yjs.ts"

test.describe("FlatStorage", () => {
  test("stores and reads cells and arrays", () => {
    const storage = new FlatStorage()
    const cellRef = storage.cell.create({ title: "Draft", published: false })
    const arrayRef = storage.array.create([cellRef])

    assert.deepEqual(storage.cell.get(cellRef), { title: "Draft", published: false })
    assert.deepEqual(storage.array.get(arrayRef), [cellRef])
    assert.notEqual(cellRef, arrayRef)
  })

  test("edits cells inside mutation and returns mutation result", () => {
    const storage = new FlatStorage()
    const ref = storage.cell.create("Draft")

    const result = storage.mutate((tx) => {
      storage.cell.edit(ref, tx).set("Published")
      return storage.cell.get(ref)
    })

    assert.equal(result, "Published")
  })

  test("inserts references at beginning, middle, and end of arrays", () => {
    const storage = new FlatStorage()
    const firstRef = storage.cell.create("First")
    const secondRef = storage.cell.create("Second")
    const thirdRef = storage.cell.create("Third")
    const fourthRef = storage.cell.create("Fourth")
    const nestedArrayRef = storage.array.create([])
    const arrayRef = storage.array.create([secondRef, fourthRef])

    storage.mutate((tx) => {
      const array = storage.array.edit(arrayRef, tx)
      array.insert(0, firstRef)
      array.insert(2, thirdRef)
      array.insert(4, nestedArrayRef)
    })

    assert.deepEqual(storage.array.get(arrayRef), [
      firstRef,
      secondRef,
      thirdRef,
      fourthRef,
      nestedArrayRef,
    ])
  })

  test("rejects mutations without active transaction from owning storage", () => {
    const storage = new FlatStorage()
    const otherStorage = new FlatStorage()
    const cellRef = storage.cell.create("value")
    const arrayRef = storage.array.create([])
    let escapedEdit = () => {}

    assert.throws(
      () => storage.cell.edit(cellRef, undefined as never),
      new Error("Invalid transaction."),
    )
    assert.throws(
      () => storage.array.edit(arrayRef, undefined as never),
      new Error("Invalid transaction."),
    )

    storage.mutate((tx) => {
      escapedEdit = () => storage.cell.edit(cellRef, tx).set("changed")
    })
    assert.throws(escapedEdit, new Error("Invalid transaction."))

    otherStorage.mutate((tx) => {
      assert.throws(() => storage.cell.edit(cellRef, tx), new Error("Invalid transaction."))
    })
  })

  test("cleans up transaction after mutation throws", () => {
    const storage = new FlatStorage()
    const cellRef = storage.cell.create("value")
    let escapedEdit = () => {}

    assert.throws(
      () =>
        storage.mutate((tx) => {
          escapedEdit = () => storage.cell.edit(cellRef, tx).set("changed")
          throw new Error("Mutation failed.")
        }),
      new Error("Mutation failed."),
    )
    assert.throws(escapedEdit, new Error("Invalid transaction."))
  })

  test("rejects missing and wrong-kind references", () => {
    const storage = new FlatStorage()
    const cellRef = storage.cell.create("value")
    const arrayRef = storage.array.create([])

    assert.throws(
      () => storage.cell.get("node:unknown" as never),
      new Error("Value with key node:unknown does not exist."),
    )
    assert.throws(
      () => storage.array.get(cellRef as never),
      new Error(`Value with key ${cellRef} does not exist.`),
    )
    assert.throws(
      () => storage.cell.get(arrayRef as never),
      new Error(`Value with key ${arrayRef} does not exist.`),
    )
  })

  test("attaches own references and rejects unknown or foreign references", () => {
    const storage = new FlatStorage()
    const otherStorage = new FlatStorage()
    const cellRef = storage.cell.create("value")
    const arrayRef = storage.array.create([])
    const foreignRef = otherStorage.cell.create("other value")

    assert.equal(storage.attach(cellRef), cellRef)
    assert.equal(storage.attach(arrayRef), arrayRef)
    assert.throws(
      () => storage.attach("node:unknown" as never),
      new Error("Reference with key node:unknown does not exist."),
    )
    assert.throws(
      () => storage.attach(foreignRef),
      new Error(`Reference with key ${foreignRef} does not exist.`),
    )
  })
})

test.describe("YjsStorage", () => {
  test("stores and reads cells and arrays", () => {
    const storage = new YjsStorage(new Y.Doc())
    const cellRef = storage.cell.create({ title: "Draft", published: false })
    const arrayRef = storage.array.create([cellRef])
    storage.attach(arrayRef)

    assert.deepEqual(storage.cell.get(cellRef), { title: "Draft", published: false })
    assert.deepEqual(storage.array.get(arrayRef), [cellRef])
    assert.notEqual(cellRef, arrayRef)
  })
})
