/** A value that can be represented as JSON. */
export type JSONValue =
  | readonly JSONValue[]
  | { readonly [key: string]: JSONValue }
  | null
  | string
  | number
  | boolean
