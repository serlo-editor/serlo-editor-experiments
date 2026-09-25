// Values

type JSONValue = boolean | string | JSONValue[] | { [key: string]: JSONValue }
type ValueType = "boolean" | "string" | "array" | "object"
type JSONValueOf<V extends BaseValue> = V extends BaseValue<infer Serialized> ? Serialized : never
type ValueOf<Serialized extends JSONValue> = Serialized extends boolean
  ? BooleanValue
  : Serialized extends string
    ? StringValue
    : Serialized extends JSONValue[]
      ? ArrayValue<ValueOf<Serialized[number]>>
      : Serialized extends { [key: string]: JSONValue }
        ? ObjectValue<{ [Key in keyof Serialized]: ValueOf<Serialized[Key]> }>
        : never

interface BaseValue<Serialized extends JSONValue = JSONValue> {
  readonly type: ValueType
  get(): Serialized
}

interface BooleanValue extends BaseValue<boolean> {
  readonly type: "boolean"
  set(value: boolean): void
}

interface StringValue extends BaseValue<string> {
  readonly type: "string"
  set(value: string): void
}

interface ArrayValue<T extends Value = Value> extends BaseValue<JSONValueOf<T>[]> {
  readonly type: "array"
  map<R>(fn: (value: T, index: number) => R): R[]
}

type ObjectValue<Properties extends { [key: string]: Value } = {}> = BaseValue<{
  [Key in keyof Properties]: JSONValueOf<Properties[Key]>
}> & {
  readonly type: "object"
} & Properties

type Value = BooleanValue | StringValue | ArrayValue | ObjectValue

// Storage

interface JSONStorage {
  save<Serialized extends JSONValue>(value: Serialized): ValueOf<Serialized>
}
