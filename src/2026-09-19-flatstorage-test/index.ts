interface FlatNodeValues {
  string: string
  number: number
  boolean: boolean
  array: FlatNodeReference[]
  object: Record<string, FlatNodeReference | undefined>
}

type FlatNodeKind = keyof FlatNodeValues
type FlatNodeValue<Kind extends FlatNodeKind> = FlatNodeValues[Kind]

interface FlatNodeReference<Kind extends FlatNodeKind = FlatNodeKind> {
  kind: Kind
  key: string
}

type FlatNodeBuckets = {
  [Kind in FlatNodeKind]: Map<string, FlatNodeValue<Kind>>
}

class FlatNodeStorage {
  private readonly buckets: FlatNodeBuckets = {
    string: new Map(),
    number: new Map(),
    boolean: new Map(),
    array: new Map(),
    object: new Map(),
  }

  save<Kind extends FlatNodeKind>(kind: Kind, value: FlatNodeValue<Kind>): FlatNodeReference<Kind> {
    const reference = { kind, key: this.createKey(kind) }

    this.set(reference, value)

    return reference
  }

  get<Kind extends FlatNodeKind>(reference: FlatNodeReference<Kind>): FlatNodeValue<Kind> {
    const value = this.buckets[reference.kind].get(reference.key)

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

    this.set(reference, nextValue)
  }

  private set<Kind extends FlatNodeKind>(
    reference: FlatNodeReference<Kind>,
    value: FlatNodeValue<Kind>,
  ): void {
    this.buckets[reference.kind].set(reference.key, value)
  }

  private createKey<Kind extends FlatNodeKind>(kind: Kind): string {
    let key: string

    do {
      key = `${kind}-${Math.random().toString(36).slice(2)}`
    } while (this.buckets[kind].has(key))

    return key
  }
}
