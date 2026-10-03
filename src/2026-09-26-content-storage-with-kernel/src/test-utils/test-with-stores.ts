import test from "node:test"

import * as Y from "yjs"

import { FlatNodeStore, YjsNodeStore } from "../storage/index.ts"
import type { NodeRefs, NodeStore } from "../storage/types.ts"

type StoreRefs<Store extends FlatNodeStore | YjsNodeStore> = {
  cell: ReturnType<Store["cell"]["create"]>
  array: ReturnType<Store["array"]["create"]>
  map: ReturnType<Store["map"]["create"]>
}

type StoreTx<Store extends FlatNodeStore | YjsNodeStore> = Parameters<Store["cell"]["edit"]>[1]

export function describeWithStores(
  name: string,
  callback: <Refs extends NodeRefs, Tx>(getStore: () => NodeStore<Refs, Tx>) => void,
): void {
  test.describe(name, () => {
    test.describe("FlatNodeStore", () => {
      let store!: NodeStore<StoreRefs<FlatNodeStore>, StoreTx<FlatNodeStore>>

      test.beforeEach(() => {
        store = new FlatNodeStore()
      })
      callback<StoreRefs<FlatNodeStore>, StoreTx<FlatNodeStore>>(() => store)
    })

    test.describe("YjsNodeStore", () => {
      let store!: NodeStore<StoreRefs<YjsNodeStore>, StoreTx<YjsNodeStore>>
      let doc!: Y.Doc

      test.beforeEach(() => {
        doc = new Y.Doc()
        store = new YjsNodeStore(doc)
      })
      test.afterEach(() => doc.destroy())
      callback<StoreRefs<YjsNodeStore>, StoreTx<YjsNodeStore>>(() => store)
    })
  })
}
