import { expectTypeOf, test } from "bun:test"

import type { FlatValue, JSONValue, Schema } from "./types"

type ExampleSchema = Schema<{
  kind: "example"
  FlatValue: number
  JSONValue: { text: string }
}>

test("FlatValue<> returns the schema's FlatValue type", () => {
  expectTypeOf<FlatValue<ExampleSchema>>().toEqualTypeOf<number>()
})

test("JSONValue<> returns the schema's JSONValue type", () => {
  expectTypeOf<JSONValue<ExampleSchema>>().toEqualTypeOf<{ text: string }>()
})
