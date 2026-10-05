import { expect, test } from "bun:test"

import * as Y from "yjs"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import type { JSONValue } from "../utils/index.ts"
import { FlatNodeStore, YjsNodeStore } from "./index.ts"

describeWithStores("NodeStore", (getStore) => {
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
    nodeStore.attach(rootRef)

    expect(nodeStore.array.get(rootRef)).toEqual(cells.map(({ ref }) => ref))
    for (const { ref, value } of cells) {
      expect(nodeStore.cell.get(ref)).toEqual(value)
      expect(nodeStore.cell.get(ref)).toEqual(value, "Repeated reads preserve values")
    }
  })

  test("attaches and reads a standalone cell", () => {
    const nodeStore = getStore()
    const ref = nodeStore.cell.create("Standalone")

    expect(nodeStore.attach(ref)).toBe(ref)
    expect(nodeStore.cell.get(ref)).toBe("Standalone")
  })

  test("attaches and reads an empty root array", () => {
    const nodeStore = getStore()
    const ref = nodeStore.array.create([])

    expect(nodeStore.attach(ref)).toBe(ref)
    expect(nodeStore.array.get(ref)).toEqual([])
    expect(nodeStore.array.get(ref)).toEqual([])
  })

  test("attaches and reads an empty root map", () => {
    const nodeStore = getStore()
    const ref = nodeStore.map.create({})

    expect(nodeStore.attach(ref)).toBe(ref)
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

    expect(nodeStore.attach(rootRef)).toBe(rootRef)
    expect(nodeStore.map.get(rootRef)).toEqual(fields)
    expect(nodeStore.map.get(rootRef)).toEqual(fields, "Repeated reads preserve references")
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
    nodeStore.attach(rootRef)
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
    nodeStore.attach(rootRef)

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
    const ref = store.attach(store.map.create(fields))
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
    nodeStore.attach(rootRef)

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

    expect(nodeStore.attach(rootRef)).toBe(rootRef)
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
    nodeStore.attach(rootRef)

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
    nodeStore.attach(ref)
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
    nodeStore.attach(rootRef)

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
    nodeStore.attach(ref)
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
    expect(first.attach(ref)).toBe(ref)
    expect(() => second.attach(ref)).toThrow(`Reference with key ${ref} does not exist.`)
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

test("YjsNodeStore rejects cells missing their value", () => {
  const doc = new Y.Doc()
  const store = new YjsNodeStore(doc)
  const ref = store.attach(store.cell.create("Draft"))
  store.transact(() => ref.delete("value"))

  expect(() => store.cell.get(ref)).toThrow("Cell value absent.")
  doc.destroy()
})
