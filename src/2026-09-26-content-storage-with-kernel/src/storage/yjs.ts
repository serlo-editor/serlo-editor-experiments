import * as Y from "yjs"

import type { JSONValue } from "../utils/json-value.ts"
import type { NodeRef, NodeStore } from "./types.ts"

type YCell = Y.Map<JSONValue>
type YArray = Y.Array<YjsNodeRef>
type YMap = Y.Map<YjsNodeRef>

type YjsNodeRefs = {
  cell: YCell
  array: YArray
  map: YMap
}
type YjsNodeRef = NodeRef<YjsNodeRefs>

type YjsNodeStoreContract = NodeStore<YjsNodeRefs, Y.Transaction>

export class YjsNodeStore implements YjsNodeStoreContract {
  private readonly doc: Y.Doc

  constructor(doc: Y.Doc) {
    this.doc = doc
  }

  readonly cell = {
    create: (value) => {
      const cell = new Y.Map<JSONValue>()
      cell.set("value", value)
      return cell
    },
    get: (ref) => {
      return ref.get("value")
    },
    edit: (ref) => {
      return {
        set: (value) => {
          ref.set("value", value)
        },
      }
    },
  } as YjsNodeStoreContract["cell"]

  readonly array = {
    create: (items) => {
      const array = new Y.Array<YjsNodeRef>()
      array.push(items as YjsNodeRef[])
      return array
    },
    get: (ref) => {
      return ref.toArray()
    },
    edit: (ref) => {
      return {
        insert: (index, item) => {
          ref.insert(index, [item])
        },
      }
    },
  } as YjsNodeStoreContract["array"]

  readonly map = {
    create: (fields) => {
      return new Y.Map<YjsNodeRef>(Object.entries(fields))
    },
    get: (ref) => {
      return Object.fromEntries(ref.entries())
    },
    edit: (ref) => {
      return {
        set: (field, item) => {
          ref.set(field, item)
        },
      }
    },
  } as YjsNodeStoreContract["map"]

  attach<Ref extends YjsNodeRef>(ref: Ref): Ref {
    this.doc.getMap("root").set("root", ref)
    return ref
  }

  transact<T>(callback: (tx: Y.Transaction) => T): T {
    return this.doc.transact(callback)
  }
}
