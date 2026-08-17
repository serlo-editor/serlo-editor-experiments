type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

interface Schema<Value> {
  readonly kind: string
  readonly __value?: Value
}

type AnySchema = Schema<unknown>
type ValueOf<S extends AnySchema> = S extends Schema<infer Value> ? Value : never

type StringSchema = Schema<string> & { readonly kind: "string" }
type ArraySchema<C extends AnySchema> = Schema<ValueOf<C>[]> & {
  readonly kind: "array"
  readonly element: C
}

const stringSchema = (): StringSchema => ({ kind: "string" })
const arraySchema = <C extends AnySchema>(element: C): ArraySchema<C> => ({
  kind: "array",
  element,
})

const isStringSchema = (schema: AnySchema): schema is StringSchema => schema.kind === "string"

const isArraySchema = (schema: AnySchema): schema is ArraySchema<AnySchema> =>
  schema.kind === "array"

function encode<S extends AnySchema>(schema: S, value: ValueOf<S>): JsonValue {
  if (isStringSchema(schema)) return value as string
  if (isArraySchema(schema)) {
    return (value as unknown[]).map((item) => encode(schema.element, item))
  }
  throw new Error(`Unknown schema: ${schema.kind}`)
}

function decode<S extends AnySchema>(schema: S, json: JsonValue): ValueOf<S> {
  if (isStringSchema(schema)) {
    if (typeof json !== "string") throw new Error("Expected string")
    return json as ValueOf<S>
  }
  if (isArraySchema(schema)) {
    if (!Array.isArray(json)) throw new Error("Expected array")
    return json.map((item) => decode(schema.element, item)) as ValueOf<S>
  }
  throw new Error(`Unknown schema: ${schema.kind}`)
}

type FlatStore = Record<string, string>

function save<S extends AnySchema>(store: FlatStore, key: string, schema: S, value: ValueOf<S>) {
  store[key] = JSON.stringify(encode(schema, value))
}

function load<S extends AnySchema>(store: FlatStore, key: string, schema: S): ValueOf<S> {
  const raw = store[key]
  if (raw === undefined) throw new Error(`Missing key: ${key}`)
  return decode(schema, JSON.parse(raw) as JsonValue)
}

const tagsSchema = arraySchema(stringSchema())
const store: FlatStore = {}
const tags = ["ideas", "prototype"]

save(store, "doc:tags", tagsSchema, tags)
console.log("saved", store["doc:tags"])
console.log("loaded", load(store, "doc:tags", tagsSchema))
