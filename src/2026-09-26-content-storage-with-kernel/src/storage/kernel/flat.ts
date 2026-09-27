import { applyUpdate, StorableValue, Update } from "../utils"
import { ArrayKernel, Cell, CellKernel, StoreKernel } from "./types"

export class FlatStoreKernel implements StoreKernel<FlatKey, FlatKey> {
  readonly cell: FlatCellKernel
  readonly array: FlatArrayKernel

  constructor() {
    const keyGenerator = new FlatKeyGenerator()

    this.cell = new FlatCellKernel(keyGenerator)
    this.array = new FlatArrayKernel(keyGenerator)
  }

  attach<Ref extends FlatKey>(ref: Ref): Ref {
    if (!this.cell.has(ref) && !this.array.has(ref)) {
      throw new Error(`Reference with key ${ref} does not exist.`)
    }
    return ref
  }
}

class FlatCellKernel implements CellKernel<FlatKey> {
  private readonly cells = new Map<FlatKey, unknown>()

  constructor(private readonly keyGenerator: FlatKeyGenerator) {}

  create<Value extends StorableValue>(value: Value): Cell<FlatKey, Value> {
    const key = this.keyGenerator.next()
    this.cells.set(key, value)
    return key as Cell<FlatKey, Value>
  }

  get<Value extends StorableValue>(ref: Cell<FlatKey, Value>): Value {
    if (!this.cells.has(ref)) {
      throw new Error(`Cell with key ${ref} does not exist.`)
    }
    return this.cells.get(ref) as Value
  }

  update<Value extends StorableValue>(ref: Cell<FlatKey, Value>, update: Update<Value>): void {
    const previousValue = this.get(ref)
    this.cells.set(ref, applyUpdate(previousValue, update))
  }

  has(ref: FlatKey): boolean {
    return this.cells.has(ref)
  }
}

class FlatArrayKernel implements ArrayKernel<FlatKey, FlatKey> {
  private readonly arrays = new Map<FlatKey, readonly FlatKey[]>()

  constructor(private readonly keyGenerator: FlatKeyGenerator) {}

  create(items: readonly FlatKey[]): FlatKey {
    const key = this.keyGenerator.next()
    this.arrays.set(key, items)
    return key
  }

  get(ref: FlatKey): readonly FlatKey[] {
    const items = this.arrays.get(ref)
    if (items === undefined) {
      throw new Error(`Array with key ${ref} does not exist.`)
    }
    return items
  }

  update(ref: FlatKey, update: Update<readonly FlatKey[]>): void {
    const previousItems = this.get(ref)
    this.arrays.set(ref, applyUpdate(previousItems, update))
  }

  has(ref: FlatKey): boolean {
    return this.arrays.has(ref)
  }
}

class FlatKeyGenerator {
  private counter = 0

  next(): FlatKey {
    return `node:${this.counter++}` as FlatKey
  }
}

type FlatKey = string & { readonly [flatKeySymbol]: true }

declare const flatKeySymbol: unique symbol
