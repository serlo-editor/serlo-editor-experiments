import assert from "node:assert/strict"
import test from "node:test"

import * as Y from "yjs"

import { FlatNodeStore, YjsNodeStore } from "../storage/index.ts"
import { createDocument } from "./document.ts"
import * as schema from "./index.ts"

test("creates a document with a live root and detached snapshots", () => {
  const store = new FlatNodeStore()
  const initialSnapshot = ["Ada"]
  const document = createDocument(store, schema.array(schema.string()), initialSnapshot)

  initialSnapshot.push("Linus")
  assert.deepEqual(document.snapshot(), ["Ada"])
  assert.equal(document.root.at(0).get(), "Ada")

  document.root.insert(1, "Grace")
  const snapshot = document.snapshot()
  assert.deepEqual(snapshot, ["Ada", "Grace"])
  snapshot.push("Linus")
  assert.deepEqual(document.snapshot(), ["Ada", "Grace"])
})

test("creates documents over YjsNodeStore", (context) => {
  const doc = new Y.Doc()
  context.after(() => doc.destroy())
  const document = createDocument(new YjsNodeStore(doc), schema.array(schema.string()), [
    "Ada",
    "Linus",
  ])

  document.root.at(1).set("Grace")
  assert.deepEqual(document.snapshot(), ["Ada", "Grace"])
})
