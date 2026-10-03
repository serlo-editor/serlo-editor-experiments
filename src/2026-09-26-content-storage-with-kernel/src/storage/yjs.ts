import * as Y from "yjs"

import type { JSONValue } from "../utils/index.ts"
import type { NodeKind, NodeStore, Ref, RootRef } from "./types.ts"

type YArray = Y.Array<YjsNodeRef>
type YMap = Y.Map<YjsNodeRef>

type YjsNodeRefs = {
  cell: Y.Map<JSONValue> & Ref
  array: YArray & Ref
  map: YMap & Ref
}
type YjsNodeRef = YjsNodeRefs[NodeKind]

type YjsNodeStoreContract = NodeStore<YjsNodeRefs, Y.Transaction>

export class YjsNodeStore implements YjsNodeStoreContract {
  private readonly doc: Y.Doc

  constructor(doc: Y.Doc) {
    this.doc = doc
  }

  readonly cell: YjsNodeStoreContract["cell"] = {
    create: (value) => {
      const cell = new Y.Map<JSONValue>()
      cell.set("value", value)
      return cell as YjsNodeRefs["cell"]
    },
    get: (ref) => {
      const value = ref.get("value")
      if (value === undefined) {
        throw new Error("Cell value absent.")
      }
      return value
    },
    edit: (ref) => ({
      set: (value) => {
        ref.set("value", value)
      },
    }),
  }

  readonly array: YjsNodeStoreContract["array"] = {
    create: (items) => {
      const array = new Y.Array<YjsNodeRef>()
      array.push(items as YjsNodeRef[])
      return array as YjsNodeRefs["array"]
    },
    get: (ref) => ref.toArray(),
    edit: (ref) => ({
      remove: (index) => {
        ref.delete(index, 1)
      },
      insert: (index, item) => {
        ref.insert(index, [item])
      },
    }),
  }

  readonly map: YjsNodeStoreContract["map"] = {
    create: (fields) => new Y.Map<YjsNodeRef>(Object.entries(fields)) as YjsNodeRefs["map"],
    get: (ref) => Object.fromEntries(ref.entries()),
    edit: (ref) => ({
      set: (field, item) => {
        ref.set(field, item)
      },
      remove: (field) => {
        ref.delete(field)
      },
    }),
  }

  attach<Ref extends YjsNodeRef>(ref: Ref): Ref & RootRef {
    this.doc.getMap("root").set("root", ref)
    return ref as Ref & RootRef
  }

  transact<T>(callback: (tx: Y.Transaction) => T): T {
    return this.doc.transact(callback)
  }
}
