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

  set<Kind extends FlatNodeKind>(
    reference: FlatNodeReference<Kind>,
    value: FlatNodeValue<Kind>,
  ): void {
    this.buckets[reference.kind].set(reference.key, value)
  }

  get<Kind extends FlatNodeKind>(
    reference: FlatNodeReference<Kind>,
  ): FlatNodeValue<Kind> | undefined {
    return this.buckets[reference.kind].get(reference.key)
  }

  update<Kind extends FlatNodeKind>(
    reference: FlatNodeReference<Kind>,
    value: FlatNodeValue<Kind> | ((currentValue: FlatNodeValue<Kind>) => FlatNodeValue<Kind>),
  ): void {
    if (typeof value !== "function") {
      this.set(reference, value)
      return
    }

    const currentValue = this.get(reference)

    if (currentValue === undefined) {
      throw new Error(`Cannot update missing node: ${reference.kind}:${reference.key}`)
    }

    this.set(reference, value(currentValue))
  }
}
