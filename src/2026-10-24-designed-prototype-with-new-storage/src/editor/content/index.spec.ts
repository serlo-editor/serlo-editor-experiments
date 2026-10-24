import { expect, test } from "bun:test"

import { Root, TextContent } from "."
import { initialContent } from "../../demo/initial-content"
import { createDocument } from "../schema/document"
import { richTextHandles } from "../session"
import { describeWithStores } from "../test-utils/test-with-stores"
import { exportContent, importContent } from "./io"

describeWithStores("prototype content", (getStore) => {
  test("round-trips external JSON and preserves identity across edits and reopening", () => {
    const store = getStore()
    const snapshot = importContent(initialContent)
    const document = createDocument(store, Root, snapshot)
    expect(exportContent(document.snapshot())).toEqual(initialContent)
    const before = document.root.children().map((unit) => unit.id)
    const richTextIds = richTextHandles(document.root).map((handle) => handle.id)
    const choice = document.root.children().find((unit) => unit.type === "multiple-choice")!
    choice.field("options").children()[0]!.field("isCorrect").set(true)
    const expected = structuredClone(initialContent)
    const expectedChoice = expected.find((item) => item.type === "multiple-choice")!
    expectedChoice.options[0]!.isCorrect = true
    expect(exportContent(document.snapshot())).toEqual(expected)
    document.root.insert(
      0,
      TextContent.createUnit({ content: { type: "doc", content: [{ type: "paragraph" }] } }),
    )
    document.root.remove(0)
    const reopened = createDocument(store, Root, [])
    expect(reopened.root.children().map((unit) => unit.id)).toEqual(before)
    expect(richTextHandles(reopened.root).map((handle) => handle.id)).toEqual(richTextIds)
    const exported = exportContent(reopened.snapshot())
    expect(JSON.stringify(exported)).not.toContain("rich-text:")
    expect(exported.every((item) => !("id" in item))).toBe(true)
    expect(importContent(exported).map((unit) => unit.id)).not.toEqual(before)
  })
})

test.each(
  [
    null,
    [{}],
    [{ type: "unknown" }],
    [{ type: "text", content: { type: "doc", content: [{ type: "unknown" }] } }],
    [{ type: "text", content: { type: "doc", content: [{ type: "inlineBlock" }] } }],
    [{ type: "text", content: { type: "doc", content: [{ type: "paragraph" }] }, extra: true }],
    [
      {
        type: "fill-in-the-blank",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "x", marks: [{ type: "unknown" }] }],
            },
          ],
        },
      },
    ],
    [
      {
        type: "multiple-choice",
        question: { type: "doc", content: [{ type: "inlineBlock" }] },
        options: [{ isCorrect: "yes", text: {} }],
      },
    ],
    [{ type: "text", content: { type: "doc", attrs: { invalid: () => {} } } }],
    [undefined],
    [...initialContent, { type: "unknown" }],
  ].map((invalid) => ({ invalid })),
)("rejects malformed content: $invalid", ({ invalid }) => {
  expect(() => importContent(invalid)).toThrow()
})
