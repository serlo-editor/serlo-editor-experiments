import test from "node:test"
import type { TestContext } from "node:test"

import * as Y from "yjs"

import { FlatNodeStore, YjsNodeStore } from "../storage/index.ts"
import type { NodeRefs, NodeStore } from "../storage/types.ts"

type StoreRefs<Store extends FlatNodeStore | YjsNodeStore> = {
  cell: ReturnType<Store["cell"]["create"]>
  array: ReturnType<Store["array"]["create"]>
  map: ReturnType<Store["map"]["create"]>
}

type StoreTx<Store extends FlatNodeStore | YjsNodeStore> = Parameters<Store["cell"]["edit"]>[1]

export function testWithStores(
  name: string,
  callback: <Refs extends NodeRefs, Tx>(
    store: NodeStore<Refs, Tx>,
    context: TestContext,
  ) => void | Promise<void>,
): void {
  test(`${name} (FlatNodeStore)`, (context) =>
    callback<StoreRefs<FlatNodeStore>, StoreTx<FlatNodeStore>>(new FlatNodeStore(), context))
  test(`${name} (YjsNodeStore)`, (context) => {
    const doc = new Y.Doc()
    context.after(() => doc.destroy())
    return callback<StoreRefs<YjsNodeStore>, StoreTx<YjsNodeStore>>(new YjsNodeStore(doc), context)
  })
}
