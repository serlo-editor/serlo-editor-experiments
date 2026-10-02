import assert from "node:assert/strict"
import test from "node:test"
import type { TestContext } from "node:test"

import * as Y from "yjs"

import type { JSONValue } from "../utils/index.ts"
import { FlatNodeStore } from "./flat.ts"
import type { NodeRefsByKind, NodeStore } from "./types.ts"
import { YjsNodeStore } from "./yjs.ts"

const nodeStoreImplementations = [
  ["FlatNodeStore", () => registerNodeStoreTests(() => new FlatNodeStore())],
  ["YjsNodeStore", () => registerNodeStoreTests(createYjsNodeStore)],
] as const

describeEach(nodeStoreImplementations, (registerTests) => registerTests())

// node:test has no built-in describe.each.
function describeEach<T>(
  cases: readonly (readonly [string, T])[],
  callback: (value: T) => void,
): void {
  for (const [name, value] of cases) {
    test.describe(name, () => callback(value))
  }
}

function registerNodeStoreTests<Refs extends NodeRefsByKind, TransactionContext>(
  createNodeStore: (context: TestContext) => NodeStore<Refs, TransactionContext>,
): void {
  test("reads every JSON value kind without losing empty or falsy values", (context) => {
    const nodeStore = createNodeStore(context)
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

    assert.deepEqual(
      nodeStore.array.get(rootRef),
      cells.map(({ ref }) => ref),
    )
    for (const { ref, value } of cells) {
      assert.deepEqual(nodeStore.cell.get(ref), value)
      assert.deepEqual(nodeStore.cell.get(ref), value, "Repeated reads preserve values")
    }
  })

  test("attaches and reads a standalone cell", (context) => {
    const nodeStore = createNodeStore(context)
    const ref = nodeStore.cell.create("Standalone")

    assert.equal(nodeStore.attach(ref), ref)
    assert.equal(nodeStore.cell.get(ref), "Standalone")
  })

  test("attaches and reads an empty root array", (context) => {
    const nodeStore = createNodeStore(context)
    const ref = nodeStore.array.create([])

    assert.equal(nodeStore.attach(ref), ref)
    assert.deepEqual(nodeStore.array.get(ref), [])
    assert.deepEqual(nodeStore.array.get(ref), [])
  })

  test("attaches and reads an empty root map", (context) => {
    const nodeStore = createNodeStore(context)
    const ref = nodeStore.map.create({})

    assert.equal(nodeStore.attach(ref), ref)
    assert.deepEqual(nodeStore.map.get(ref), {})
    assert.deepEqual(nodeStore.map.get(ref), {})
  })

  test("reads maps containing cells, arrays, and nested maps", (context) => {
    const nodeStore = createNodeStore(context)
    const titleRef = nodeStore.cell.create("Title")
    const bodyRef = nodeStore.cell.create({ text: "Body" })
    const emptyRef = nodeStore.map.create({})
    const leafRef = nodeStore.map.create({ body: bodyRef })
    const arrayRef = nodeStore.array.create([emptyRef, leafRef])
    const branchRef = nodeStore.map.create({ items: arrayRef })
    const fields = { title: titleRef, branch: branchRef }
    const rootRef = nodeStore.map.create(fields)

    assert.equal(nodeStore.attach(rootRef), rootRef)
    assert.deepEqual(nodeStore.map.get(rootRef), fields)
    assert.deepEqual(nodeStore.map.get(rootRef), fields, "Repeated reads preserve references")
    assert.equal(nodeStore.map.get(rootRef).title, titleRef)
    assert.deepEqual(nodeStore.map.get(branchRef), { items: arrayRef })
    assert.deepEqual(nodeStore.array.get(arrayRef), [emptyRef, leafRef])
    assert.deepEqual(nodeStore.map.get(emptyRef), {})
    assert.deepEqual(nodeStore.map.get(leafRef), { body: bodyRef })
    assert.equal(nodeStore.cell.get(titleRef), "Title")
    assert.deepEqual(nodeStore.cell.get(bodyRef), { text: "Body" })

    nodeStore.transact((tx) => nodeStore.cell.edit(bodyRef, tx).set({ text: "Changed" }))
    assert.deepEqual(nodeStore.map.get(leafRef), { body: bodyRef })
    assert.deepEqual(nodeStore.cell.get(bodyRef), { text: "Changed" })
  })

  test("sets and replaces map fields inside and after transactions", (context) => {
    const nodeStore = createNodeStore(context)
    const rootRef = nodeStore.map.create({})
    nodeStore.attach(rootRef)
    const cellRef = nodeStore.cell.create(false)
    const nestedCellRef = nodeStore.cell.create("Nested")
    const arrayRef = nodeStore.array.create([nestedCellRef])
    const mapRef = nodeStore.map.create({})

    for (const ref of [cellRef, arrayRef, mapRef]) {
      nodeStore.transact((tx) => {
        nodeStore.map.edit(rootRef, tx).set("content", ref)
        assert.deepEqual(nodeStore.map.get(rootRef), { content: ref })
      })
      assert.deepEqual(nodeStore.map.get(rootRef), { content: ref })
    }

    const titleRef = nodeStore.cell.create("Title")
    const flagRef = nodeStore.cell.create(false)
    nodeStore.transact((tx) => {
      nodeStore.map.edit(rootRef, tx).set("title", titleRef)
      nodeStore.map.edit(mapRef, tx).set("flag", flagRef)
      assert.deepEqual(nodeStore.map.get(rootRef), { content: mapRef, title: titleRef })
    })
    assert.deepEqual(nodeStore.map.get(rootRef), { content: mapRef, title: titleRef })
    assert.equal(nodeStore.cell.get(titleRef), "Title")
    assert.deepEqual(nodeStore.map.get(mapRef), { flag: flagRef })
    assert.equal(nodeStore.cell.get(flagRef), false)
  })

  test("preserves empty, Unicode, and object-prototype field names", (context) => {
    const nodeStore = createNodeStore(context)
    const keys = ["", "世界 👋", "__proto__", "constructor", "toString"]
    const fields = Object.fromEntries(keys.map((key) => [key, nodeStore.cell.create(key)]))
    const rootRef = nodeStore.map.create(fields)
    nodeStore.attach(rootRef)

    assert.deepEqual(nodeStore.map.get(rootRef), fields)
    const replacements = Object.fromEntries(
      keys.map((key) => [key, nodeStore.cell.create(`Changed ${key}`)]),
    )
    nodeStore.transact((tx) => {
      const editor = nodeStore.map.edit(rootRef, tx)
      for (const [key, ref] of Object.entries(replacements)) {
        editor.set(key, ref)
      }
      assert.deepEqual(nodeStore.map.get(rootRef), replacements)
    })
    assert.deepEqual(nodeStore.map.get(rootRef), replacements)
    for (const [key, ref] of Object.entries(replacements)) {
      assert.equal(nodeStore.cell.get(ref), `Changed ${key}`)
    }
  })

  test("inserts maps into arrays", (context) => {
    const nodeStore = createNodeStore(context)
    const rootRef = nodeStore.array.create([])
    const cellRef = nodeStore.cell.create("Nested")
    const mapRef = nodeStore.map.create({ content: cellRef })
    nodeStore.attach(rootRef)

    nodeStore.transact((tx) => {
      nodeStore.array.edit(rootRef, tx).insert(0, mapRef)
      assert.deepEqual(nodeStore.array.get(rootRef), [mapRef])
    })
    assert.deepEqual(nodeStore.array.get(rootRef), [mapRef])
    assert.deepEqual(nodeStore.map.get(mapRef), { content: cellRef })
    assert.equal(nodeStore.cell.get(cellRef), "Nested")
  })

  test("reads ordered mixed arrays and their nested references", (context) => {
    const nodeStore = createNodeStore(context)
    const titleRef = nodeStore.cell.create("Title")
    const bodyRef = nodeStore.cell.create({ text: "Body" })
    const flagRef = nodeStore.cell.create(false)
    const emptyRef = nodeStore.array.create([])
    const leafRef = nodeStore.array.create([bodyRef])
    const branchRef = nodeStore.array.create([emptyRef, leafRef, flagRef])
    const rootRef = nodeStore.array.create([titleRef, branchRef])

    assert.equal(nodeStore.attach(rootRef), rootRef)
    assert.deepEqual(nodeStore.array.get(rootRef), [titleRef, branchRef])
    assert.deepEqual(nodeStore.array.get(branchRef), [emptyRef, leafRef, flagRef])
    assert.deepEqual(nodeStore.array.get(emptyRef), [])
    assert.deepEqual(nodeStore.array.get(leafRef), [bodyRef])
    assert.equal(nodeStore.array.get(rootRef)[0], titleRef)
    assert.equal(nodeStore.array.get(rootRef)[1], branchRef)
    assert.equal(nodeStore.cell.get(titleRef), "Title")
    assert.deepEqual(nodeStore.cell.get(bodyRef), { text: "Body" })
    assert.equal(nodeStore.cell.get(flagRef), false)
  })

  test("creates distinct references for equal values and edits them independently", (context) => {
    const nodeStore = createNodeStore(context)
    const firstRef = nodeStore.cell.create("Same" as string)
    const secondRef = nodeStore.cell.create("Same")
    const firstArrayRef = nodeStore.array.create([])
    const secondArrayRef = nodeStore.array.create([])
    const firstMapRef = nodeStore.map.create({})
    const secondMapRef = nodeStore.map.create({})
    const refs = [firstRef, secondRef, firstArrayRef, secondArrayRef, firstMapRef, secondMapRef]
    const rootRef = nodeStore.array.create(refs)
    nodeStore.attach(rootRef)

    assert.equal(new Set([...refs, rootRef]).size, 7)
    nodeStore.transact((tx) => {
      nodeStore.cell.edit(firstRef, tx).set("Changed")
      nodeStore.array.edit(firstArrayRef, tx).insert(0, nodeStore.cell.create("Added"))
      nodeStore.map.edit(firstMapRef, tx).set("added", nodeStore.cell.create("Added"))
    })

    assert.equal(nodeStore.cell.get(firstRef), "Changed")
    assert.equal(nodeStore.cell.get(secondRef), "Same")
    assert.equal(nodeStore.array.get(firstArrayRef).length, 1)
    assert.deepEqual(nodeStore.array.get(secondArrayRef), [])
    assert.deepEqual(Object.keys(nodeStore.map.get(firstMapRef)), ["added"])
    assert.deepEqual(nodeStore.map.get(secondMapRef), {})
  })

  test("reads replacements inside and after transactions, including type changes", (context) => {
    const nodeStore = createNodeStore(context)
    const ref = nodeStore.cell.create<JSONValue>("Draft")
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
        assert.deepEqual(nodeStore.cell.get(ref), value)
        return value
      })

      assert.deepEqual(result, value)
      assert.deepEqual(nodeStore.cell.get(ref), value)
    }
  })

  test("reads insertions into empty arrays and at beginning, middle, and end", (context) => {
    const nodeStore = createNodeStore(context)
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
      assert.deepEqual(nodeStore.array.get(rootRef), [secondRef])
      editor.insert(0, firstRef)
      assert.deepEqual(nodeStore.array.get(rootRef), [firstRef, secondRef])
      editor.insert(1, nestedRef)
      assert.deepEqual(nodeStore.array.get(rootRef), [firstRef, nestedRef, secondRef])
      editor.insert(3, thirdRef)
      assert.deepEqual(nodeStore.array.get(rootRef), [firstRef, nestedRef, secondRef, thirdRef])
    })

    assert.deepEqual(nodeStore.array.get(rootRef), [firstRef, nestedRef, secondRef, thirdRef])
    assert.deepEqual(nodeStore.array.get(nestedRef), [nestedCellRef])
    assert.equal(nodeStore.cell.get(nestedCellRef), "Nested")
    assert.equal(nodeStore.cell.get(firstRef), "First")
    assert.equal(nodeStore.cell.get(secondRef), "Second")
    assert.equal(nodeStore.cell.get(thirdRef), "Third")
  })

  test("returns callback results even when they are unrelated to stored values", (context) => {
    const nodeStore = createNodeStore(context)
    const result = { status: "Done" }

    assert.equal(
      nodeStore.transact(() => result),
      result,
    )
    assert.equal(
      nodeStore.transact(() => 0),
      0,
    )
    assert.equal(
      nodeStore.transact(() => undefined),
      undefined,
    )
  })

  test("propagates callback errors and permits subsequent transactions", (context) => {
    const nodeStore = createNodeStore(context)
    const ref = nodeStore.cell.create("Draft" as string)
    nodeStore.attach(ref)
    const error = new Error("Transaction failed")

    assert.throws(
      () =>
        nodeStore.transact(() => {
          throw error
        }),
      (caught) => caught === error,
    )
    nodeStore.transact((tx) => nodeStore.cell.edit(ref, tx).set("Recovered"))

    assert.equal(nodeStore.cell.get(ref), "Recovered")
  })
}

function createYjsNodeStore(context: TestContext): YjsNodeStore {
  const doc = new Y.Doc()
  context.after(() => doc.destroy())
  return new YjsNodeStore(doc)
}
