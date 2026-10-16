import { expect, test } from "bun:test"

import { defineNodeSpec, type NodeJSON } from "prosekit/core"

import { richText, createRichTextEditor } from "./index.ts"

test("creates a local inline editor with default content and no collaboration adapter", () => {
  const content: NodeJSON = {
    type: "doc",
    content: [{ type: "inlineBlock", content: [{ type: "text", text: "Local" }] }],
  }
  const editor = createRichTextEditor({ definition: richText.inline(), defaultContent: content })

  expect(editor.getDocJSON()).toEqual(content)
  editor.unmount()
})

test("appends custom ProseKit extensions to rich-text schema", () => {
  const editor = createRichTextEditor({
    definition: richText.block({ blocks: { paragraph: true } }),
    extensions: [defineNodeSpec({ name: "customBlock", content: "inline*", group: "block" })],
  })

  expect(editor.schema.nodes.customBlock).toBeDefined()
  editor.unmount()
})

test("rejects invalid local default content before editor creation", () => {
  expect(() =>
    createRichTextEditor({
      definition: richText.inline(),
      defaultContent: { type: "doc", content: [{ type: "paragraph" }] },
    }),
  ).toThrow()
})
