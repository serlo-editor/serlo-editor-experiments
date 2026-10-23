import { expect, test } from "bun:test"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import type { JSONValue } from "../utils/index.ts"
import { createDocument } from "./document.ts"
import type { Handle, Schema } from "./types.ts"

describeWithStores("Document", (getStore) => {
  test("exposes a root handle and snapshots its current state", () => {
    const store = getStore()
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

    expect(root.snapshot()).toBe("Initial")
    expect(document.snapshot()).toBe("Initial")

    root.set("Changed")

    expect(root.snapshot()).toBe("Changed")
    expect(document.snapshot()).toBe("Changed")
  })

  test("opens existing content and ignores the initial snapshot", () => {
    const store = getStore()
    const schema: Schema<JSONValue, Handle<JSONValue>, "cell"> = {
      create: (store, snapshot) => store.cell.create(snapshot),
      bind: (store, ref) => ({ snapshot: () => store.cell.get(ref) }),
    }

    const first = createDocument(store, schema, "First")
    const second = createDocument(store, schema, "Ignored")

    expect(second.snapshot()).toBe("First")
    expect(second.root.snapshot()).toBe("First")
    expect(first.snapshot()).toBe("First")
  })
})
