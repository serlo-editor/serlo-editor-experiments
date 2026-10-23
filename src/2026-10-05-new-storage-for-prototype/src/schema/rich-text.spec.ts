import { expect, test } from "bun:test"

import { defineNodeSpec } from "prosekit/core"

import { richText as definition, type RichTextJSON } from "../rich-text/index.ts"
import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { createDocument } from "./document.ts"
import { array, object, optional, richText } from "./index.ts"

const options = { definition: definition.inline({ marks: { bold: true } }) }

function content(text: string): RichTextJSON {
  return {
    type: "doc",
    content: [{ type: "inlineBlock", content: [{ type: "text", text }] }],
  }
}

describeWithStores("rich-text schemas", (getStore) => {
  test("accepts editor options with or without defaultContent", () => {
    const store = getStore()
    const emptyId = store.createRichText(options)
    expect(store.getEditor(emptyId, options).getDocJSON()).toEqual({
      type: "doc",
      content: [{ type: "inlineBlock" }],
    })

    const defaultContent = content("Initial")
    const id = store.createRichText({ ...options, defaultContent })
    defaultContent.content?.pop()
    expect(store.getEditor(id, options).getDocJSON()).toEqual(content("Initial"))
  })

  test("stores a tagged cell and exports only ProseMirror JSON", () => {
    const store = getStore()
    const schema = richText(options)
    const initial = content("Hello")
    const document = createDocument(store, schema, initial)
    const ref = store.getRoot()
    if (!ref) throw new Error("Missing root.")

    expect(store.cell.get(ref)).toEqual({ kind: "richText", editorId: document.root.id })
    expect(document.root.getEditor().getDocJSON()).toEqual(initial)
    expect(document.snapshot()).toEqual(initial)
    expect(document.root.getEditor()).toBe(document.root.getEditor())
    expect(document.root.getEditor()).toBe(store.getEditor(document.root.id, options))

    const exported = document.snapshot()
    exported.content?.pop()
    expect(document.snapshot()).toEqual(initial)
    expect(initial).toEqual(content("Hello"))
  })

  test("opens existing content without replacing its identity or configuration", () => {
    const store = getStore()
    const schema = richText(options)
    const first = createDocument(store, schema, content("First"))
    const editor = first.root.getEditor()
    const second = createDocument(store, schema, content("Ignored"))

    expect(second.root.id).toBe(first.root.id)
    expect(second.root.getEditor()).toBe(editor)
    expect(second.snapshot()).toEqual(content("First"))
    expect(store.getEditor(first.root.id, { definition: definition.inline() })).toBe(editor)
    expect(editor.schema.marks.bold).toBeDefined()
  })

  test("supports arrays, optional fields, and stable identities through sibling edits", () => {
    const store = getStore()
    const schema = object({
      items: array(richText(options)),
      note: optional(richText(options)),
    })
    const document = createDocument(store, schema, { items: [content("Kept")] })
    const items = document.root.field("items")
    const original = items.children()[0]!

    items.insert(0, content("Inserted"))
    expect(items.children()[1]!.id).toBe(original.id)
    expect(items.children()[0]!.id).not.toBe(original.id)
    items.remove(0)
    expect(items.children()[0]!.getEditor()).toBe(original.getEditor())

    document.root.setOptional("note", content("Note"))
    expect(document.root.field("note")?.snapshot()).toEqual(content("Note"))
    expect(document.snapshot()).toEqual({ items: [content("Kept")], note: content("Note") })
    document.root.removeOptional("note")
    expect(document.snapshot()).toEqual({ items: [content("Kept")] })
  })

  test("assigns new IDs when importing copied content", () => {
    const store = getStore()
    const document = createDocument(store, array(richText(options)), [content("Same")])
    const first = document.root.children()[0]!
    document.root.insert(1, first.snapshot())
    const second = document.root.children()[1]!

    expect(second.id).not.toBe(first.id)
    expect(second.getEditor()).not.toBe(first.getEditor())
    expect(second.snapshot()).toEqual(first.snapshot())
  })

  test("imports custom nodes using caller extensions", () => {
    const schema = richText({
      definition: definition.block({ blocks: { paragraph: true } }),
      extensions: [defineNodeSpec({ name: "customBlock", content: "inline*", group: "block" })],
    })
    const initial: RichTextJSON = {
      type: "doc",
      content: [{ type: "customBlock", content: [{ type: "text", text: "Custom" }] }],
    }
    const document = createDocument(getStore(), schema, initial)
    expect(document.snapshot()).toEqual(initial)
  })

  test("rejects invalid imports without replacing existing content", () => {
    const document = createDocument(getStore(), array(richText(options)), [content("Kept")])
    const original = document.root.children()[0]!.id
    for (const invalid of [
      { type: "doc", content: [{ type: "unknown" }] },
      { type: "doc", content: [{ type: "paragraph" }] },
      { type: "doc", content: [{ type: "inlineBlock" }, { type: "inlineBlock" }] },
      {
        type: "doc",
        content: [
          {
            type: "inlineBlock",
            content: [{ type: "text", text: "x", marks: [{ type: "italic" }] }],
          },
        ],
      },
    ]) {
      expect(() => document.root.insert(1, invalid)).toThrow()
    }
    expect(document.snapshot()).toEqual([content("Kept")])
    expect(document.root.children()[0]!.id).toBe(original)
  })

  test("rejects cells without valid rich-text metadata", () => {
    const store = getStore()
    const schema = richText(options)
    for (const value of [
      null,
      "id",
      [],
      {},
      { kind: "richText", editorId: "" },
      { kind: "cell", editorId: "rich-text:123" },
    ]) {
      const ref = store.transact((tx) => store.save(store.cell.create(value), tx))
      expect(() => schema.bind(store, ref)).toThrow("Expected rich-text cell.")
    }
    expect(() => store.getEditor("rich-text:missing", options)).toThrow("Unknown rich-text ID")
  })
})
