import assert from "node:assert/strict"
import test from "node:test"

import { applyUpdate } from "./update.ts"
import type { Update } from "./update.ts"

test("applyUpdate returns direct update values", () => {
  assert.equal(applyUpdate(1, 2), 2)
})

test("applyUpdate passes previous value to updater", () => {
  let receivedPreviousValue: number | undefined

  const result = applyUpdate<number>(1, (previousValue) => {
    receivedPreviousValue = previousValue
    return previousValue + 1
  })

  assert.equal(receivedPreviousValue, 1)
  assert.equal(result, 2)
})

const directUpdate = 2 satisfies Update<number>
const functionUpdate = ((previousValue: number) => previousValue + 1) satisfies Update<number>

// @ts-expect-error Update<number> does not accept strings.
const invalidUpdate: Update<number> = "not a number"

void directUpdate
void functionUpdate
void invalidUpdate
