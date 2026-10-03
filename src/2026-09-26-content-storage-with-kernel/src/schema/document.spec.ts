import assert from "node:assert/strict"

import { testWithStores } from "../test-utils/test-with-stores.ts"
import type { JSONValue } from "../utils/index.ts"
import { createDocument } from "./document.ts"
import type { Handle, Schema } from "./types.ts"

testWithStores("exposes a root handle and snapshots its current state", (store) => {
  const schema: Schema<JSONValue, Handle<JSONValue> & { set(value: JSONValue): void }, "cell"> = {
    create(store, snapshot) {
      return store.cell.create(snapshot)
    },
    bind(store, ref) {
      return {
        snapshot: () => store.cell.get(ref),
        set(value) {
          store.transact((tx) => store.cell.edit(ref, tx).set(value))
        },
      }
    },
  }
  const document = createDocument(store, schema, "Initial")
  const root = document.root

  assert.equal(root.snapshot(), "Initial")
  assert.equal(document.snapshot(), "Initial")

  root.set("Changed")

  assert.equal(root.snapshot(), "Changed")
  assert.equal(document.snapshot(), "Changed")
})
