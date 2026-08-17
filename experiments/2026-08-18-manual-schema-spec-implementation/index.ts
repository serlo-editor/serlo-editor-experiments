// schema.ts

interface Schema<Value> {
  readonly kind: string
  readonly __value?: Value
}

type AnySchema = Schema<unknown>
type ValueOf<S extends AnySchema> = S extends Schema<infer Value> ? Value : never

// schema/string

interface StringSchema extends Schema<string> {
  readonly kind: "string"
}

const string = (): StringSchema => ({ kind: "string" })

// schema/array

interface ArraySchema<C extends AnySchema> extends Schema<ValueOf<C>[]> {
  readonly kind: "array"
  readonly min?: number
  readonly max?: number
  readonly element: C
}

const array = <C extends AnySchema>(element: C, options?: { max?: number; min?: number }) => ({
  kind: "array",
  element,
  ...options,
})

// example usage

export const tags = array(string(), { min: 1, max: 5 })
