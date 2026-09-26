import assert from "node:assert/strict"
import test from "node:test"

import { LocalContentStorage, YjsContentStorage } from "./content-storage.ts"
import type { Schema } from "./schema.ts"

const schema = {
  kind: "object",
  fields: {
    published: { kind: "boolean" },
    title: { kind: "string" },
    sections: {
      kind: "array",
      item: {
        kind: "object",
        fields: {
          heading: { kind: "string" },
          body: { kind: "string" },
          visible: { kind: "boolean" },
        },
      },
    },
  },
} as const satisfies Schema

const document = {
  published: false,
  title: "Draft",
  sections: [
    { heading: "Introduction", body: "Start here", visible: true },
    { heading: "Conclusion", body: "Finish here", visible: false },
  ],
}

const storageImplementations = [
  ["local", () => new LocalContentStorage()],
  ["yjs", () => new YjsContentStorage()],
] as const

for (const [name, createStorage] of storageImplementations) {
  test(`${name} storage saves and reads nested content`, (context) => {
    const storage = createStorage()
    context.after(() => storage.dispose())
    const value = storage.save(schema, document)

    assert.equal(value.type, "object")
    assert.deepEqual(value.get(), document)
    assert.equal(value.field("title").get(), "Draft")
    assert.deepEqual(
      value
        .field("sections")
        .map((section) => `${section.field("heading").get()}: ${section.field("body").get()}`),
      ["Introduction: Start here", "Conclusion: Finish here"],
    )
  })

  test(`${name} storage updates nested content`, (context) => {
    const storage = createStorage()
    context.after(() => storage.dispose())
    const value = storage.save(schema, document)

    value.field("published").set(true)
    value.field("title").set("Published")
    value.field("sections").map((section, index) => {
      if (index === 0) section.field("body").set("Updated introduction")
      return section
    })

    assert.deepEqual(value.get(), {
      ...document,
      published: true,
      title: "Published",
      sections: [{ ...document.sections[0], body: "Updated introduction" }, document.sections[1]],
    })
  })
}
