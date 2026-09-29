import type { NodeStore } from "./types.ts"
import type { JSONValue } from "./utils/json-value.ts"

type FlatNodeStoreContract = NodeStore<FlatNodeRef, FlatNodeRef, FlatNodeRef, TransactionToken>

export class FlatNodeStore implements FlatNodeStoreContract {
  private readonly refGenerator = new NodeRefGenerator()
  private readonly activeTransactions = new Set<TransactionToken>()

  private readonly cellTable = new ReferenceTable<JSONValue>(this.refGenerator)
  private readonly arrayTable = new ReferenceTable<readonly FlatNodeRef[]>(this.refGenerator)
  private readonly mapTable = new ReferenceTable<Readonly<Record<string, FlatNodeRef>>>(
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

class ReferenceTable<Value extends JSONValue> {
  private readonly table = new Map<FlatNodeRef, Value>()
  private readonly refGenerator: NodeRefGenerator

  constructor(refGenerator: NodeRefGenerator) {
    this.refGenerator = refGenerator
  }

  create(value: Value): FlatNodeRef {
    const ref = this.refGenerator.next()
    this.table.set(ref, value)
    return ref
  }

  get(ref: FlatNodeRef): Value {
    const value = this.table.get(ref)
    if (value === undefined) {
      throw new Error(`Value with key ${ref} does not exist.`)
    }
    return value
  }

  applyUpdate(ref: FlatNodeRef, updater: Update<Value>): void {
    const previousValue = this.get(ref)
    const value = typeof updater === "function" ? updater(previousValue) : updater
    this.table.set(ref, value)
  }

  has(ref: FlatNodeRef): boolean {
    return this.table.has(ref)
  }
}

export type Update<Value extends JSONValue> = Value | ((previousValue: Value) => Value)

class NodeRefGenerator {
  private static counter = 0

  next(): FlatNodeRef {
    return `node:${NodeRefGenerator.counter++}` as FlatNodeRef
  }
}

type FlatNodeRef = string & { readonly [flatNodeRefSymbol]: true }

declare const flatNodeRefSymbol: unique symbol

type TransactionToken = symbol & { readonly [transactionTokenSymbol]: true }

declare const transactionTokenSymbol: unique symbol

function createTransactionToken(): TransactionToken {
  return Symbol("transactionTransaction") as TransactionToken
}
