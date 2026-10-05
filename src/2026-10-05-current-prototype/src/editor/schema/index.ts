import { invariant } from "es-toolkit"
import type { NodeJSON } from "prosekit/core"
import type { ReactNode } from "react"
import * as Y from "yjs"

import type { FlatNode } from "../nodes/flat"
import type { RichTextFeature } from "../rich-text/types"
import type { EditorStore } from "../store/editor-store"
import { isKey, type Key } from "../store/key"
import * as T from "../utils/type-guards"
import type { JSONValue, PublicSchemaShape, Schema } from "./types"

export type { FlatValue, JSONValue, Schema } from "./types"

export interface BooleanSchema extends Schema<{
  kind: "boolean"
  FlatValue: boolean
  JSONValue: boolean
}> {}

export interface RichTextSchema extends Schema<{
  kind: "richText"
  FlatValue: null
  JSONValue: NodeJSON
}> {
  readonly features: Array<RichTextFeature>
}

export interface LiteralSchema<
  T extends string | number | boolean = string | number | boolean,
> extends Schema<{
  kind: "literal"
  FlatValue: T
  JSONValue: T
}> {
  readonly value: T
}

export interface WrapperSchema<S extends Schema = Schema, J = JSONValue<S>> extends Schema<{
  kind: "wrapper"
  FlatValue: Key
  JSONValue: J
}> {
  wrappedSchema: S
  wrap(inner: JSONValue<S>): J
  unwrap(outer: J): JSONValue<S>
}

export interface UnionSchema<S extends readonly Schema[] = readonly Schema[]> extends Schema<{
  kind: "union"
  FlatValue: Key
  JSONValue: JSONValue<S[number]>
}> {
  options: S
  getOption(value: JSONValue<S[number]>): S[number]
}

export interface ArraySchema<S extends Schema = Schema> extends Schema<{
  kind: "array"
  FlatValue: Y.Array<Key>
  JSONValue: JSONValue<S>[]
}> {
  itemSchema: S
  htmlTag?: React.HTMLElementType
  className?: string
}

export interface ObjectSchema<
  P extends Record<string, Schema> = Record<string, Schema>,
> extends Schema<{
  kind: "object"
  FlatValue: Y.Map<Key>
  JSONValue: { [K in keyof P]: JSONValue<P[K]> }
}> {
  properties: Readonly<P>
  keyOrder: readonly (keyof P)[]
  htmlTag?: React.HTMLElementType
  className?: string
}

interface CustomBehavior<S extends Schema = Schema> {
  render?: (args: {
    node: FlatNode<S>
    store: EditorStore
    renderChild: (node: FlatNode) => ReactNode
  }) => ReactNode
}

export function createBoolean(args: FactoryArguments<BooleanSchema>): BooleanSchema {
  return { kind: "boolean", isFlatValue: T.isBoolean, ...args }
}

export function createRichText(args: FactoryArguments<RichTextSchema>): RichTextSchema {
  return {
    kind: "richText",
    isFlatValue: T.isNull,
    ...args,
  }
}

export function createLiteral<Value extends string | number | boolean>(
  args: FactoryArguments<LiteralSchema<Value>>,
): LiteralSchema<Value> {
  return { kind: "literal", isFlatValue: T.literal(args.value), ...args }
}

export function createWrapper<S extends Schema, J = JSONValue<S>>(
  args: FactoryArguments<WrapperSchema<S, J>>,
): WrapperSchema<S, J> {
  return { kind: "wrapper", isFlatValue: isKey, ...args }
}

export function createUnion<S extends readonly Schema[]>(
  args: FactoryArguments<UnionSchema<S>>,
): UnionSchema<S> {
  return { kind: "union", isFlatValue: isKey, ...args }
}

export function createArray<S extends Schema>(
  args: FactoryArguments<ArraySchema<S>>,
): ArraySchema<S> {
  return {
    kind: "array",
    isFlatValue(value): value is Y.Array<Key> {
      return value instanceof Y.Array && value.toArray().every(isKey)
    },
    ...args,
  }
}

export function createObject<Props extends Record<string, Schema>>(
  args: FactoryArguments<ObjectSchema<Props>>,
): ObjectSchema<Props> {
  const propertyNames = Object.keys(args.properties)

  invariant(propertyNames.length !== 0, "Object schema must have at least one property")

  return {
    kind: "object",
    isFlatValue(value): value is Y.Map<Key> {
      return value instanceof Y.Map && [...value.values()].every(isKey)
    },
    ...args,
  }
}

type FactoryArguments<S extends Schema> = Omit<PublicSchemaShape<S>, "kind" | "isFlatValue"> & {
  customBehavior?: CustomBehavior<S>
}

export const hasCustomBehavior = (
  schema: Schema,
): schema is Schema & { customBehavior: CustomBehavior } => {
  return "customBehavior" in schema && schema.customBehavior !== undefined
}

export const isBoolean = createGuard<BooleanSchema>("boolean")
export const isRichText = createGuard<RichTextSchema>("richText")
export const isLiteral = createGuard<LiteralSchema>("literal")
export const isWrapper = createGuard<WrapperSchema>("wrapper")
export const isUnion = createGuard<UnionSchema>("union")
export const isArray = createGuard<ArraySchema>("array")
export const isObject = createGuard<ObjectSchema>("object")
export const isPrimitive = T.union(isBoolean, isLiteral)
export const isLeaf = T.union(isBoolean, isLiteral, isRichText)
export const isSingletonSchema = T.union(isWrapper, isUnion)

function createGuard<S extends Schema>(kind: S["kind"]): T.TypeGuard<S> {
  return (value: unknown): value is S => {
    return typeof value === "object" && value !== null && "kind" in value && value.kind === kind
  }
}
