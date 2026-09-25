import assert from "node:assert/strict"
import test from "node:test"

import { FlatJSONStorage, YjsJSONStorage } from "./json-storage.ts"

const document = {
  published: false,
  title: "Draft",
  sections: [
    { heading: "Introduction", body: "Start here", visible: true },
    { heading: "Conclusion", body: "Finish here", visible: false },
  ],
}

const storageImplementations = [
  ["flat", () => new FlatJSONStorage()],
  ["yjs", () => new YjsJSONStorage()],
] as const

for (const [name, createStorage] of storageImplementations) {
  test(`${name} storage saves and reads nested JSON values`, () => {
    const storage = createStorage()
    const value = storage.save(document)

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

  test(`${name} storage updates nested JSON values`, () => {
    const storage = createStorage()
    const value = storage.save(document)

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
