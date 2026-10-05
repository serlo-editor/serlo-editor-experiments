import { describe, expect, expectTypeOf, test } from "bun:test"

import {
  arrayOf,
  type GuardedType,
  instanceOf,
  isBoolean,
  isNull,
  isString,
  literal,
  shape,
  type TypeGuard,
  union,
} from "./type-guards"

describe("type helpers", () => {
  interface Person {
    name: string
  }

  function isPerson(value: unknown): value is Person {
    return typeof value === "object" && value !== null && "name" in value
  }

  test("TypeGuard", () => {
    expectTypeOf(isPerson).toEqualTypeOf<TypeGuard<Person>>()
  })

  test("GuardedType", () => {
    const examplePerson: Person = { name: "Bob" }

    expectTypeOf(examplePerson).toEqualTypeOf<GuardedType<typeof isPerson>>()
  })
})

test("isNull", () => {
  expectTypeOf(isNull).toEqualTypeOf<TypeGuard<null>>()

  expect(isNull(null)).toBe(true)
  expect(isNull(undefined)).toBe(false)
  expect(isNull("")).toBe(false)
})

test("isString", () => {
  expectTypeOf(isString).toEqualTypeOf<TypeGuard<string>>()

  expect(isString("hello")).toBe(true)
  expect(isString(123)).toBe(false)
  expect(isString(null)).toBe(false)
})

test("isBoolean", () => {
  expectTypeOf(isBoolean).toEqualTypeOf<TypeGuard<boolean>>()

  expect(isBoolean(true)).toBe(true)
  expect(isBoolean(false)).toBe(true)
  expect(isBoolean(0)).toBe(false)
})

test("literal", () => {
  const fortyTwoGuard = literal(42)

  expectTypeOf(fortyTwoGuard).toEqualTypeOf<TypeGuard<42>>()
  // @ts-expect-error wrong literal value
  expectTypeOf(fortyTwoGuard).toEqualTypeOf<TypeGuard<41>>()

  expect(fortyTwoGuard(42)).toBe(true)
  expect(fortyTwoGuard(41)).toBe(false)
  expect(fortyTwoGuard("42")).toBe(false)
})

test("instanceOf", () => {
  class Example {
    constructor(public readonly value: string) {}
  }

  const exampleGuard = instanceOf(Example)

  expectTypeOf(exampleGuard).toEqualTypeOf<TypeGuard<Example>>()

  expect(exampleGuard(new Example("ok"))).toBe(true)
  expect(exampleGuard({ value: "ok" })).toBe(false)
  expect(exampleGuard(null)).toBe(false)
})

test("union", () => {
  const stringOrBoolean = union(isString, isBoolean)

  expectTypeOf(stringOrBoolean).toEqualTypeOf<TypeGuard<string | boolean>>()

  expect(stringOrBoolean("hello")).toBe(true)
  expect(stringOrBoolean(true)).toBe(true)
  expect(stringOrBoolean(123)).toBe(false)
  expect(stringOrBoolean(null)).toBe(false)
})

test("arrayOf", () => {
  const strings = arrayOf(isString)

  expectTypeOf(strings).toEqualTypeOf<TypeGuard<string[]>>()

  expect(strings(["a", "b"])).toBe(true)
  expect(strings([])).toBe(true)
  expect(strings(["a", 1])).toBe(false)
  expect(strings("a")).toBe(false)
})

test("shape", () => {
  const person = shape({
    name: isString,
    active: isBoolean,
  })

  expectTypeOf(person).toEqualTypeOf<
    TypeGuard<{ readonly name: string; readonly active: boolean }>
  >()

  expect(person({ name: "Ada", active: true })).toBe(true)
  expect(person({ name: "Ada", active: true, extra: "ok" })).toBe(true)
  expect(person({ name: "Ada", active: "yes" })).toBe(false)
  expect(person({ name: "Ada" })).toBe(false)
  expect(person(null)).toBe(false)
})
