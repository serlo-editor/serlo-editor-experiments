import type { TypeGuard } from "../utils/type-guards"

// Use a single SchemaKind parameter so each Schema<> instantiation keeps
// FlatValue and JSONValue paired.
export interface Schema<K extends SchemaKind = SchemaKind> {
  kind: K["kind"]
  name: string
  isFlatValue: TypeGuard<K["FlatValue"]>
  // Store the current FlatValue and JSONValue on each Schema instance.
  // Otherwise the derived FlatValue and JSONValue types can be inferred
  // incorrectly.
  //
  // We use a unique, non-exported symbol so the SchemaTypeInfo property is
  // not accessible outside this module.
  readonly [SchemaTypeInfo]?: {
    readonly FlatValue: K["FlatValue"]
    readonly JSONValue: K["JSONValue"]
  }
}

export type FlatValue<S extends Schema> = SchemaTypeInfoOf<S>["FlatValue"]
export type JSONValue<S extends Schema> = SchemaTypeInfoOf<S>["JSONValue"]

export type PublicSchemaShape<S extends Schema> = Omit<S, typeof SchemaTypeInfo>

type SchemaTypeInfoOf<S extends Schema> = NonNullable<S[typeof SchemaTypeInfo]>

interface SchemaKind {
  kind: string
  FlatValue: unknown
  JSONValue: unknown
}

declare const SchemaTypeInfo: unique symbol
