// buckets.ts

type BucketMap<Values extends object> = {
  [Kind in keyof Values]: Map<string, Values[Kind]>
}

class Buckets<Values extends object> {
  private readonly buckets: Partial<BucketMap<Values>> = {}

  write<Kind extends keyof Values>(kind: Kind, key: string, value: Values[Kind]): void {
    this.getBucket(kind).set(key, value)
  }

  read<Kind extends keyof Values>(kind: Kind, key: string): Values[Kind] | undefined {
    return this.getBucket(kind).get(key)
  }

  has<Kind extends keyof Values>(kind: Kind, key: string): boolean {
    return this.getBucket(kind).has(key)
  }

  private getBucket<Kind extends keyof Values>(kind: Kind): Map<string, Values[Kind]> {
    const bucket = this.buckets[kind]

    if (bucket) return bucket

    const newBucket = new Map<string, Values[Kind]>()
    this.buckets[kind] = newBucket

    return newBucket
  }
}

// flat-storage.ts

interface FlatNodeReference<Kind extends FlatNodeKind = FlatNodeKind> {
  kind: Kind
  key: string
}

interface FlatNodeValues {
  string: string
  number: number
  boolean: boolean
  array: FlatNodeReference[]
  object: Record<string, FlatNodeReference | undefined>
}

type FlatNodeKind = keyof FlatNodeValues
type FlatNodeValue<Kind extends FlatNodeKind> = FlatNodeValues[Kind]

class FlatStorage {
  private readonly buckets = new Buckets<FlatNodeValues>()

  save<Kind extends FlatNodeKind>(kind: Kind, value: FlatNodeValue<Kind>): FlatNodeReference<Kind> {
    const reference = { kind, key: this.createKey(kind) }

    this.buckets.write(reference.kind, reference.key, value)

    return reference
  }

  get<Kind extends FlatNodeKind>(reference: FlatNodeReference<Kind>): FlatNodeValue<Kind> {
    const value = this.buckets.read(reference.kind, reference.key)

    if (value === undefined) {
      throw new Error(`Cannot find node: ${reference.key}`)
    }

    return value
  }

  update<Kind extends FlatNodeKind>(
    reference: FlatNodeReference<Kind>,
    value: FlatNodeValue<Kind> | ((currentValue: FlatNodeValue<Kind>) => FlatNodeValue<Kind>),
  ): void {
    const nextValue = typeof value === "function" ? value(this.get(reference)) : value

    this.buckets.write(reference.kind, reference.key, nextValue)
  }

  private createKey<Kind extends FlatNodeKind>(kind: Kind): string {
    let key: string

    do {
      key = `${kind}-${Math.random().toString(36).slice(2)}`
    } while (this.buckets.has(kind, key))

    return key
  }
}
