import { applyUpdate, JSONValue, Update } from "../utils"
import { Storage } from "./types"

export class FlatStorage implements Storage<FlatKey, FlatKey> {
  private readonly keyGenerator = new FlatKeyGenerator()

  private readonly cellBucket = new Bucket<JSONValue>(this.keyGenerator)
  private readonly arrayBucket = new Bucket<readonly FlatKey[]>(this.keyGenerator)

  readonly cell = {
    create: (value: JSONValue): FlatKey => this.cellBucket.create(value),
    get: (ref: FlatKey): JSONValue => this.cellBucket.get(ref),
    set: (ref: FlatKey, value: JSONValue): void => this.cellBucket.update(ref, value),
  }

  readonly array = {
    create: (items: readonly FlatKey[]): FlatKey => this.arrayBucket.create(items),
    get: (ref: FlatKey): readonly FlatKey[] => this.arrayBucket.get(ref),
    insert: (ref: FlatKey, index: number, item: FlatKey): void => {
      this.arrayBucket.update(ref, (previousItems) => [
        ...previousItems.slice(0, index),
        item,
        ...previousItems.slice(index),
      ])
    },
  }

  attach<Ref extends FlatKey>(ref: Ref): Ref {
    if (!this.cellBucket.has(ref) && !this.arrayBucket.has(ref)) {
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
