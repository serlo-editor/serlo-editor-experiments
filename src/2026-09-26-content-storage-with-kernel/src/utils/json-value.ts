export type Primitive = null | string | number | boolean

/** A value that can be represented as JSON. */
export type JSONValue =
  | readonly JSONValue[]
  | { readonly [key: string]: JSONValue }
  | null
  | string
  | number
  | boolean
