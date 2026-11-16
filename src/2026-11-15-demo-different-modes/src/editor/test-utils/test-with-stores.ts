import { afterEach, beforeEach, describe } from "bun:test"

import { FlatNodeStore, type NodeStore, YjsNodeStore } from "@editor/store"
import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

export function describeWithStores(
  name: string,
  // Shared behavioral tests erase backend-specific reference types, never mixing stores.
  callback: (getStore: () => NodeStore<any>) => void,
): void {
  describe(name, () => {
    describe("FlatNodeStore", () => {
      let store!: FlatNodeStore

      beforeEach(() => {
        store = new FlatNodeStore()
      })
      callback(() => store)
    })

    describe("YjsNodeStore", () => {
      let store!: YjsNodeStore
      let doc!: Y.Doc

      beforeEach(() => {
        doc = new Y.Doc()
        store = new YjsNodeStore({ doc, awareness: new Awareness(doc), storeName: "test" })
      })
      afterEach(() => doc.destroy())
      callback(() => store)
    })
  })
}
