import { applyUpdate, JSONValue, Update } from "../utils"
import { StoreKernel } from "./types"

export class FlatStoreKernel implements StoreKernel<FlatKey, FlatKey> {
  private readonly keyGenerator = new FlatKeyGenerator()
  readonly cell = new Bucket<JSONValue>(this.keyGenerator)
  readonly array = new Bucket<readonly FlatKey[]>(this.keyGenerator)

  attach<Ref extends FlatKey>(ref: Ref): Ref {
    if (!this.cell.has(ref) && !this.array.has(ref)) {
      throw new Error(`Reference with key ${ref} does not exist.`)
    }
    return ref
  }
}

class Bucket<Value extends JSONValue> {
  private readonly bucket = new Map<FlatKey, Value>()

  constructor(private readonly keyGenerator: FlatKeyGenerator) {}

  create(items: Value): FlatKey {
    const key = this.keyGenerator.next()
    this.bucket.set(key, items)
    return key
  }

  get(ref: FlatKey): Value {
    const items = this.bucket.get(ref)
    if (items === undefined) {
      throw new Error(`Value with key ${ref} does not exist.`)
    }
    return items
  }

  update(ref: FlatKey, update: Update<Value>): void {
    const previousValue = this.get(ref)
    this.bucket.set(ref, applyUpdate(previousValue, update))
  }

  has(ref: FlatKey): boolean {
    return this.bucket.has(ref)
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
