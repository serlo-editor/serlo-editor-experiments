import { describe, expect, expectTypeOf, test } from "bun:test"

import { CollaborativeKeyGenerator, type Key } from "./key"

describe("Key type", () => {
  test("is a branded type of string (a string cannot be used as a key)", () => {
    // @ts-expect-error
    expectTypeOf("a string").toEqualTypeOf<Key>()
  })

  test("can be used as a string", () => {
    const firstLetter = (str: string) => str.substring(0, 1)
    const key = "key" as Key

    expect(firstLetter(key)).toBe("k")
  })
})

describe("CollaborativeKeyGenerator", () => {
  test("includes the client id in every key", () => {
    const generator = new CollaborativeKeyGenerator("client-a")

    expect(String(generator.next())).toBe("client-a:1")
    expect(String(generator.next())).toBe("client-a:2")
  })

  test("keeps keys distinct across clients", () => {
    const generatorA = new CollaborativeKeyGenerator("client-a")
    const generatorB = new CollaborativeKeyGenerator("client-b")

    expect(generatorA.next()).not.toBe(generatorB.next())
  })
})
