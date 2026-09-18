import assert from "node:assert/strict"
import test from "node:test"

import { array, boolean, FlatStorageAdapter, object, Storage, string } from "./schema/index.ts"

test("stores and binds boolean and string values", () => {
  const schema = object({
    enabled: boolean(),
    title: string(),
  })
  const storage = new Storage(new FlatStorageAdapter())
  const reference = storage.save(schema, { enabled: true, title: "Draft" })
  const value = storage.bind(schema, reference)

  assert.equal(value.enabled.get(), true)
  assert.equal(value.title.get(), "Draft")

  value.enabled.set(false)
  value.title.set("Published")

  assert.deepEqual(storage.load(schema, reference), {
    enabled: false,
    title: "Published",
  })
})

test("stores and binds arrays", () => {
  const schema = array(string())
  const storage = new Storage(new FlatStorageAdapter())
  const reference = storage.save(schema, ["one", "two"])
  const value = storage.bind(schema, reference)

  assert.equal(value.length, 2)
  assert.equal(value.at(0).get(), "one")
  assert.deepEqual(
    value.map((item) => item.get()),
    ["one", "two"],
  )

  value.at(1).set("updated")

  assert.deepEqual(storage.load(schema, reference), ["one", "updated"])
})

test("stores nested object and array values", () => {
  const schema = object({
    profile: object({
      active: boolean(),
      name: string(),
    }),
    tags: array(string()),
  })
  const storage = new Storage(new FlatStorageAdapter())
  const reference = storage.save(schema, {
    profile: { active: true, name: "Ada" },
    tags: ["math", "programming"],
  })
  const value = storage.bind(schema, reference)

  value.profile.name.set("Grace")
  value.tags.at(0).set("computing")

  assert.deepEqual(storage.load(schema, reference), {
    profile: { active: true, name: "Grace" },
    tags: ["computing", "programming"],
  })
})
