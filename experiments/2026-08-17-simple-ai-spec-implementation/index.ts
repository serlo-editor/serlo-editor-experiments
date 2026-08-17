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

type FlatStore = Record<string, unknown>
type NestedStore = Record<string, JsonValue>

interface StoreAdapter<Store> {
  save<S extends AnySchema>(store: Store, key: string, schema: S, value: ValueOf<S>): void

  load<S extends AnySchema>(store: Store, key: string, schema: S): ValueOf<S>
}

const flatStoreAdapter: StoreAdapter<FlatStore> = {
  save(store, key, schema, value) {
    if (isStringSchema(schema)) {
      store[key] = value
      return
    }

    if (isArraySchema(schema)) {
      const childKeys = (value as unknown[]).map((_, index) => `${key}/${index}`)
      store[key] = childKeys

      ;(value as unknown[]).forEach((item, index) => {
        flatStoreAdapter.save(store, childKeys[index]!, schema.element, item)
      })
      return
    }

    throw new Error(`Unknown schema: ${schema.kind}`)
  },

  load(store, key, schema) {
    const value = store[key]
    if (value === undefined) throw new Error(`Missing key: ${key}`)

    if (isStringSchema(schema)) {
      if (typeof value !== "string") throw new Error(`Expected string at ${key}`)
      return value
    }

    if (isArraySchema(schema)) {
      if (!Array.isArray(value)) throw new Error(`Expected array at ${key}`)
      return value.map((childKey) => flatStoreAdapter.load(store, childKey, schema.element))
    }

    throw new Error(`Unknown schema: ${schema.kind}`)
  },
}

const nestedStoreAdapter: StoreAdapter<NestedStore> = {
  save(store, key, _schema, value) {
    store[key] = value
  },

  load(store, key) {
    const value = store[key]
    if (value === undefined) throw new Error(`Missing key: ${key}`)
    return value
  },
}

const tagsSchema = arraySchema(stringSchema())
const tags = ["ideas", "prototype"]

const flatStore: FlatStore = {}
flatStoreAdapter.save(flatStore, "doc:tags", tagsSchema, tags)
console.log("flat", flatStore)
console.log("flat loaded", flatStoreAdapter.load(flatStore, "doc:tags", tagsSchema))

const nestedStore: NestedStore = {}
nestedStoreAdapter.save(nestedStore, "doc:tags", tagsSchema, tags)
console.log("nested", nestedStore)
console.log("nested loaded", nestedStoreAdapter.load(nestedStore, "doc:tags", tagsSchema))
