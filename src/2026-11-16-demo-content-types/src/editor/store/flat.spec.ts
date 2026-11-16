import { expect, test } from "bun:test"

import { FlatNodeStore } from "./flat.ts"

test("FlatNodeStore keeps references distinct across stores and node kinds", () => {
  const first = new FlatNodeStore()
  const second = new FlatNodeStore()
  const foreignRef = first.cell.create(null)
  const firstRefs = [foreignRef, first.array.create([]), first.map.create({})]
  const secondRefs = [second.cell.create(null), second.array.create([]), second.map.create({})]

  expect(new Set([...firstRefs, ...secondRefs]).size).toBe(6)
  expect(() => second.transact((write) => write.root.save(foreignRef))).toThrow()
})
