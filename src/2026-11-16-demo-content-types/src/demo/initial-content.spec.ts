import { expect, test } from "bun:test"

import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { Root } from "../editor/content"
import { openRoot } from "../editor/schema"
import { YjsNodeStore } from "../editor/store"
import { exerciseTypes } from "./initial-content"

test("all demo exercise types seed and survive collaborative round-trip", () => {
  for (const { content } of exerciseTypes) {
    const first = new Y.Doc()
    const second = new Y.Doc()
    const store = new YjsNodeStore({
      doc: first,
      awareness: new Awareness(first),
      storeName: "content",
    })
    const root = openRoot(store, Root, content)
    expect(root.children().map((value) => value.type)).toEqual(content.map((value) => value.type))
    Y.applyUpdate(second, Y.encodeStateAsUpdate(first))
    const peer = new YjsNodeStore({
      doc: second,
      awareness: new Awareness(second),
      storeName: "content",
    })
    expect(openRoot(peer, Root, content).snapshot()).toEqual(root.snapshot())
    peer.dispose()
    store.dispose()
    first.destroy()
    second.destroy()
  }
})
