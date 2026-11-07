import { expect, test } from "bun:test"

import { bindDocument, readOnlyDocument } from "./documents"
import { richText as definition } from "./rich-text"
import { object, record, richText, string } from "./schema"
import { FlatNodeStore } from "./storage"

const schema = object({
  title: string(),
  entries: record(string()),
  comment: richText({ definition: definition.block({ blocks: { paragraph: true } }) }),
})
const initial = {
  title: "First",
  entries: {},
  comment: { type: "doc", content: [{ type: "paragraph" }] },
}

test("read-only binding stays live without exposing source values or permitting writes", () => {
  const source = bindDocument(new FlatNodeStore(), schema, initial)
  const view = readOnlyDocument(source, schema)
  const first = view.document.root
  expect("transact" in view.store).toBe(false)
  let notifications = 0
  const unsubscribe = view.store.subscribe(() => notifications++)

  expect(() => first.field("title").set("Forbidden")).toThrow("Storage is read-only.")
  expect(() => first.field("entries").set("new", "Forbidden")).toThrow("Storage is read-only.")
  expect(() => first.field("comment").getEditor().setContent(initial.comment)).toThrow(
    "Storage is read-only.",
  )

  source.document.root.field("title").set("Second")
  source.document.root.field("entries").set("new", "Allowed")
  expect(notifications).toBe(2)
  expect(view.document.snapshot()).toMatchObject({ title: "Second", entries: { new: "Allowed" } })
  expect(first.field("title").get()).toBe("First")
  expect(first.field("entries").get("new")).toBeUndefined()

  unsubscribe()
  source.document.root.field("title").set("Third")
  expect(notifications).toBe(2)
  expect(view.document.root.field("title").get()).toBe("Third")
})
