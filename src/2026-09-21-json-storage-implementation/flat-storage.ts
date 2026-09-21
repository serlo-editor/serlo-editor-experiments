type BucketsByKind<ValueByKind extends object> = {
  [Kind in keyof ValueByKind]: Map<string, ValueByKind[Kind]>
}

class ValueBuckets<ValueByKind extends object> {
  private readonly buckets: Partial<BucketsByKind<ValueByKind>> = {}

  write<Kind extends keyof ValueByKind>(kind: Kind, key: string, value: ValueByKind[Kind]): void {
    this.getBucket(kind).set(key, value)
  }

  read<Kind extends keyof ValueByKind>(kind: Kind, key: string): ValueByKind[Kind] | undefined {
    return this.getBucket(kind).get(key)
  }

  has<Kind extends keyof ValueByKind>(kind: Kind, key: string): boolean {
    return this.getBucket(kind).has(key)
  }

  private getBucket<Kind extends keyof ValueByKind>(kind: Kind): Map<string, ValueByKind[Kind]> {
    const bucket = this.buckets[kind]

    if (bucket) return bucket

    const newBucket = new Map<string, ValueByKind[Kind]>()
    this.buckets[kind] = newBucket

    return newBucket
  }
}

interface NodeValueByKind {
  string: string
  number: number
  boolean: boolean
  array: NodeReference[]
  object: Record<string, NodeReference | undefined>
}

type NodeKind = keyof NodeValueByKind
type NodeValue<Kind extends NodeKind> = NodeValueByKind[Kind]

interface NodeReference<Kind extends NodeKind = NodeKind> {
  kind: Kind
  key: string
}

export class FlatNodeStore {
  private readonly buckets = new ValueBuckets<NodeValueByKind>()

  create<Kind extends NodeKind>(kind: Kind, value: NodeValue<Kind>): NodeReference<Kind> {
    const reference = { kind, key: this.createKey(kind) }

    this.buckets.write(reference.kind, reference.key, value)

    return reference
  }

  get<Kind extends NodeKind>(reference: NodeReference<Kind>): NodeValue<Kind> {
    const value = this.buckets.read(reference.kind, reference.key)

    if (value === undefined) {
      throw new Error(`Cannot find node: ${reference.key}`)
    }

    return value
  }

  update<Kind extends NodeKind>(
    reference: NodeReference<Kind>,
    value: NodeValue<Kind> | ((currentValue: NodeValue<Kind>) => NodeValue<Kind>),
  ): void {
    const nextValue = typeof value === "function" ? value(this.get(reference)) : value

    this.buckets.write(reference.kind, reference.key, nextValue)
  }

  private createKey<Kind extends NodeKind>(kind: Kind): string {
    let key: string

    do {
      key = `${kind}-${Math.random().toString(36).slice(2)}`
    } while (this.buckets.has(kind, key))

    return key
  }
}
