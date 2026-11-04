import { expect, test } from "bun:test"

import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import type { JSONValue } from "../utils/index.ts"
import { YjsNodeStore } from "./index.ts"

test("YjsNodeStore uses store origin and groups nested transactions", () => {
  const doc = new Y.Doc()
  const store = new YjsNodeStore({ doc, awareness: new Awareness(doc) })
  const ref = store.cell.create("Initial")
  store.transact((write) => write.root.save(ref))
  const updates: unknown[] = []
  const observedValues: JSONValue[] = []
  doc.on("update", (_update, origin) => {
    updates.push(origin)
    observedValues.push(store.cell.get(ref))
  })

  const result = store.transact((tx) => {
    tx.cell.set(ref, "Outer")
    expect(
      store.transact((nestedTx) => {
        nestedTx.cell.set(ref, "Complete")
        return "nested result"
      }),
    ).toBe("nested result")
    return "outer result"
  })

  expect(result).toBe("outer result")
  expect(store.cell.get(ref)).toBe("Complete")
  expect(updates).toEqual([store])
  expect(observedValues).toEqual(["Complete"])
  doc.destroy()
})

test("YjsNodeStore syncs local edits between documents without echoing received updates", () => {
  const doc1 = new Y.Doc()
  const doc2 = new Y.Doc()
  const store1 = new YjsNodeStore({ doc: doc1, awareness: new Awareness(doc1) })
  const store2 = new YjsNodeStore({ doc: doc2, awareness: new Awareness(doc2) })
  let forwarded1 = 0
  let forwarded2 = 0

  doc1.on("update", (update, origin) => {
    if (origin != null) {
      forwarded1 += 1
      Y.applyUpdate(doc2, update)
    }
  })
  doc2.on("update", (update, origin) => {
    if (origin != null) {
      forwarded2 += 1
      Y.applyUpdate(doc1, update)
    }
  })

  const cell1 = store1.cell.create("Initial")
  const arrayCell1 = store1.cell.create("Array child")
  const objectCell1 = store1.cell.create("Object child")
  const array1 = store1.array.create([arrayCell1])
  const object1 = store1.map.create({ child: objectCell1 })
  const root1 = store1.map.create({ cell: cell1, array: array1, object: object1 })
  store1.transact((tx) => tx.root.save(root1))

  const root2 = doc2.getMap("root").get("root") as ReturnType<typeof store2.map.create>
  const cell2 = root2.get("cell") as ReturnType<typeof store2.cell.create>
  const array2 = root2.get("array") as ReturnType<typeof store2.array.create>
  const object2 = root2.get("object") as ReturnType<typeof store2.map.create>
  expect(store2.cell.get(cell2)).toBe("Initial")
  expect(
    store2.array
      .get(array2)
      .map((ref) => store2.cell.get(ref as ReturnType<typeof store2.cell.create>)),
  ).toEqual(["Array child"])
  expect(
    Object.values(store2.map.get(object2)).map((ref) =>
      store2.cell.get(ref as ReturnType<typeof store2.cell.create>),
    ),
  ).toEqual(["Object child"])
  expect(forwarded1).toBe(1)
  expect(forwarded2).toBe(0)

  store2.transact((tx) => tx.cell.set(cell2, "Changed"))
  expect(store1.cell.get(cell1)).toBe("Changed")

  const insertedCell2 = store2.cell.create("Inserted")
  store2.transact((tx) => tx.array.insert(array2, 1, insertedCell2))
  expect(
    store1.array
      .get(array1)
      .map((ref) => store1.cell.get(ref as ReturnType<typeof store1.cell.create>)),
  ).toEqual(["Array child", "Inserted"])
  store1.transact((tx) => tx.array.remove(array1, 1))
  expect(
    store2.array
      .get(array2)
      .map((ref) => store2.cell.get(ref as ReturnType<typeof store2.cell.create>)),
  ).toEqual(["Array child"])

  const objectChild1 = store1.cell.create("Object edit")
  store1.transact((tx) => tx.map.set(object1, "new", objectChild1))
  expect(
    Object.values(store2.map.get(object2)).map((ref) =>
      store2.cell.get(ref as ReturnType<typeof store2.cell.create>),
    ),
  ).toEqual(["Object child", "Object edit"])
  store2.transact((tx) => tx.map.remove(object2, "child"))
  expect(
    Object.values(store1.map.get(object1)).map((ref) =>
      store1.cell.get(ref as ReturnType<typeof store1.cell.create>),
    ),
  ).toEqual(["Object edit"])

  expect(forwarded1).toBe(3)
  expect(forwarded2).toBe(3)
  doc1.destroy()
  doc2.destroy()
})

test("YjsNodeStore revisions stay local and ignore unrelated, duplicate, and awareness updates", () => {
  const firstDoc = new Y.Doc()
  const secondDoc = new Y.Doc()
  const firstAwareness = new Awareness(firstDoc)
  const secondAwareness = new Awareness(secondDoc)
  const first = new YjsNodeStore({ doc: firstDoc, awareness: firstAwareness })
  const second = new YjsNodeStore({ doc: secondDoc, awareness: secondAwareness })
  const observed: number[] = []
  const unsubscribe = second.subscribe(() => observed.push(second.getRevision()))

  first.transact(() => {})
  const cell = first.cell.create("Initial")
  first.root.getOrCreate(() => first.map.create({ cell }))
  const update = Y.encodeStateAsUpdate(firstDoc)
  Y.applyUpdate(secondDoc, update)
  expect(second.getRevision()).toBe(1)
  expect(observed).toEqual([1])
  expect(firstDoc.share.has("storage:revisions")).toBe(false)
  expect(secondDoc.share.has("storage:revisions")).toBe(false)

  Y.applyUpdate(secondDoc, update)
  firstDoc.getMap("unrelated").set("value", 1)
  Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
  secondAwareness.setLocalStateField("user", { name: "Local" })
  expect(first.getRevision()).toBe(1)
  expect(second.getRevision()).toBe(1)
  expect(observed).toEqual([1])

  first.transact((tx) => tx.cell.set(cell, "Second"))
  first.transact((tx) => tx.cell.set(cell, "Third"))
  Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
  expect(first.getRevision()).toBe(3)
  expect(second.getRevision()).toBe(2)
  expect(observed).toEqual([1, 2])

  unsubscribe()
  first.transact((tx) => tx.cell.set(cell, "Fourth"))
  Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
  expect(second.getRevision()).toBe(3)
  expect(observed).toEqual([1, 2])

  const beforeOpening = Y.encodeStateVector(secondDoc)
  const reopened = new YjsNodeStore({ doc: secondDoc, awareness: secondAwareness })
  expect(reopened.getRevision()).toBe(0)
  reopened.root.getOrCreate(() => {
    throw new Error("Missing root.")
  })
  expect(reopened.getRevision()).toBe(0)
  expect(Y.encodeStateVector(secondDoc)).toEqual(beforeOpening)
  firstAwareness.destroy()
  secondAwareness.destroy()
  firstDoc.destroy()
  secondDoc.destroy()
})

test("YjsNodeStore rejects cells missing their value", () => {
  const doc = new Y.Doc()
  const store = new YjsNodeStore({ doc, awareness: new Awareness(doc) })
  const cellRef = store.cell.create("Draft")
  store.transact((tx) => tx.root.save(cellRef))
  store.transact(() => cellRef.delete("value"))

  expect(() => store.cell.get(cellRef)).toThrow("Cell value absent.")
  doc.destroy()
})
