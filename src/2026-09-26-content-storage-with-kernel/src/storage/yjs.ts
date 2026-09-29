import * as Y from "yjs"

import type { Storage } from "./types.ts"
import type { JSONValue } from "./utils/json-value.ts"

type YCell = Y.Map<JSONValue>
type YArray = Y.Array<YRef>
type YMap = Y.Map<YRef>
type YRef = YCell | YArray | YMap

type YjsStorageContract = Storage<YCell, YArray, YMap, Y.Transaction>

export class YjsStorage implements YjsStorageContract {
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
  } as YjsStorageContract["cell"]

  readonly array = {
    create: (items) => {
      const array = new Y.Array<YRef>()
      array.push(items as YRef[])
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
  } as YjsStorageContract["array"]

  readonly map = {
    create: (fields) => {
      return new Y.Map<YRef>(Object.entries(fields))
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
  } as YjsStorageContract["map"]

  attach<Ref extends YRef>(ref: Ref): Ref {
    this.doc.getMap("root").set("root", ref)
    return ref
  }

  transact<T>(callback: (tx: Y.Transaction) => T): T {
    return this.doc.transact(callback)
  }
}
