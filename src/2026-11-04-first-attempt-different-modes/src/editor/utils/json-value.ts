export type JSONValue = readonly JSONValue[] | { readonly [key: string]: JSONValue } | Primitive

export type Primitive = null | string | number | boolean
