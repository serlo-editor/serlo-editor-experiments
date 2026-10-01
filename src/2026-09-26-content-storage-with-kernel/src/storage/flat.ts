import type { Branded } from "../utils.ts"
import type { NodeKind, NodeStore } from "./types.ts"
import type { JSONValue } from "./utils/json-value.ts"

type FlatNodeRefs = {
  cell: Branded<string, "cell">
  array: Branded<string, "array">
  map: Branded<string, "map">
}

type FlatNodeRef<Kind extends NodeKind = NodeKind> = FlatNodeRefs[Kind]

type FlatNodeStoreContract = NodeStore<FlatNodeRefs, TransactionToken>

export class FlatNodeStore implements FlatNodeStoreContract {
  private readonly refGenerator = new NodeRefGenerator()
  private readonly activeTransactions = new Set<TransactionToken>()

  private readonly cellTable = new ReferenceTable<"cell", JSONValue>(this.refGenerator)
  private readonly arrayTable = new ReferenceTable<"array", readonly FlatNodeRef[]>(
    this.refGenerator,
  )
  private readonly mapTable = new ReferenceTable<"map", Readonly<Record<string, FlatNodeRef>>>(
    this.refGenerator,
  )

  readonly cell = {
    create: (value) => this.cellTable.create(value),
    get: (ref) => this.cellTable.get(ref),
    edit: (ref, tx) => {
      if (!this.activeTransactions.has(tx)) {
        throw new Error("Invalid transaction.")
      }
      return {
        set: (value) => this.cellTable.applyUpdate(ref, () => value),
      }
    },
  } as FlatNodeStoreContract["cell"]

  readonly array = {
    create: (items) => this.arrayTable.create(items),
    get: (ref) => this.arrayTable.get(ref),
    edit: (ref, tx) => {
      if (!this.activeTransactions.has(tx)) {
        throw new Error("Invalid transaction.")
      }
      return {
        insert: (index, item) => {
          this.arrayTable.applyUpdate(ref, (previousItems) => [
            ...previousItems.slice(0, index),
            item,
            ...previousItems.slice(index),
          ])
        },
      }
    },
  } as FlatNodeStoreContract["array"]

  readonly map = {
    create: (fields) => this.mapTable.create(fields),
    get: (ref) => this.mapTable.get(ref),
    edit: (ref, tx) => {
      if (!this.activeTransactions.has(tx)) {
        throw new Error("Invalid transaction.")
      }
      return {
        set: (field, item) => {
          this.mapTable.applyUpdate(ref, (previousFields) => ({
            ...previousFields,
            [field]: item,
          }))
        },
      }
    },
  } as FlatNodeStoreContract["map"]

  attach<Ref extends FlatNodeRef>(ref: Ref): Ref {
    if (!this.cellTable.has(ref) && !this.arrayTable.has(ref) && !this.mapTable.has(ref)) {
      throw new Error(`Reference with key ${ref} does not exist.`)
    }
    return ref
  }

  transact<T>(callback: (tx: TransactionToken) => T): T {
    const tx = createTransactionToken()
    this.activeTransactions.add(tx)
    try {
      return callback(tx)
    } finally {
      this.activeTransactions.delete(tx)
    }
  }
}

class ReferenceTable<Kind extends NodeKind, Value extends JSONValue> {
  private readonly table = new Map<FlatNodeRef<Kind>, Value>()
  private readonly refGenerator: NodeRefGenerator

  constructor(refGenerator: NodeRefGenerator) {
    this.refGenerator = refGenerator
  }

  create(value: Value): FlatNodeRef<Kind> {
    const ref = this.refGenerator.next<Kind>()
    this.table.set(ref, value)
    return ref
  }

  get(ref: FlatNodeRef<Kind>): Value {
    const value = this.table.get(ref)
    if (value === undefined) {
      throw new Error(`Value with key ${ref} does not exist.`)
    }
    return value
  }

  applyUpdate(ref: FlatNodeRef<Kind>, updater: Update<Value>): void {
    const previousValue = this.get(ref)
    const value = typeof updater === "function" ? updater(previousValue) : updater
    this.table.set(ref, value)
  }

  has(ref: FlatNodeRef): boolean {
    return this.table.has(ref as FlatNodeRef<Kind>)
  }
}

export type Update<Value extends JSONValue> = Value | ((previousValue: Value) => Value)

class NodeRefGenerator {
  private static counter = 0

  next<Kind extends NodeKind>(): FlatNodeRef<Kind> {
    return `node:${NodeRefGenerator.counter++}` as FlatNodeRef<Kind>
  }
}

type TransactionToken = Branded<symbol, "TransactionToken">

function createTransactionToken(): TransactionToken {
  return Symbol("transactionTransaction") as TransactionToken
}
