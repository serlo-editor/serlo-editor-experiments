// Values

type JSONValue = boolean | string | JSONValue[] | { [key: string]: JSONValue }
type ValueType = "boolean" | "string" | "array" | "object"
type ValueOf<V extends BaseValue> = V extends BaseValue<infer Serialized> ? Serialized : never

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

type ObjectValue<Properties extends { [key: string]: Value } = {}> = BaseValue<{
  [Key in keyof Properties]: ValueOf<Properties[Key]>
}> & {
  readonly type: "object"
} & Properties

type Value = BooleanValue | StringValue | ArrayValue | ObjectValue
