import { ArrayKernel, Cell, CellKernel, StoreKernel, Update } from "./types"

function applyUpdate<Value>(previousValue: Value, update: Update<Value>): Value {
  if (typeof update !== "function") return update
  return (update as (previousValue: Value) => Value)(previousValue)
}

export class FlatStoreKernel implements StoreKernel<FlatKey, FlatKey> {
  private readonly cellKernel: FlatCellKernel
  private readonly arrayKernel: FlatArrayKernel

  readonly cell: CellKernel<FlatKey>
  readonly array: ArrayKernel<FlatKey, FlatKey>

  constructor() {
    const keyGenerator = new FlatKeyGenerator()
    this.cellKernel = new FlatCellKernel(keyGenerator)
    this.arrayKernel = new FlatArrayKernel(keyGenerator)
    this.cell = this.cellKernel
    this.array = this.arrayKernel
  }

  attach<Ref extends FlatKey>(ref: Ref): Ref {
    if (!this.cellKernel.has(ref) && !this.arrayKernel.has(ref)) {
      throw new Error(`Reference with key ${ref} does not exist.`)
    }
    return ref
  }
}

class FlatCellKernel implements CellKernel<FlatKey> {
  private readonly cells = new Map<FlatKey, unknown>()

  constructor(private readonly keyGenerator: FlatKeyGenerator) {}

  create<Value>(value: Value): Cell<FlatKey, Value> {
    const key = this.keyGenerator.next()
    this.cells.set(key, value)
    return key as Cell<FlatKey, Value>
  }

  get<Value>(ref: Cell<FlatKey, Value>): Value {
    if (!this.cells.has(ref)) {
      throw new Error(`Cell with key ${ref} does not exist.`)
    }
    return this.cells.get(ref) as Value
  }

  update<Value>(ref: Cell<FlatKey, Value>, update: Update<Value>): void {
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
