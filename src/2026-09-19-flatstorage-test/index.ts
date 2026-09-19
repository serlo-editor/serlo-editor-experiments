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

interface FlatNodeStorage {
  set<Kind extends FlatNodeKind>(
    reference: FlatNodeReference<Kind>,
    value: FlatNodeValue<Kind>,
  ): void
  get<Kind extends FlatNodeKind>(
    reference: FlatNodeReference<Kind>,
  ): FlatNodeValue<Kind> | undefined
  update<Kind extends FlatNodeKind>(
    reference: FlatNodeReference<Kind>,
    value: FlatNodeValue<Kind> | ((currentValue: FlatNodeValue<Kind>) => FlatNodeValue<Kind>),
  ): void
}
