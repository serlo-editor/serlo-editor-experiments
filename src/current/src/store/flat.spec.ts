import { expect, test } from "bun:test"

import { FlatNodeStore } from "./index.ts"

test("FlatNodeStore keeps references distinct across stores and node kinds", () => {
  const first = new FlatNodeStore()
  const second = new FlatNodeStore()
  const firstRefs = [first.cell.create(null), first.array.create([]), first.map.create({})]
  const secondRefs = [second.cell.create(null), second.array.create([]), second.map.create({})]

  expect(new Set([...firstRefs, ...secondRefs]).size).toBe(6)
  for (const ref of firstRefs) {
    expect(ref).toBe(first.transact((tx) => tx.root.save(ref)))
    expect(() => second.transact((tx) => tx.root.save(ref))).toThrow(
      `Reference with key ${ref} does not exist.`,
    )
  }
})
