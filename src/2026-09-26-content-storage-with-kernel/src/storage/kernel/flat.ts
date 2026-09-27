import { CellKernel } from "./types"

class FlatCellKernel implements CellKernel<FlatKey> {
  private readonly cellMap = new Map<FlatKey, unknown>()

  constructor(private readonly keyGenerator: FlatKeyGenerator) {}

  create<Value>(value: Value): FlatKey {
    const key = this.keyGenerator.next()
    this.cellMap.set(key, value)
    return key
  }

  get<Value>(ref: FlatKey): Value {
    if (!this.cellMap.has(ref)) {
      throw new Error(`Cell with key ${ref} does not exist.`)
    }
    return this.cellMap.get(ref) as Value
  }

  update<Value>(ref: FlatKey, update: (previousValue: Value) => Value): void {
    if (!this.cellMap.has(ref)) {
      throw new Error(`Cell with key ${ref} does not exist.`)
    }
    const previousValue = this.cellMap.get(ref) as Value
    const newValue = update(previousValue)
    this.cellMap.set(ref, newValue)
  }
}

class FlatKeyGeneratorImpl implements FlatKeyGenerator {
  private counter = 0

  next(): FlatKey {
    return `node:${this.counter++}` as FlatKey
  }
}

interface FlatKeyGenerator {
  next(): FlatKey
}

type FlatKey = string & { readonly [flatKeySymbol]: true }

declare const flatKeySymbol: unique symbol
