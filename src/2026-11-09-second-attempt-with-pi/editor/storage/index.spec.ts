import { expect, test } from "bun:test"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import type { JSONValue } from "../utils/index.ts"
import { FlatNodeStore } from "./index.ts"

describeWithStores("NodeStore", (getStore) => {
  test("increments revision after changes, even without subscribers", () => {
    const store = getStore()
    const ref = store.cell.create("Initial")
    const notifications: number[] = []
    const unsubscribe = store.subscribe(() => notifications.push(store.getRevision()))

    expect(store.getRevision()).toBe(0)
    store.transact((write) => {
      write.root.save(ref)
      expect(notifications).toEqual([])
      expect(store.getRevision()).toBe(0)
    })

    expect(store.getRevision()).toBe(1)
    expect(notifications).toEqual([1])

    unsubscribe()
    store.transact((tx) => tx.cell.set(ref, "Changed"))
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
      store.map.getField(ref, "cell")
      store.map.getField(ref, "missing")
      tx.cell.set(cell, "Initial")
      tx.map.set(ref, "cell", cell)
      tx.map.remove(ref, "missing")
      tx.root.save(ref)
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
      () => store.transact((tx) => tx.array.insert(items, 0, store.cell.create("Item"))),
      () => store.transact((tx) => tx.array.remove(items, 0)),
      () => store.transact((tx) => tx.map.set(root, "added", store.cell.create("Field"))),
      () => store.transact((tx) => tx.map.remove(root, "added")),
      () => store.transact((tx) => tx.root.save(store.cell.create("Replacement"))),
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
      tx.cell.set(ref, "Outer")
      store.transact((nested) => nested.cell.set(ref, "Inner"))
      expect(store.getRevision()).toBe(revision)
      expect(observed).toEqual([])
      tx.cell.set(ref, "Final")
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
        store.transact((nested) => nested.cell.set(ref, "Changed"))
        expect(observed).toEqual([])
        throw error
      }),
    ).toThrow(error)
    expect(store.getRevision()).toBe(revision + 1)
    expect(observed).toEqual(["Changed"])

    store.transact((tx) => tx.cell.set(ref, "Recovered"))
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
    store.transact((tx) => tx.root.save(replacement))

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
    nodeStore.transact((write) => write.root.save(rootRef))

    expect(nodeStore.array.get(rootRef)).toEqual(cells.map(({ ref }) => ref))
    for (const { ref, value } of cells) {
      expect(nodeStore.cell.get(ref)).toEqual(value)
      expect(nodeStore.cell.get(ref), "Repeated reads preserve values").toEqual(value)
    }
  })

  test("attaches and reads a standalone cell", () => {
    const nodeStore = getStore()
    const ref = nodeStore.cell.create("Standalone")

    expect(ref).toBe(nodeStore.transact((write) => write.root.save(ref)))
    expect(nodeStore.cell.get(ref)).toBe("Standalone")
  })

  test("rejects every operation on an expired writer before changing content", () => {
    const store = getStore()
    const cell = store.cell.create("Initial")
    const array = store.array.create([cell])
    const map = store.map.create({ array })
    store.root.getOrCreate(() => map)
    const revision = store.getRevision()
    const expired = store.transact((write) => write)
    const set = expired.cell.set

    for (const change of [
      () => expired.root.save(map),
      () => set(cell, "Changed"),
      () => expired.array.remove(array, 0),
      () => expired.array.insert(array, 0, store.cell.create("Added")),
      () => expired.map.set(map, "added", store.cell.create("Added")),
      () => expired.map.remove(map, "array"),
    ]) {
      expect(change).toThrow("Invalid transaction.")
    }
    expect(store.cell.get(cell)).toBe("Initial")
    expect(store.array.get(array)).toEqual([cell])
    expect(store.map.get(map)).toEqual({ array })
    expect(store.getRevision()).toBe(revision)
  })

  test("attaches and reads an empty root array", () => {
    const nodeStore = getStore()
    const ref = nodeStore.array.create([])

    expect(ref).toBe(nodeStore.transact((write) => write.root.save(ref)))
    expect(nodeStore.array.get(ref)).toEqual([])
    expect(nodeStore.array.get(ref)).toEqual([])
  })

  test("attaches and reads an empty root map", () => {
    const nodeStore = getStore()
    const ref = nodeStore.map.create({})

    expect(ref).toBe(nodeStore.transact((write) => write.root.save(ref)))
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

    expect(rootRef).toBe(nodeStore.transact((write) => write.root.save(rootRef)))
    expect(nodeStore.map.get(rootRef)).toEqual(fields)
    expect(nodeStore.map.get(rootRef), "Repeated reads preserve references").toEqual(fields)
    expect(nodeStore.map.getField(rootRef, "title")).toBe(titleRef)
    expect(nodeStore.map.get(branchRef)).toEqual({ items: arrayRef })
    expect(nodeStore.array.get(arrayRef)).toEqual([emptyRef, leafRef])
    expect(nodeStore.map.get(emptyRef)).toEqual({})
    expect(nodeStore.map.get(leafRef)).toEqual({ body: bodyRef })
    expect(nodeStore.cell.get(titleRef)).toBe("Title")
    expect(nodeStore.cell.get(bodyRef)).toEqual({ text: "Body" })

    nodeStore.transact((tx) => tx.cell.set(bodyRef, { text: "Changed" }))
    expect(nodeStore.map.get(leafRef)).toEqual({ body: bodyRef })
    expect(nodeStore.cell.get(bodyRef)).toEqual({ text: "Changed" })
  })

  test("sets and replaces map fields inside and after transactions", () => {
    const nodeStore = getStore()
    const rootRef = nodeStore.map.create({})
    nodeStore.transact((write) => write.root.save(rootRef))
    const cellRef = nodeStore.cell.create(false)
    const nestedCellRef = nodeStore.cell.create("Nested")
    const arrayRef = nodeStore.array.create([nestedCellRef])
    const mapRef = nodeStore.map.create({})

    for (const ref of [cellRef, arrayRef, mapRef]) {
      nodeStore.transact((tx) => {
        tx.map.set(rootRef, "content", ref)
        expect(nodeStore.map.get(rootRef)).toEqual({ content: ref })
      })
      expect(nodeStore.map.get(rootRef)).toEqual({ content: ref })
    }

    const titleRef = nodeStore.cell.create("Title")
    const flagRef = nodeStore.cell.create(false)
    nodeStore.transact((tx) => {
      tx.map.set(rootRef, "title", titleRef)
      tx.map.set(mapRef, "flag", flagRef)
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
    nodeStore.transact((write) => write.root.save(rootRef))

    expect(nodeStore.map.get(rootRef)).toEqual(fields)
    const replacements = Object.fromEntries(
      keys.map((key) => [key, nodeStore.cell.create(`Changed ${key}`)]),
    )
    nodeStore.transact((tx) => {
      for (const [key, ref] of Object.entries(replacements)) {
        tx.map.set(rootRef, key, ref)
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
    const ref = store.transact((tx) => tx.root.save(store.map.create(fields)))
    const previous = store.map.get(ref)
    store.transact((tx) => {
      for (const key of keys) {
        tx.map.remove(ref, key)
        tx.map.remove(ref, key)
        expect(Object.hasOwn(store.map.get(ref), key)).toBe(false)
      }
      tx.map.remove(ref, "missing")
      expect(store.map.get(ref)).toEqual({})
    })
    expect(store.map.get(ref)).toEqual({})
    expect(previous).toEqual(fields)

    const child = store.cell.create("Again")
    store.transact((tx) => tx.map.set(ref, "__proto__", child))
    expect(store.map.get(ref)).toEqual({ ["__proto__"]: child })
  })

  test("gets individual map fields and observes replacements and removals", () => {
    const store = getStore()
    const keys = ["", "世界 👋", "__proto__", "constructor", "toString", "hasOwnProperty"]
    const array = store.array.create([])
    const map = store.map.create({})
    const fields = Object.fromEntries(keys.map((key) => [key, store.cell.create(null)]))
    const root = store.root.getOrCreate(() => store.map.create({ ...fields, array, map }))

    expect(store.map.getField(root, "array")).toBe(array)
    expect(store.map.getField(root, "map")).toBe(map)
    expect(store.map.getField(root, "missing")).toBeUndefined()
    for (const key of keys) {
      expect(store.map.getField(map, key)).toBeUndefined()
      expect(store.map.getField(root, key)).toBe(fields[key])
      const replacement = store.cell.create("Changed")
      store.transact((write) => {
        write.map.set(root, key, replacement)
        expect(store.map.getField(root, key)).toBe(replacement)
      })
      expect(store.map.getField(root, key)).toBe(replacement)
      store.transact((write) => {
        write.map.remove(root, key)
        expect(store.map.getField(root, key)).toBeUndefined()
      })
      expect(store.map.getField(root, key)).toBeUndefined()
    }
  })

  test("inserts maps into arrays", () => {
    const nodeStore = getStore()
    const rootRef = nodeStore.array.create([])
    const cellRef = nodeStore.cell.create("Nested")
    const mapRef = nodeStore.map.create({ content: cellRef })
    nodeStore.transact((write) => write.root.save(rootRef))

    nodeStore.transact((tx) => {
      tx.array.insert(rootRef, 0, mapRef)
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

    expect(rootRef).toBe(nodeStore.transact((write) => write.root.save(rootRef)))
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
    nodeStore.transact((write) => write.root.save(rootRef))

    expect(new Set([...refs, rootRef]).size).toBe(7)
    nodeStore.transact((tx) => {
      tx.cell.set(firstRef, "Changed")
      tx.array.insert(firstArrayRef, 0, nodeStore.cell.create("Added"))
      tx.map.set(firstMapRef, "added", nodeStore.cell.create("Added"))
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
    nodeStore.transact((write) => write.root.save(ref))
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
        tx.cell.set(ref, value)
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
    nodeStore.transact((write) => write.root.save(rootRef))

    nodeStore.transact((tx) => {
      tx.array.insert(rootRef, 0, secondRef)
      expect(nodeStore.array.get(rootRef)).toEqual([secondRef])
      tx.array.insert(rootRef, 0, firstRef)
      expect(nodeStore.array.get(rootRef)).toEqual([firstRef, secondRef])
      tx.array.insert(rootRef, 1, nestedRef)
      expect(nodeStore.array.get(rootRef)).toEqual([firstRef, nestedRef, secondRef])
      tx.array.insert(rootRef, 3, thirdRef)
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
    nodeStore.transact((write) => write.root.save(ref))
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
    nodeStore.transact((tx) => tx.cell.set(ref, "Recovered"))

    expect(nodeStore.cell.get(ref)).toBe("Recovered")
  })
})

test("writers preserve node-kind types and read stores expose no mutation methods", () => {
  const store = new FlatNodeStore()
  const cell = store.cell.create(null)
  const array = store.array.create([])
  const map = store.map.create({})
  store.transact((write) => {
    // @ts-expect-error Cell writes require cell references, not array references.
    const setArray: (ref: typeof array, value: JSONValue) => void = write.cell.set
    // @ts-expect-error Array writes require array references, not map references.
    const removeMap: (ref: typeof map, index: number) => void = write.array.remove
    // @ts-expect-error Map writes require map references, not cell references.
    const removeCell: (ref: typeof cell, field: string) => void = write.map.remove
    void [setArray, removeMap, removeCell]
  })
  // @ts-expect-error Mutations belong to transaction-scoped writers.
  expect(store.cell.edit).toBeUndefined()
  // @ts-expect-error Root replacement belongs to transaction-scoped writers.
  expect(store.root.save).toBeUndefined()
})

describeWithStores("transaction-scoped writers", (getStore) => {
  test("nested writers expire independently and cannot be revived by later transactions", () => {
    const store = getStore()
    const ref = store.root.getOrCreate(() => store.cell.create("Initial"))
    const expired = store.transact((write) => {
      write.cell.set(ref, "Outer")
      const nested = store.transact((inner) => {
        write.cell.set(ref, "Outer from inner")
        inner.cell.set(ref, "Inner")
        return inner
      })
      expect(() => nested.cell.set(ref, "Expired inner")).toThrow("Invalid transaction.")
      write.cell.set(ref, "Final")
      return write
    })
    expect(store.cell.get(ref)).toBe("Final")

    store.transact((write) => {
      expect(() => expired.cell.set(ref, "Expired outer")).toThrow("Invalid transaction.")
      write.cell.set(ref, "Later")
    })
    expect(store.cell.get(ref)).toBe("Later")
    new FlatNodeStore().transact(() => {
      expect(() => expired.cell.set(ref, "Foreign transaction")).toThrow("Invalid transaction.")
    })
  })

  test("writers expire after errors and before subscriber notifications", () => {
    const store = getStore()
    const ref = store.root.getOrCreate(() => store.cell.create("Initial"))
    let failed = store.transact((write) => write)
    store.subscribe(() => {
      expect(() => failed.cell.set(ref, "Subscriber write")).toThrow("Invalid transaction.")
    })
    expect(() =>
      store.transact((write) => {
        failed = write
        write.cell.set(ref, "Changed")
        throw new Error("Transaction failed")
      }),
    ).toThrow("Transaction failed")
    expect(() => failed.cell.set(ref, "Expired")).toThrow("Invalid transaction.")
    expect(store.cell.get(ref)).toBe("Changed")
  })

  test("rejects writes after an async callback yields", async () => {
    const store = getStore()
    const ref = store.root.getOrCreate(() => store.cell.create("Initial"))
    const revision = store.getRevision()
    await expect(
      store.transact(async (write) => {
        await Promise.resolve()
        write.cell.set(ref, "Too late")
      }),
    ).rejects.toThrow("Invalid transaction.")
    expect(store.cell.get(ref)).toBe("Initial")
    expect(store.getRevision()).toBe(revision)
  })
})
