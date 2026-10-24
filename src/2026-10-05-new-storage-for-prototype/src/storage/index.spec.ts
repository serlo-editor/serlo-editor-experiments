import { expect, test } from "bun:test"

import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import type { JSONValue } from "../utils/index.ts"
import { FlatNodeStore, YjsNodeStore } from "./index.ts"

describeWithStores("NodeStore", (getStore) => {
  test("increments revision after changes, even without subscribers", () => {
    const store = getStore()
    const ref = store.cell.create("Initial")
    const notifications: number[] = []
    const unsubscribe = store.subscribe(() => notifications.push(store.getRevision()))

    expect(store.getRevision()).toBe(0)
    store.transact((tx) => {
      store.root.save(ref, tx)
      expect(notifications).toEqual([])
      expect(store.getRevision()).toBe(0)
    })

    expect(store.getRevision()).toBe(1)
    expect(notifications).toEqual([1])

    unsubscribe()
    store.transact((tx) => store.cell.edit(ref, tx).set("Changed"))
    expect(store.getRevision()).toBe(2)
    expect(notifications).toEqual([1])
  })

  test("empty transactions, reads, and no-op writes leave revision unchanged", () => {
    const store = getStore()
    const cell = store.cell.create("Initial")
    const ref = store.map.create({ cell })
    store.root.getOrCreate(() => ref)
    const revision = store.getRevision()
    const notifications: number[] = []
    store.subscribe(() => notifications.push(store.getRevision()))

    store.transact(() => {})
    store.transact((tx) => {
      store.transact(() => {})
      store.cell.get(cell)
      store.map.get(ref)
      store.cell.edit(cell, tx)
      store.map.edit(ref, tx)
      store.cell.edit(cell, tx).set("Initial")
      store.map.edit(ref, tx).set("cell", cell)
      store.map.edit(ref, tx).remove("missing")
      store.root.save(ref, tx)
    })
    expect(
      store.root.getOrCreate(() => {
        throw new Error("Existing root must be preserved.")
      }),
    ).toBe(ref)

    expect(store.getRevision()).toBe(revision)
    expect(notifications).toEqual([])
  })

  test("invalidates for array edits, map edits, and root replacement", () => {
    const store = getStore()
    const items = store.array.create([])
    const root = store.map.create({ items })
    store.root.getOrCreate(() => root)
    const revision = store.getRevision()
    const notifications: number[] = []
    store.subscribe(() => notifications.push(store.getRevision()))

    const changes = [
      () =>
        store.transact((tx) => store.array.edit(items, tx).insert(0, store.cell.create("Item"))),
      () => store.transact((tx) => store.array.edit(items, tx).remove(0)),
      () =>
        store.transact((tx) => store.map.edit(root, tx).set("added", store.cell.create("Field"))),
      () => store.transact((tx) => store.map.edit(root, tx).remove("added")),
      () => store.transact((tx) => store.root.save(store.cell.create("Replacement"), tx)),
    ]
    for (const [index, change] of changes.entries()) {
      change()
      expect(store.getRevision()).toBe(revision + index + 1)
      expect(notifications).toHaveLength(index + 1)
    }
  })

  test("coalesces nested writes into one revision after the outer transaction", () => {
    const store = getStore()
    const ref = store.root.getOrCreate(() => store.cell.create("Initial"))
    const revision = store.getRevision()
    const observed: JSONValue[] = []
    store.subscribe(() => observed.push(store.cell.get(ref)))

    store.transact((tx) => {
      store.cell.edit(ref, tx).set("Outer")
      store.transact((nested) => store.cell.edit(ref, nested).set("Inner"))
      expect(store.getRevision()).toBe(revision)
      expect(observed).toEqual([])
      store.cell.edit(ref, tx).set("Final")
    })

    expect(store.getRevision()).toBe(revision + 1)
    expect(observed).toEqual(["Final"])
  })

  test("publishes partial changes when a transaction throws, but not unchanged failures", () => {
    const store = getStore()
    const ref = store.root.getOrCreate(() => store.cell.create("Initial"))
    const revision = store.getRevision()
    const observed: JSONValue[] = []
    store.subscribe(() => observed.push(store.cell.get(ref)))
    const error = new Error("Transaction failed")

    expect(() =>
      store.transact(() => {
        throw error
      }),
    ).toThrow(error)
    expect(store.getRevision()).toBe(revision)
    expect(observed).toEqual([])

    expect(() =>
      store.transact(() => {
        store.transact((nested) => store.cell.edit(ref, nested).set("Changed"))
        expect(observed).toEqual([])
        throw error
      }),
    ).toThrow(error)
    expect(store.getRevision()).toBe(revision + 1)
    expect(observed).toEqual(["Changed"])

    store.transact((tx) => store.cell.edit(ref, tx).set("Recovered"))
    expect(store.getRevision()).toBe(revision + 2)
    expect(observed).toEqual(["Changed", "Recovered"])
  })

  test("initializes the root lazily and publishes only after it is saved", () => {
    const store = getStore()
    const ref = store.cell.create("Initial")
    let calls = 0
    let notifications = 0
    store.subscribe(() => {
      notifications += 1
      expect(store.cell.get(ref)).toBe("Initial")
    })

    expect(
      store.root.getOrCreate(() => {
        calls += 1
        expect(notifications).toBe(0)
        return ref
      }),
    ).toBe(ref)
    expect(notifications).toBe(1)
    expect(
      store.root.getOrCreate(() => {
        calls += 1
        throw new Error("Initializer must not run twice.")
      }),
    ).toBe(ref)
    expect(calls).toBe(1)
    expect(notifications).toBe(1)
  })

  test("getOrCreate returns a root saved explicitly without running the initializer", () => {
    const store = getStore()
    const first = store.cell.create("First")
    const replacement = store.cell.create("Replacement")
    store.root.getOrCreate(() => first)
    store.transact((tx) => store.root.save(replacement, tx))

    expect(
      store.root.getOrCreate(() => {
        throw new Error("Existing root must be preserved.")
      }),
    ).toBe(replacement)
  })

  test("permits retrying root initialization after an initializer throws", () => {
    const store = getStore()
    const error = new Error("Initialization failed")
    expect(() =>
      store.root.getOrCreate(() => {
        throw error
      }),
    ).toThrow(error)

    const ref = store.cell.create("Recovered")
    expect(store.root.getOrCreate(() => ref)).toBe(ref)
    expect(store.cell.get(ref)).toBe("Recovered")
  })

  test("reads every JSON value kind without losing empty or falsy values", () => {
    const nodeStore = getStore()
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
    const cells = values.map((value) => ({ ref: nodeStore.cell.create(value), value }))
    const rootRef = nodeStore.array.create(cells.map(({ ref }) => ref))
    nodeStore.transact((tx) => nodeStore.root.save(rootRef, tx))

    expect(nodeStore.array.get(rootRef)).toEqual(cells.map(({ ref }) => ref))
    for (const { ref, value } of cells) {
      expect(nodeStore.cell.get(ref)).toEqual(value)
      expect(nodeStore.cell.get(ref), "Repeated reads preserve values").toEqual(value)
    }
  })

  test("attaches and reads a standalone cell", () => {
    const nodeStore = getStore()
    const ref = nodeStore.cell.create("Standalone")

    expect(ref).toBe(nodeStore.transact((tx) => nodeStore.root.save(ref, tx)))
    expect(nodeStore.cell.get(ref)).toBe("Standalone")
  })

  test("rejects attach and editors with an expired transaction", () => {
    const nodeStore = getStore()
    const cell = nodeStore.cell.create("Standalone")
    const array = nodeStore.array.create([])
    const map = nodeStore.map.create({})
    const expired = nodeStore.transact((tx) => tx)

    expect(() => nodeStore.root.save(cell, expired)).toThrow("Invalid transaction.")
    expect(() => nodeStore.cell.edit(cell, expired)).toThrow("Invalid transaction.")
    expect(() => nodeStore.array.edit(array, expired)).toThrow("Invalid transaction.")
    expect(() => nodeStore.map.edit(map, expired)).toThrow("Invalid transaction.")
  })

  test("attaches and reads an empty root array", () => {
    const nodeStore = getStore()
    const ref = nodeStore.array.create([])

    expect(ref).toBe(nodeStore.transact((tx) => nodeStore.root.save(ref, tx)))
    expect(nodeStore.array.get(ref)).toEqual([])
    expect(nodeStore.array.get(ref)).toEqual([])
  })

  test("attaches and reads an empty root map", () => {
    const nodeStore = getStore()
    const ref = nodeStore.map.create({})

    expect(ref).toBe(nodeStore.transact((tx) => nodeStore.root.save(ref, tx)))
    expect(nodeStore.map.get(ref)).toEqual({})
    expect(nodeStore.map.get(ref)).toEqual({})
  })

  test("reads maps containing cells, arrays, and nested maps", () => {
    const nodeStore = getStore()
    const titleRef = nodeStore.cell.create("Title")
    const bodyRef = nodeStore.cell.create({ text: "Body" })
    const emptyRef = nodeStore.map.create({})
    const leafRef = nodeStore.map.create({ body: bodyRef })
    const arrayRef = nodeStore.array.create([emptyRef, leafRef])
    const branchRef = nodeStore.map.create({ items: arrayRef })
    const fields = { title: titleRef, branch: branchRef }
    const rootRef = nodeStore.map.create(fields)

    expect(rootRef).toBe(nodeStore.transact((tx) => nodeStore.root.save(rootRef, tx)))
    expect(nodeStore.map.get(rootRef)).toEqual(fields)
    expect(nodeStore.map.get(rootRef), "Repeated reads preserve references").toEqual(fields)
    expect(nodeStore.map.get(rootRef).title).toBe(titleRef)
    expect(nodeStore.map.get(branchRef)).toEqual({ items: arrayRef })
    expect(nodeStore.array.get(arrayRef)).toEqual([emptyRef, leafRef])
    expect(nodeStore.map.get(emptyRef)).toEqual({})
    expect(nodeStore.map.get(leafRef)).toEqual({ body: bodyRef })
    expect(nodeStore.cell.get(titleRef)).toBe("Title")
    expect(nodeStore.cell.get(bodyRef)).toEqual({ text: "Body" })

    nodeStore.transact((tx) => nodeStore.cell.edit(bodyRef, tx).set({ text: "Changed" }))
    expect(nodeStore.map.get(leafRef)).toEqual({ body: bodyRef })
    expect(nodeStore.cell.get(bodyRef)).toEqual({ text: "Changed" })
  })

  test("sets and replaces map fields inside and after transactions", () => {
    const nodeStore = getStore()
    const rootRef = nodeStore.map.create({})
    nodeStore.transact((tx) => nodeStore.root.save(rootRef, tx))
    const cellRef = nodeStore.cell.create(false)
    const nestedCellRef = nodeStore.cell.create("Nested")
    const arrayRef = nodeStore.array.create([nestedCellRef])
    const mapRef = nodeStore.map.create({})

    for (const ref of [cellRef, arrayRef, mapRef]) {
      nodeStore.transact((tx) => {
        nodeStore.map.edit(rootRef, tx).set("content", ref)
        expect(nodeStore.map.get(rootRef)).toEqual({ content: ref })
      })
      expect(nodeStore.map.get(rootRef)).toEqual({ content: ref })
    }

    const titleRef = nodeStore.cell.create("Title")
    const flagRef = nodeStore.cell.create(false)
    nodeStore.transact((tx) => {
      nodeStore.map.edit(rootRef, tx).set("title", titleRef)
      nodeStore.map.edit(mapRef, tx).set("flag", flagRef)
      expect(nodeStore.map.get(rootRef)).toEqual({ content: mapRef, title: titleRef })
    })
    expect(nodeStore.map.get(rootRef)).toEqual({ content: mapRef, title: titleRef })
    expect(nodeStore.cell.get(titleRef)).toBe("Title")
    expect(nodeStore.map.get(mapRef)).toEqual({ flag: flagRef })
    expect(nodeStore.cell.get(flagRef)).toBe(false)
  })

  test("preserves empty, Unicode, and object-prototype field names", () => {
    const nodeStore = getStore()
    const keys = ["", "世界 👋", "__proto__", "constructor", "toString"]
    const fields = Object.fromEntries(keys.map((key) => [key, nodeStore.cell.create(key)]))
    const rootRef = nodeStore.map.create(fields)
    nodeStore.transact((tx) => nodeStore.root.save(rootRef, tx))

    expect(nodeStore.map.get(rootRef)).toEqual(fields)
    const replacements = Object.fromEntries(
      keys.map((key) => [key, nodeStore.cell.create(`Changed ${key}`)]),
    )
    nodeStore.transact((tx) => {
      const editor = nodeStore.map.edit(rootRef, tx)
      for (const [key, ref] of Object.entries(replacements)) {
        editor.set(key, ref)
      }
      expect(nodeStore.map.get(rootRef)).toEqual(replacements)
    })
    expect(nodeStore.map.get(rootRef)).toEqual(replacements)
    for (const [key, ref] of Object.entries(replacements)) {
      expect(nodeStore.cell.get(ref)).toBe(`Changed ${key}`)
    }
  })

  test("removes map fields idempotently without mutating previous reads", () => {
    const store = getStore()
    const keys = ["", "世界 👋", "__proto__", "constructor", "toString"]
    const fields = Object.fromEntries(keys.map((key) => [key, store.cell.create(key)]))
    const ref = store.transact((tx) => store.root.save(store.map.create(fields), tx))
    const previous = store.map.get(ref)
    store.transact((tx) => {
      const editor = store.map.edit(ref, tx)
      for (const key of keys) {
        editor.remove(key)
        editor.remove(key)
        expect(Object.hasOwn(store.map.get(ref), key)).toBe(false)
      }
      editor.remove("missing")
      expect(store.map.get(ref)).toEqual({})
    })
    expect(store.map.get(ref)).toEqual({})
    expect(previous).toEqual(fields)

    const child = store.cell.create("Again")
    store.transact((tx) => store.map.edit(ref, tx).set("__proto__", child))
    expect(store.map.get(ref)).toEqual({ ["__proto__"]: child })
  })

  test("inserts maps into arrays", () => {
    const nodeStore = getStore()
    const rootRef = nodeStore.array.create([])
    const cellRef = nodeStore.cell.create("Nested")
    const mapRef = nodeStore.map.create({ content: cellRef })
    nodeStore.transact((tx) => nodeStore.root.save(rootRef, tx))

    nodeStore.transact((tx) => {
      nodeStore.array.edit(rootRef, tx).insert(0, mapRef)
      expect(nodeStore.array.get(rootRef)).toEqual([mapRef])
    })
    expect(nodeStore.array.get(rootRef)).toEqual([mapRef])
    expect(nodeStore.map.get(mapRef)).toEqual({ content: cellRef })
    expect(nodeStore.cell.get(cellRef)).toBe("Nested")
  })

  test("reads ordered mixed arrays and their nested references", () => {
    const nodeStore = getStore()
    const titleRef = nodeStore.cell.create("Title")
    const bodyRef = nodeStore.cell.create({ text: "Body" })
    const flagRef = nodeStore.cell.create(false)
    const emptyRef = nodeStore.array.create([])
    const leafRef = nodeStore.array.create([bodyRef])
    const branchRef = nodeStore.array.create([emptyRef, leafRef, flagRef])
    const rootRef = nodeStore.array.create([titleRef, branchRef])

    expect(rootRef).toBe(nodeStore.transact((tx) => nodeStore.root.save(rootRef, tx)))
    expect(nodeStore.array.get(rootRef)).toEqual([titleRef, branchRef])
    expect(nodeStore.array.get(branchRef)).toEqual([emptyRef, leafRef, flagRef])
    expect(nodeStore.array.get(emptyRef)).toEqual([])
    expect(nodeStore.array.get(leafRef)).toEqual([bodyRef])
    expect(nodeStore.array.get(rootRef)[0]).toBe(titleRef)
    expect(nodeStore.array.get(rootRef)[1]).toBe(branchRef)
    expect(nodeStore.cell.get(titleRef)).toBe("Title")
    expect(nodeStore.cell.get(bodyRef)).toEqual({ text: "Body" })
    expect(nodeStore.cell.get(flagRef)).toBe(false)
  })

  test("creates distinct references for equal values and edits them independently", () => {
    const nodeStore = getStore()
    const firstRef = nodeStore.cell.create("Same")
    const secondRef = nodeStore.cell.create("Same")
    const firstArrayRef = nodeStore.array.create([])
    const secondArrayRef = nodeStore.array.create([])
    const firstMapRef = nodeStore.map.create({})
    const secondMapRef = nodeStore.map.create({})
    const refs = [firstRef, secondRef, firstArrayRef, secondArrayRef, firstMapRef, secondMapRef]
    const rootRef = nodeStore.array.create(refs)
    nodeStore.transact((tx) => nodeStore.root.save(rootRef, tx))

    expect(new Set([...refs, rootRef]).size).toBe(7)
    nodeStore.transact((tx) => {
      nodeStore.cell.edit(firstRef, tx).set("Changed")
      nodeStore.array.edit(firstArrayRef, tx).insert(0, nodeStore.cell.create("Added"))
      nodeStore.map.edit(firstMapRef, tx).set("added", nodeStore.cell.create("Added"))
    })

    expect(nodeStore.cell.get(firstRef)).toBe("Changed")
    expect(nodeStore.cell.get(secondRef)).toBe("Same")
    expect(nodeStore.array.get(firstArrayRef).length).toBe(1)
    expect(nodeStore.array.get(secondArrayRef)).toEqual([])
    expect(Object.keys(nodeStore.map.get(firstMapRef))).toEqual(["added"])
    expect(nodeStore.map.get(secondMapRef)).toEqual({})
  })

  test("reads replacements inside and after transactions, including type changes", () => {
    const nodeStore = getStore()
    const ref = nodeStore.cell.create("Draft")
    nodeStore.transact((tx) => nodeStore.root.save(ref, tx))
    const replacements: readonly JSONValue[] = [
      { title: "Published" },
      [1, null],
      false,
      0,
      "",
      null,
    ]

    for (const value of replacements) {
      const result = nodeStore.transact((tx) => {
        nodeStore.cell.edit(ref, tx).set(value)
        expect(nodeStore.cell.get(ref)).toEqual(value)
        return value
      })

      expect(result).toEqual(value)
      expect(nodeStore.cell.get(ref)).toEqual(value)
    }
  })

  test("reads insertions into empty arrays and at beginning, middle, and end", () => {
    const nodeStore = getStore()
    const firstRef = nodeStore.cell.create("First")
    const secondRef = nodeStore.cell.create("Second")
    const thirdRef = nodeStore.cell.create("Third")
    const nestedCellRef = nodeStore.cell.create("Nested")
    const nestedRef = nodeStore.array.create([nestedCellRef])
    const rootRef = nodeStore.array.create([])
    nodeStore.transact((tx) => nodeStore.root.save(rootRef, tx))

    nodeStore.transact((tx) => {
      const editor = nodeStore.array.edit(rootRef, tx)
      editor.insert(0, secondRef)
      expect(nodeStore.array.get(rootRef)).toEqual([secondRef])
      editor.insert(0, firstRef)
      expect(nodeStore.array.get(rootRef)).toEqual([firstRef, secondRef])
      editor.insert(1, nestedRef)
      expect(nodeStore.array.get(rootRef)).toEqual([firstRef, nestedRef, secondRef])
      editor.insert(3, thirdRef)
      expect(nodeStore.array.get(rootRef)).toEqual([firstRef, nestedRef, secondRef, thirdRef])
    })

    expect(nodeStore.array.get(rootRef)).toEqual([firstRef, nestedRef, secondRef, thirdRef])
    expect(nodeStore.array.get(nestedRef)).toEqual([nestedCellRef])
    expect(nodeStore.cell.get(nestedCellRef)).toBe("Nested")
    expect(nodeStore.cell.get(firstRef)).toBe("First")
    expect(nodeStore.cell.get(secondRef)).toBe("Second")
    expect(nodeStore.cell.get(thirdRef)).toBe("Third")
  })

  test("returns callback results even when they are unrelated to stored values", () => {
    const nodeStore = getStore()
    const result = { status: "Done" }

    expect(nodeStore.transact(() => result)).toBe(result)
    expect(nodeStore.transact(() => 0)).toBe(0)
    expect(nodeStore.transact(() => undefined)).toBe(undefined)
  })

  test("propagates callback errors and permits subsequent transactions", () => {
    const nodeStore = getStore()
    const ref = nodeStore.cell.create("Draft")
    nodeStore.transact((tx) => nodeStore.root.save(ref, tx))
    const error = new Error("Transaction failed")

    let caught: unknown
    try {
      nodeStore.transact(() => {
        throw error
      })
    } catch (thrown) {
      caught = thrown
    }
    expect(caught).toBe(error)
    nodeStore.transact((tx) => nodeStore.cell.edit(ref, tx).set("Recovered"))

    expect(nodeStore.cell.get(ref)).toBe("Recovered")
  })
})

