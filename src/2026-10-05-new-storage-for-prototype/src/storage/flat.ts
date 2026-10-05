import type { Branded, JSONValue } from "../utils/index.ts"
import type { NodeKind, NodeStore, Ref, RootRef } from "./types.ts"

type FlatNodeRefs = {
  [Kind in NodeKind]: Ref & Branded<string, Kind>
}
type FlatNodeRef = FlatNodeRefs[NodeKind]

type FlatNodeStoreContract = NodeStore<FlatNodeRefs, TransactionToken>

export class FlatNodeStore implements FlatNodeStoreContract {
  private readonly activeTransactions = new Set<TransactionToken>()

  private readonly cellTable = new ReferenceTable<"cell", JSONValue>()
  private readonly arrayTable = new ReferenceTable<"array", readonly FlatNodeRef[]>()
  private readonly mapTable = new ReferenceTable<"map", Readonly<Record<string, FlatNodeRef>>>()

  readonly cell: FlatNodeStoreContract["cell"] = {
    create: (value) => this.cellTable.create(value),
    get: (ref) => this.cellTable.get(ref),
    edit: (ref, tx) => {
      this.assertActiveTransaction(tx)
      return {
        set: (value) => this.cellTable.applyUpdate(ref, () => value),
      }
    },
  }

  readonly array: FlatNodeStoreContract["array"] = {
    create: (items) => this.arrayTable.create(items),
    get: (ref) => this.arrayTable.get(ref),
    edit: (ref, tx) => {
      this.assertActiveTransaction(tx)
      return {
        remove: (index) => {
          this.arrayTable.applyUpdate(ref, (previousItems) => [
            ...previousItems.slice(0, index),
            ...previousItems.slice(index + 1),
          ])
        },
        insert: (index, item) => {
          this.arrayTable.applyUpdate(ref, (previousItems) => [
            ...previousItems.slice(0, index),
            item,
            ...previousItems.slice(index),
          ])
        },
      }
    },
  }

  readonly map: FlatNodeStoreContract["map"] = {
    create: (fields) => this.mapTable.create(fields),
    get: (ref) => this.mapTable.get(ref),
    edit: (ref, tx) => {
      this.assertActiveTransaction(tx)
      return {
        set: (field, item) => {
          this.mapTable.applyUpdate(ref, (previousFields) => ({
            ...previousFields,
            [field]: item,
          }))
        },
        remove: (field) => {
          this.mapTable.applyUpdate(ref, (previousFields) => {
            const fields = { ...previousFields }
            delete fields[field]
            return fields
          })
        },
      }
    },
  }

  attach<Ref extends FlatNodeRef>(ref: Ref): Ref & RootRef {
    if (!this.cellTable.has(ref) && !this.arrayTable.has(ref) && !this.mapTable.has(ref)) {
      throw new Error(`Reference with key ${ref} does not exist.`)
    }
    return ref as Ref & RootRef
  }

  transact<T>(callback: (tx: TransactionToken) => T): T {
    const tx = Symbol("transactionTransaction") as TransactionToken
    this.activeTransactions.add(tx)
    try {
      return callback(tx)
    } finally {
      this.activeTransactions.delete(tx)
    }
  }

  private assertActiveTransaction(tx: TransactionToken): void {
    if (!this.activeTransactions.has(tx)) {
      throw new Error("Invalid transaction.")
    }
  }
}

class ReferenceTable<Kind extends NodeKind, Value extends JSONValue> {
  private static counter = 0
  private readonly table = new Map<FlatNodeRefs[Kind], Value>()

  create(value: Value): FlatNodeRefs[Kind] {
    const ref = `node:${ReferenceTable.counter++}` as FlatNodeRefs[Kind]
    this.table.set(ref, value)
    return ref
  }

  get(ref: FlatNodeRefs[Kind]): Value {
    const value = this.table.get(ref)
    if (value === undefined) {
      throw new Error(`Value with key ${ref} does not exist.`)
    }
    return value
  }

  applyUpdate(ref: FlatNodeRefs[Kind], updater: Update<Value>): void {
    const previousValue = this.get(ref)
    const value = typeof updater === "function" ? updater(previousValue) : updater
    this.table.set(ref, value)
  }

  has(ref: FlatNodeRef): boolean {
    return this.table.has(ref as FlatNodeRefs[Kind])
  }
}

export type Update<Value extends JSONValue> = Value | ((previousValue: Value) => Value)

type TransactionToken = Branded<symbol, "TransactionToken">
