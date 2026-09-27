import { Storage } from "./types"
import { applyUpdate, JSONValue, Update } from "./utils"

const flatStorageTransactionToken = Symbol("flatStorageTransaction")
type FlatStorageTransactionToken = typeof flatStorageTransactionToken

export class FlatStorage implements Storage<FlatStorageRef, FlatStorageRef, FlatStorageTransactionToken> {
  private readonly refGenerator = new StorageRefGenerator()

  private readonly cellTable = new ReferenceTable<JSONValue>(this.refGenerator)
  private readonly arrayTable = new ReferenceTable<readonly FlatStorageRef[]>(this.refGenerator)

  readonly cell = {
    create: (value: JSONValue): FlatStorageRef => this.cellTable.create(value),
    get: (ref: FlatStorageRef): JSONValue => this.cellTable.get(ref),
    edit: (
      ref: FlatStorageRef,
      tx: FlatStorageTransactionToken,
    ): { set: (value: JSONValue) => void } => {
      if (tx !== flatStorageTransactionToken) {
        throw new Error("Invalid transaction.")
      }
      return {
        set: (value: JSONValue) => this.cellTable.applyUpdate(ref, () => value),
      }
    },
  }

  readonly array = {
    create: (items: readonly FlatStorageRef[]): FlatStorageRef => this.arrayTable.create(items),
    get: (ref: FlatStorageRef): readonly FlatStorageRef[] => this.arrayTable.get(ref),
    edit: (
      ref: FlatStorageRef,
      tx: FlatStorageTransactionToken,
    ): { insert: (index: number, item: FlatStorageRef) => void } => {
      if (tx !== flatStorageTransactionToken) {
        throw new Error("Invalid transaction.")
      }
      return {
        insert: (index: number, item: FlatStorageRef) => {
          this.arrayTable.applyUpdate(ref, (previousItems) => [
            ...previousItems.slice(0, index),
            item,
            ...previousItems.slice(index),
          ])
        },
      }
    },
  }

  attach<Ref extends FlatStorageRef>(ref: Ref): Ref {
    if (!this.cellTable.has(ref) && !this.arrayTable.has(ref)) {
      throw new Error(`Reference with key ${ref} does not exist.`)
    }
    return ref
  }

  mutate<T>(transaction: (tx: FlatStorageTransactionToken) => T): T {
    return transaction(flatStorageTransactionToken)
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
  private counter = 0

  next(): FlatStorageRef {
    return `node:${this.counter++}` as FlatStorageRef
  }
}

type FlatStorageRef = string & { readonly [flatStorageRefSymbol]: true }

declare const flatStorageRefSymbol: unique symbol
