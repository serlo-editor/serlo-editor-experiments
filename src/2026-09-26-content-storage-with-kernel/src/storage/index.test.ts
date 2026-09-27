import assert from "node:assert/strict"
import test from "node:test"

import { FlatStorage } from "./index.ts"

test.describe("FlatStorage", () => {
  test("stores and reads cells", () => {
    const storage = new FlatStorage()
    const ref = storage.cell.create({ title: "Draft", published: false })

    assert.deepEqual(storage.cell.get(ref), { title: "Draft", published: false })
  })

  test("edits cells inside mutation", () => {
    const storage = new FlatStorage()
    const ref = storage.cell.create("Draft")

    const result = storage.mutate((tx) => {
      storage.cell.edit(ref, tx).set("Published")
      return storage.cell.get(ref)
    })

    assert.equal(result, "Published")
  })

  test("inserts references into arrays inside mutation", () => {
    const storage = new FlatStorage()
    const firstRef = storage.cell.create("First")
    const secondRef = storage.cell.create("Second")
    const arrayRef = storage.array.create([firstRef])

    storage.mutate((tx) => {
      storage.array.edit(arrayRef, tx).insert(1, secondRef)
    })

    assert.deepEqual(storage.array.get(arrayRef), [firstRef, secondRef])
  })

  test("rejects mutations with invalid transactions", () => {
    const storage = new FlatStorage()
    const cellRef = storage.cell.create("value")
    const arrayRef = storage.array.create([])

    assert.throws(
      () => storage.cell.edit(cellRef, undefined as never),
      new Error("Invalid transaction."),
    )
    assert.throws(
      () => storage.array.edit(arrayRef, undefined as never),
      new Error("Invalid transaction."),
    )
  })

  test("attaches existing references and rejects unknown references", () => {
    const storage = new FlatStorage()
    const ref = storage.cell.create("value")

    assert.equal(storage.attach(ref), ref)
    assert.throws(
      () => storage.attach("node:unknown" as never),
      new Error("Reference with key node:unknown does not exist."),
    )
  })
})