test("FlatNodeStore keeps references distinct across stores and node kinds", () => {
  const first = new FlatNodeStore()
  const second = new FlatNodeStore()
  const firstRefs = [first.cell.create(null), first.array.create([]), first.map.create({})]
  const secondRefs = [second.cell.create(null), second.array.create([]), second.map.create({})]

  expect(new Set([...firstRefs, ...secondRefs]).size).toBe(6)
  for (const ref of firstRefs) {
    expect(ref).toBe(first.transact((tx) => first.root.save(ref, tx)))
    expect(() => second.transact((tx) => second.root.save(ref, tx))).toThrow(
      `Reference with key ${ref} does not exist.`,
    )
  }
})

test("FlatNodeStore editors require an active transaction from their own store", () => {
  const store = new FlatNodeStore()
  const cell = store.cell.create(null)
  const array = store.array.create([])
  const map = store.map.create({})
  const checkEditors = (tx: Parameters<typeof store.cell.edit>[1], valid: boolean) => {
    for (const edit of [
      () => store.cell.edit(cell, tx),
      () => store.array.edit(array, tx),
      () => store.map.edit(map, tx),
    ]) {
      if (valid) {
        expect(edit).not.toThrow()
      } else {
        expect(edit).toThrow("Invalid transaction.")
      }
    }
  }

  const expired = store.transact((tx) => {
    checkEditors(tx, true)
    store.transact((nested) => {
      checkEditors(tx, true)
      checkEditors(nested, true)
    })
    checkEditors(tx, true)
    return tx
  })
  checkEditors(expired, false)
  new FlatNodeStore().transact((tx) => checkEditors(tx, false))

  let failed = expired
  expect(() =>
    store.transact((tx) => {
      failed = tx
      throw new Error("Transaction failed")
    }),
  ).toThrow()
  checkEditors(failed, false)
})

