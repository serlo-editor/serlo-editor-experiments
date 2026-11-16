import { expect, test } from "bun:test"

import { richText as definition, type RichTextJSON } from "@editor/rich-text"
import { describeWithStores } from "@editor/test-utils"
import { defineNodeSpec } from "prosekit/core"

import { array, object, richText } from "./index.ts"
import { openRoot } from "./root.ts"

const options = { definition: definition.inline({ marks: { bold: true } }) }

function content(text: string): RichTextJSON {
  return { type: "doc", content: [{ type: "inlineBlock", content: [{ type: "text", text }] }] }
}

describeWithStores("rich-text schemas", (getStore) => {
  test("builds valid empty documents for inline and block rich text", () => {
    const schema = object({
      inline: richText({ definition: definition.inline() }),
      block: richText({ definition: definition.block({ blocks: { paragraph: true } }) }),
    })
    const initial = schema.defaultValue()
    expect(initial).toEqual({
      inline: { type: "doc", content: [{ type: "inlineBlock" }] },
      block: { type: "doc", content: [{ type: "paragraph" }] },
    })
    expect(openRoot(getStore(), schema, initial).snapshot()).toEqual(initial)
  })

  test("exports independent ProseMirror JSON", () => {
    const initial = content("Hello")
    const document = openRoot(getStore(), richText(options), initial)

    expect(document.snapshot()).toEqual(initial)
    document.snapshot().content?.pop()
    expect(document.snapshot()).toEqual(initial)
    expect(initial).toEqual(content("Hello"))
  })

  test("opens existing content without replacing its identity or configuration", () => {
    const store = getStore()
    const schema = richText(options)
    const first = openRoot(store, schema, content("First"))
    const editor = first.getEditor()
    const second = openRoot(store, schema, content("Ignored"))

    expect(second.id).toBe(first.id)
    expect(second.getEditor()).toBe(editor)
    expect(second.snapshot()).toEqual(content("First"))
  })

  test("supports arrays and stable identities through sibling edits", () => {
    const store = getStore()
    const schema = object({ items: array(richText(options)) })
    const document = openRoot(store, schema, { items: [content("Kept")] })
    const items = document.items
    const original = items.children()[0]!

    items.insert(0, content("Inserted"))
    expect(items.children()[1]!.id).toBe(original.id)
    expect(items.children()[0]!.id).not.toBe(original.id)
    items.remove(0)
    expect(items.children()[0]!.getEditor()).toBe(original.getEditor())

    expect(document.snapshot()).toEqual({ items: [content("Kept")] })
  })

  test("assigns new IDs when importing copied content", () => {
    const store = getStore()
    const document = openRoot(store, array(richText(options)), [content("Same")])
    const first = document.children()[0]!
    document.insert(1, first.snapshot())
    const second = document.children()[1]!

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
    const document = openRoot(getStore(), schema, initial)
    expect(document.snapshot()).toEqual(initial)
  })

  test("rejects invalid imports without replacing existing content", () => {
    const document = openRoot(getStore(), array(richText(options)), [content("Kept")])
    const original = document.children()[0]!.id
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
      expect(() => document.insert(1, invalid)).toThrow()
    }
    expect(document.snapshot()).toEqual([content("Kept")])
    expect(document.children()[0]!.id).toBe(original)
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
      const ref = store.transact((write) => write.root.save(store.cell.create(value)))
      expect(() => schema.bind(store, ref)).toThrow("Expected rich-text cell.")
    }
  })
})
