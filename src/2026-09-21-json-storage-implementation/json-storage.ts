// Values

interface Value<JSONValue = unknown> {
  readonly type: string
  load(): JSONValue
}

interface PrimitiveValue<JSONValue extends string | number | boolean> extends Value<JSONValue> {
  get(): JSONValue
  set(value: JSONValue): void
}

interface StringValue extends PrimitiveValue<string> {
  readonly type: "string"
}

interface ArrayValue<T extends Value = Value> extends Value {
  readonly type: "array"
  readonly length: number
  at(index: number): T
  map<R>(fn: (value: T, index: number) => R): R[]
}
