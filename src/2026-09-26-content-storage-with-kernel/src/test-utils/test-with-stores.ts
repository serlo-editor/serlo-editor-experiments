import test from "node:test"
import type { TestContext } from "node:test"

import * as Y from "yjs"

import { FlatNodeStore, YjsNodeStore } from "../storage/index.ts"

export function testWithStores(
  name: string,
  callback: (store: FlatNodeStore | YjsNodeStore, context: TestContext) => void | Promise<void>,
): void {
  test(`${name} (FlatNodeStore)`, (context) => callback(new FlatNodeStore(), context))
  test(`${name} (YjsNodeStore)`, (context) => {
    const doc = new Y.Doc()
    context.after(() => doc.destroy())
    return callback(new YjsNodeStore(doc), context)
  })
}
