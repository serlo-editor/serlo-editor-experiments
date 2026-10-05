import { afterEach, beforeEach, describe } from "bun:test"

import * as Y from "yjs"

import { FlatNodeStore, YjsNodeStore } from "../storage/index.ts"
import type { NodeRefs, NodeStore } from "../storage/types.ts"

export function describeWithStores(
  name: string,
  callback: <Refs extends NodeRefs, Tx>(getStore: () => NodeStore<Refs, Tx>) => void,
): void {
  describe(name, () => {
    describe("FlatNodeStore", () => {
      let store!: StoreContract<FlatNodeStore>

      beforeEach(() => {
        store = new FlatNodeStore()
      })
      callback(() => store)
    })

    describe("YjsNodeStore", () => {
      let store!: StoreContract<YjsNodeStore>
      let doc!: Y.Doc

      beforeEach(() => {
        doc = new Y.Doc()
        store = new YjsNodeStore(doc)
      })
      afterEach(() => doc.destroy())
      callback(() => store)
    })
  })
}

type StoreContract<Store extends FlatNodeStore | YjsNodeStore> = NodeStore<
  { [Kind in keyof NodeRefs]: ReturnType<Store[Kind]["create"]> },
  Parameters<Store["cell"]["edit"]>[1]
>
