// Value types

export interface BooleanValue {
  get(): boolean
  set(value: boolean): void
}

export interface StringValue {
  get(): string
  set(value: string): void
}

export interface ArrayValue<T> {
  readonly length: number
  at(index: number): T
  map<R>(fn: (value: T, index: number) => R): R[]
}

export type SchemaProperties = { readonly [key: string]: Schema }

export type ObjectValue<P extends SchemaProperties> = {
  readonly [K in keyof P]: ValueOf<P[K]>
}

export type Value = BooleanValue | StringValue | ArrayValue<unknown> | ObjectValue<SchemaProperties>

// Schemas

export type SchemaKind = "boolean" | "string" | "array" | "object"

export interface Schema<V extends Value = Value, JSONValue = unknown> {
  readonly kind: SchemaKind
  readonly __value?: V
  readonly __jsonValue?: JSONValue
  visit<Input, Output>(visitor: SchemaVisitor<Input, Output>, input: Input): Output
}

export type ValueOf<S extends Schema> = S extends Schema<infer V, unknown> ? V : never

export type JSONValueOf<S extends Schema> =
  S extends Schema<Value, infer JSONValue> ? JSONValue : never

export interface SchemaVisitor<Input, Output> {
  boolean(schema: BooleanSchema, input: Input): Output
  string(schema: StringSchema, input: Input): Output
  array(schema: ArraySchema<Schema>, input: Input): Output
  object(schema: ObjectSchema<SchemaProperties>, input: Input): Output
}

export interface BooleanSchema extends Schema<BooleanValue, boolean> {
  readonly kind: "boolean"
}

export function boolean(): BooleanSchema {
  return {
    kind: "boolean",
    visit(visitor, input) {
      return visitor.boolean(this, input)
    },
  }
}

export interface StringSchema extends Schema<StringValue, string> {
  readonly kind: "string"
}

export function string(): StringSchema {
  return {
    kind: "string",
    visit(visitor, input) {
      return visitor.string(this, input)
    },
  }
}

export interface ArraySchema<C extends Schema> extends Schema<
  ArrayValue<ValueOf<C>>,
  JSONValueOf<C>[]
> {
  readonly kind: "array"
  readonly element: C
}

export function array<C extends Schema>(element: C): ArraySchema<C> {
  return {
    kind: "array",
    element,
    visit(visitor, input) {
      return visitor.array(this, input)
    },
  }
}

export type ObjectJSONValue<P extends SchemaProperties> = {
  [K in keyof P]: JSONValueOf<P[K]>
}

export interface ObjectSchema<P extends SchemaProperties> extends Schema<
  ObjectValue<P>,
  ObjectJSONValue<P>
> {
  readonly kind: "object"
  readonly properties: P
}

export function object<P extends SchemaProperties>(properties: P): ObjectSchema<P> {
  return {
    kind: "object",
    properties,
    visit(visitor, input) {
      return visitor.object(this, input)
    },
  }
}
