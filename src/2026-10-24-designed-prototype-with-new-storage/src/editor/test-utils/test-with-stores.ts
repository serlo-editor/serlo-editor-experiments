import { afterEach, beforeEach, describe } from "bun:test"

import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { FlatNodeStore, YjsNodeStore } from "../storage/index.ts"
import type { NodeStore } from "../storage/types.ts"

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
        store = new YjsNodeStore({ doc, awareness: new Awareness(doc) })
      })
      afterEach(() => doc.destroy())
      callback(() => store)
    })
  })
}
