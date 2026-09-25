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

interface ObjectValue<
  Properties extends { [key: string]: Value } = { [key: string]: Value },
> extends BaseValue<{ [Key in keyof Properties]: ValueOf<Properties[Key]> }> {
  readonly type: "object"
  getProperty<Key extends keyof Properties>(key: Key): Properties[Key]
}

type Value = BooleanValue | StringValue | ArrayValue | ObjectValue

type ValueOf<V extends Value> = V extends BaseValue<infer Serialized> ? Serialized : never
