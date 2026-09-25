// Values

type JSONValue = boolean | string | JSONValue[] | { [key: string]: JSONValue }
type ValueType = "boolean" | "string" | "array" | "object"
interface BaseValue<Serialized extends JSONValue, Kind extends ValueType> {
  readonly type: Kind
  get(): Serialized
}

interface BooleanValue extends BaseValue<boolean, "boolean"> {
  set(value: boolean): void
}

interface StringValue extends BaseValue<string, "string"> {
  set(value: string): void
}

interface ArrayValue<Item extends JSONValue> extends BaseValue<Item[], "array"> {
  map<R>(fn: (value: ValueOf<Item>, index: number) => R): R[]
}

interface ObjectValue<Shape extends Record<string, JSONValue>> extends BaseValue<Shape, "object"> {
  field<Key extends keyof Shape>(key: Key): ValueOf<Shape[Key]>
}

type ValueOf<Serialized extends JSONValue> = Serialized extends boolean
  ? BooleanValue
  : Serialized extends string
    ? StringValue
    : Serialized extends JSONValue[]
      ? ArrayValue<Serialized[number]>
      : Serialized extends Record<string, JSONValue>
        ? ObjectValue<Serialized>
        : never

// Storage

interface JSONStorage {
  save<Serialized extends JSONValue>(value: Serialized): ValueOf<Serialized>
}
