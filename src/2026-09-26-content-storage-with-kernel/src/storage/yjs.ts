import * as Y from "yjs"

import { Storage } from "./types.ts"
import { JSONValue } from "./utils/json-value.ts"

type YCell = Y.Map<JSONValue>
type YArray = Y.Array<YRef>
type YRef = YCell | YArray

type YjsStorageContract = Storage<YCell, YArray, Y.Transaction>

export class YjsStorage implements YjsStorageContract {
  constructor(private doc: Y.Doc) {}

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

  attach<Ref extends YRef>(ref: Ref): Ref {
    this.doc.getMap("root").set("root", ref)
    return ref
  }

  mutate<T>(transaction: (tx: Y.Transaction) => T): T {
    return this.doc.transact(transaction)
  }
}
