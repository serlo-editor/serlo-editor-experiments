interface Schema<Value> {
  readonly kind: string
  readonly __value?: Value
}

type AnySchema = StringSchema | ArraySchema<any>
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

type FlatStore = Record<string, unknown>

function save<S extends AnySchema>(
  store: FlatStore,
  key: string,
  schema: S,
  value: ValueOf<S>,
): void {
  if (schema.kind === "string") {
    store[key] = value
    return
  }

  if (schema.kind === "array") {
    const childKeys = (value as unknown[]).map((_, index) => `${key}/${index}`)
    store[key] = childKeys

    ;(value as unknown[]).forEach((item, index) => {
      save(store, childKeys[index]!, schema.element, item)
    })
    return
  }

  throw new Error(`Unknown schema: ${schema.kind}`)
}

function load<S extends AnySchema>(
  store: FlatStore,
  key: string,
  schema: S,
): ValueOf<S> {
  const value = store[key]
  if (value === undefined) throw new Error(`Missing key: ${key}`)

  if (schema.kind === "string") {
    if (typeof value !== "string") throw new Error(`Expected string at ${key}`)
    return value as ValueOf<S>
  }

  if (schema.kind === "array") {
    if (!Array.isArray(value)) throw new Error(`Expected array at ${key}`)
    return value.map(childKey => load(store, childKey, schema.element)) as ValueOf<S>
  }

  throw new Error(`Unknown schema: ${schema.kind}`)
}

const tagsSchema = arraySchema(stringSchema())
const store: FlatStore = {}

save(store, "doc:tags", tagsSchema, ["ideas", "prototype"])

console.log(store)
console.log(load(store, "doc:tags", tagsSchema))
