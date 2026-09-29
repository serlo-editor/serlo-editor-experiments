import assert from "node:assert/strict"
import test from "node:test"

import * as Y from "yjs"

import { FlatStorage } from "./flat.ts"
import type { Storage } from "./types.ts"
import { YjsStorage } from "./yjs.ts"

function describeEach<T>(
  cases: readonly (readonly [string, T])[],
  callback: (value: T) => void,
): void {
  for (const [name, value] of cases) {
    test.describe(name, () => callback(value))
  }
}

function registerStorageTests<CellRef, ArrayRef, TransactionContext>(
  createStorage: () => Storage<CellRef, ArrayRef, TransactionContext>,
): void {
  test("stores and reads cells and arrays", () => {
    const storage = createStorage()
    const cellRef = storage.cell.create({ title: "Draft", published: false })
    const arrayRef = storage.array.create([cellRef])

    assert.equal(storage.attach(arrayRef), arrayRef)
    assert.deepEqual(storage.cell.get(cellRef), { title: "Draft", published: false })
    assert.deepEqual(storage.array.get(arrayRef), [cellRef])
    assert.notEqual(cellRef, arrayRef)
  })

  test("edits cells inside transactions and returns callback results", () => {
    const storage = createStorage()
    const ref = storage.cell.create("Draft")
    storage.attach(ref)

    const result = storage.transact((tx) => {
      storage.cell.edit(ref, tx).set("Published")
      return storage.cell.get(ref)
    })

    assert.equal(result, "Published")
    assert.equal(storage.cell.get(ref), "Published")
  })

  test("inserts references at beginning, middle, and end of arrays", () => {
    const storage = createStorage()
    const firstRef = storage.cell.create("First")
    const secondRef = storage.cell.create("Second")
    const thirdRef = storage.cell.create("Third")
    const fourthRef = storage.cell.create("Fourth")
    const nestedArrayRef = storage.array.create([])
    const arrayRef = storage.array.create([secondRef, fourthRef])

    storage.attach(arrayRef)
    storage.transact((tx) => {
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
}

const storageImplementations = [
  ["FlatStorage", () => registerStorageTests(() => new FlatStorage())],
  ["YjsStorage", () => registerStorageTests(() => new YjsStorage(new Y.Doc()))],
] as const

describeEach(storageImplementations, (registerTests) => registerTests())
