import test from "node:test"

import * as Y from "yjs"

import { FlatNodeStore, YjsNodeStore } from "../storage/index.ts"
import type { NodeRefs, NodeStore } from "../storage/types.ts"

export function describeWithStores(
  name: string,
  callback: <Refs extends NodeRefs, Tx>(getStore: () => NodeStore<Refs, Tx>) => void,
): void {
  test.describe(name, () => {
    test.describe("FlatNodeStore", () => {
      let store!: StoreContract<FlatNodeStore>

      test.beforeEach(() => {
        store = new FlatNodeStore()
      })
      callback(() => store)
    })

    test.describe("YjsNodeStore", () => {
      let store!: StoreContract<YjsNodeStore>
      let doc!: Y.Doc

      test.beforeEach(() => {
        doc = new Y.Doc()
        store = new YjsNodeStore(doc)
      })
      test.afterEach(() => doc.destroy())
      callback(() => store)
    })
  })
}

type StoreContract<Store extends FlatNodeStore | YjsNodeStore> = NodeStore<
  { [Kind in keyof NodeRefs]: ReturnType<Store[Kind]["create"]> },
  Parameters<Store["cell"]["edit"]>[1]
>
