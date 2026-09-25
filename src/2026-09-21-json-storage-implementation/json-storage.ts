// Values

type JSONValue = boolean | string | JSONValue[] | { [key: string]: JSONValue }
type ValueType = "boolean" | "string" | "array" | "object"

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

interface ArrayValue<T extends Value = Value> extends BaseValue<ValueOf<T>[]> {
  readonly type: "array"
  map<R>(fn: (value: T, index: number) => R): R[]
}

interface ObjectValue extends BaseValue<{ [key: string]: ValueOf<Value> }> {
  readonly type: "object"
}

type Value = BooleanValue | StringValue | ArrayValue | ObjectValue

type ValueOf<V extends Value> = V extends BaseValue<infer Serialized> ? Serialized : never
