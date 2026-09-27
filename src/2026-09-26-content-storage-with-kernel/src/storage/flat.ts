import type { Storage } from "./types"
import type { JSONValue } from "./utils/json-value"
import { applyUpdate } from "./utils/update"
import type { Update } from "./utils/update"

type TransactionToken = symbol & { readonly [transactionTokenSymbol]: true }

declare const transactionTokenSymbol: unique symbol

type FlatStorageContract = Storage<FlatStorageRef, FlatStorageRef, TransactionToken>

export class FlatStorage implements FlatStorageContract {
  private readonly refGenerator = new StorageRefGenerator()
  private readonly activeTransactions = new Set<TransactionToken>()

  private readonly cellTable = new ReferenceTable<JSONValue>(this.refGenerator)
  private readonly arrayTable = new ReferenceTable<readonly FlatStorageRef[]>(this.refGenerator)

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
  } as FlatStorageContract["cell"]

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
  } as FlatStorageContract["array"]

  attach<Ref extends FlatStorageRef>(ref: Ref): Ref {
    if (!this.cellTable.has(ref) && !this.arrayTable.has(ref)) {
      throw new Error(`Reference with key ${ref} does not exist.`)
    }
    return ref
  }

  mutate<T>(transaction: (tx: TransactionToken) => T): T {
    const tx = Symbol("flatStorageTransaction") as TransactionToken
    this.activeTransactions.add(tx)
    try {
      return transaction(tx)
    } finally {
      this.activeTransactions.delete(tx)
    }
  }
}

class ReferenceTable<Value extends JSONValue> {
  private readonly table = new Map<FlatStorageRef, Value>()

  constructor(private readonly refGenerator: StorageRefGenerator) {}

  create(value: Value): FlatStorageRef {
    const ref = this.refGenerator.next()
    this.table.set(ref, value)
    return ref
  }

  get(ref: FlatStorageRef): Value {
    const value = this.table.get(ref)
    if (value === undefined) {
      throw new Error(`Value with key ${ref} does not exist.`)
    }
    return value
  }

  applyUpdate(ref: FlatStorageRef, updater: Update<Value>): void {
    const previousValue = this.get(ref)
    this.table.set(ref, applyUpdate(previousValue, updater))
  }

  has(ref: FlatStorageRef): boolean {
    return this.table.has(ref)
  }
}

class StorageRefGenerator {
  private static counter = 0

  next(): FlatStorageRef {
    return `node:${StorageRefGenerator.counter++}` as FlatStorageRef
  }
}

type FlatStorageRef = string & { readonly [flatStorageRefSymbol]: true }

declare const flatStorageRefSymbol: unique symbol