test("YjsNodeStore uses store origin and groups nested transactions", () => {
  const doc = new Y.Doc()
  const store = new YjsNodeStore({ doc, awareness: new Awareness(doc) })
  const ref = store.cell.create("Initial")
  store.transact((tx) => store.root.save(ref, tx))
  const updates: unknown[] = []
  const observedValues: JSONValue[] = []
  doc.on("update", (_update, origin) => {
    updates.push(origin)
    observedValues.push(store.cell.get(ref))
  })

  const result = store.transact((tx) => {
    store.cell.edit(ref, tx).set("Outer")
    expect(
      store.transact((nestedTx) => {
        store.cell.edit(ref, nestedTx).set("Complete")
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
  store1.transact((tx) => store1.root.save(root1, tx))

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

  store2.transact((tx) => store2.cell.edit(cell2, tx).set("Changed"))
  expect(store1.cell.get(cell1)).toBe("Changed")

  const insertedCell2 = store2.cell.create("Inserted")
  store2.transact((tx) => store2.array.edit(array2, tx).insert(1, insertedCell2))
  expect(
    store1.array
      .get(array1)
      .map((ref) => store1.cell.get(ref as ReturnType<typeof store1.cell.create>)),
  ).toEqual(["Array child", "Inserted"])
  store1.transact((tx) => store1.array.edit(array1, tx).remove(1))
  expect(
    store2.array
      .get(array2)
      .map((ref) => store2.cell.get(ref as ReturnType<typeof store2.cell.create>)),
  ).toEqual(["Array child"])

  const objectChild1 = store1.cell.create("Object edit")
  store1.transact((tx) => store1.map.edit(object1, tx).set("new", objectChild1))
  expect(
    Object.values(store2.map.get(object2)).map((ref) =>
      store2.cell.get(ref as ReturnType<typeof store2.cell.create>),
    ),
  ).toEqual(["Object child", "Object edit"])
  store2.transact((tx) => store2.map.edit(object2, tx).remove("child"))
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

  first.transact((tx) => first.cell.edit(cell, tx).set("Second"))
  first.transact((tx) => first.cell.edit(cell, tx).set("Third"))
  Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
  expect(first.getRevision()).toBe(3)
  expect(second.getRevision()).toBe(2)
  expect(observed).toEqual([1, 2])

  unsubscribe()
  first.transact((tx) => first.cell.edit(cell, tx).set("Fourth"))
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
  store.transact((tx) => store.root.save(cellRef, tx))
  store.transact(() => cellRef.delete("value"))

  expect(() => store.cell.get(cellRef)).toThrow("Cell value absent.")
  doc.destroy()
})
