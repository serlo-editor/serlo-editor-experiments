import { expect, test } from "bun:test"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import type { JSONValue } from "../utils/index.ts"
import { createDocument } from "./document.ts"
import type { Schema, StoredValue } from "./types.ts"

describeWithStores("Document", (getStore) => {
  test("exposes a root stored value and snapshots its current state", () => {
    const store = getStore()
    const schema: Schema<
      JSONValue,
      StoredValue<JSONValue> & { set(value: JSONValue): void },
      "cell"
    > = {
      create(store, snapshot) {
        return store.cell.create(snapshot)
      },
      bind(store, ref) {
        return {
          snapshot: () => store.cell.get(ref),
          set(value) {
            store.transact((write) => write.cell.set(ref, value))
          },
        }
      },
    }
    const document = createDocument(store, schema, "Initial")
    const root = document.root

    expect(root.snapshot()).toBe("Initial")
    expect(document.root.snapshot()).toBe("Initial")

    root.set("Changed")

    expect(root.snapshot()).toBe("Changed")
    expect(document.root.snapshot()).toBe("Changed")
  })

  test("opens existing content and ignores the initial snapshot", () => {
    const store = getStore()
    const schema: Schema<JSONValue, StoredValue<JSONValue>, "cell"> = {
      create: (store, snapshot) => store.cell.create(snapshot),
      bind: (store, ref) => ({ snapshot: () => store.cell.get(ref) }),
    }

    const first = createDocument(store, schema, "First")
    const second = createDocument(store, schema, "Ignored")

    expect(second.root.snapshot()).toBe("First")
    expect(second.root.snapshot()).toBe("First")
    expect(first.root.snapshot()).toBe("First")
  })
})
