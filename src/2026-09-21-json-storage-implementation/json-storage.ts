// Values

type JSONValue = string | JSONValue[]
type ValueType = "string" | "array"

interface BaseValue<Serialized extends JSONValue = JSONValue> {
  readonly type: ValueType
  get(): Serialized
}

interface StringValue extends BaseValue<string> {
  readonly type: "string"
  set(value: string): void
}

interface ArrayValue<T extends Value = Value> extends BaseValue<ValueOf<T>[]> {
  readonly type: "array"
  map<R>(fn: (value: T, index: number) => R): R[]
}

type Value = StringValue | ArrayValue

type ValueOf<V extends Value> = V extends BaseValue<infer Serialized> ? Serialized : never
