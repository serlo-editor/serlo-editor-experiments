interface FlatNodes {
  string: string
  number: number
  boolean: boolean
  array: Ref[]
  object: Record<string, Ref | undefined>
}

type FlatNodeType = keyof FlatNodes
type ValueOf<Kind extends FlatNodeType> = FlatNodes[Kind]

interface Ref<Kind extends FlatNodeType = FlatNodeType> {
  kind: Kind
  key: string
}

interface FlatStorage {
  set<K extends FlatNodeType>(ref: Ref<K>, value: ValueOf<K>): void
  get<K extends FlatNodeType>(ref: Ref<K>): ValueOf<K> | undefined
  update<K extends FlatNodeType>(
    ref: Ref<K>,
    value: ValueOf<K> | ((current: ValueOf<K>) => ValueOf<K>),
  ): void
}
