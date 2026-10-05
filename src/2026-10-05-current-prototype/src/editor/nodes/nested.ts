import * as S from "../schema"
import type { TypeGuard } from "../utils/type-guards"

export type NestedNode<S extends S.Schema = S.Schema> = S extends unknown ? _NestedNode<S> : never

interface _NestedNode<S extends S.Schema> {
  schema: S
  value: S.JSONValue<S>
}

export function getSingletonChild({ schema, value }: NestedNode<S.WrapperSchema | S.UnionSchema>) {
  if (S.isWrapper(schema)) {
    return { schema: schema.wrappedSchema, value: schema.unwrap(value) }
  } else {
    return { schema: schema.getOption(value), value }
  }
}

export function getItems({ schema, value }: NestedNode<S.ArraySchema>) {
  return value.map((itemValue) => {
    return { schema: schema.itemSchema, value: itemValue }
  })
}

export function getProperty<P extends Record<string, S.Schema>, K extends keyof P>(
  { schema, value }: NestedNode<S.ObjectSchema<P>>,
  key: K,
): NestedNode<P[K]> {
  return { schema: schema.properties[key], value: value[key] } as NestedNode<P[K]>
}

export const isBoolean = createGuard(S.isBoolean)
export const isRichText = createGuard(S.isRichText)
export const isLiteral = createGuard(S.isLiteral)
export const isWrapper = createGuard(S.isWrapper)
export const isUnion = createGuard(S.isUnion)
export const isArray = createGuard(S.isArray)
export const isObject = createGuard(S.isObject)
export const isPrimitive = createGuard(S.isPrimitive)
export const isLeaf = createGuard(S.isLeaf)
export const isSingleton = createGuard(S.isSingletonSchema)

function createGuard<S extends S.Schema>(schemaGuard: TypeGuard<S>) {
  return (node: NestedNode): node is NestedNode<S> => schemaGuard(node.schema)
}
