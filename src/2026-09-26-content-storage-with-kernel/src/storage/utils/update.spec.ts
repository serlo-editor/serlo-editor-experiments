import assert from "node:assert/strict"
import test from "node:test"

import { applyUpdate } from "./update"

test.describe("applyUpdate", () => {
  test("returns direct update values", () => {
    assert.equal(applyUpdate(1, 2), 2)
  })

  test("passes previous value to updater", () => {
    const booleanValue = true as boolean

    const result = applyUpdate(booleanValue, (previousValue) => !previousValue)

    assert.equal(result, false)
  })
})
