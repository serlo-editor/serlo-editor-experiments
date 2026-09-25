// Values

type JSONValue = string | JSONValue[]
type ValueType = "string" | "array"

interface BaseValue<Serialized extends JSONValue = JSONValue> {
  readonly type: ValueType
  load(): Serialized
}

interface StringValue extends BaseValue<string> {
  readonly type: "string"
  get(): string
  set(value: string): void
}

interface ArrayValue<T extends Value = Value> extends BaseValue<ValueOf<T>[]> {
  readonly type: "array"
  readonly length: number
  at(index: number): T | undefined
  map<R>(fn: (value: T, index: number) => R): R[]
  insert(index: number, value: ValueOf<T>): void
}

type Value = StringValue | ArrayValue

type ValueOf<V extends Value> = V extends BaseValue<infer Serialized> ? Serialized : never
