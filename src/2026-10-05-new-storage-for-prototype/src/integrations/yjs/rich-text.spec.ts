import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test"

import { Window } from "happy-dom"
import { type Editor, toggleMark } from "prosekit/core"
import { TextSelection } from "prosekit/pm/state"
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from "y-protocols/awareness"
import * as Y from "yjs"

import { defineRichTextExtension } from "../../rich-text/definition.ts"
import { richText, type RichTextDefinition } from "../../rich-text/index.ts"
import { createEditorAwareness, createYjsRichTextEditor } from "./editor.ts"
import { exportRichText, getRichTextFragment, initializeRichText } from "./rich-text.ts"

const window = new Window()
const globals = new Map<string, PropertyDescriptor | undefined>()
const cleanups: (() => void)[] = []

beforeAll(() => {
  for (const key of [
    "window",
    "document",
    "navigator",
    "Node",
    "HTMLElement",
    "MutationObserver",
    "getComputedStyle",
  ]) {
    globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: Reflect.get(window, key),
    })
  }
})

afterEach(() => {
  for (const cleanup of cleanups.reverse()) cleanup()
  cleanups.length = 0
  window.document.body.replaceChildren()
})

afterAll(async () => {
  await window.happyDOM.close()
  for (const [key, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
})

describe("rich-text definitions and JSON", () => {
  test("round-trips inline content and enabled marks without creating editors", () => {
    const definition = richText.inline({ marks: { bold: true, italic: true, gap: true } })
    const { fragment } = fixture()
    const content = {
      type: "doc",
      content: [
        {
          type: "inlineBlock",
          content: [
            {
              type: "text",
              text: "Question",
              marks: [{ type: "bold" }, { type: "italic" }, { type: "gap" }],
            },
          ],
        },
      ],
    }

    initializeRichText({ definition, fragment, content })
    // ProseMirror orders marks by schema rank, not their input JSON order.
    const schema = defineRichTextExtension(definition).schema
    if (!schema) throw new Error("Missing rich-text schema")
    expect(exportRichText({ definition, fragment })).toEqual(schema.nodeFromJSON(content).toJSON())
  })

  test("round-trips configured headings and nested flat lists", () => {
    const definition = richText.block({
      blocks: {
        paragraph: true,
        heading: { levels: [2, 3] },
        list: { bullet: true, ordered: true },
      },
    })
    const { fragment } = fixture()
    initializeRichText({
      definition,
      fragment,
      content: {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
          {
            type: "list",
            attrs: { kind: "bullet" },
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Item" }] },
              { type: "list", attrs: { kind: "ordered" }, content: [{ type: "paragraph" }] },
            ],
          },
        ],
      },
    })
    const result = exportRichText({ definition, fragment })
    expect(result.content?.[0]?.attrs?.level).toBe(2)
    expect(result.content?.[1]?.attrs?.kind).toBe("bullet")
    expect(result.content?.[1]?.content?.[1]?.attrs?.kind).toBe("ordered")
    // Exported defaults remain valid on a fresh import.
    const other = fixture()
    initializeRichText({ definition, fragment: other.fragment, content: result })
    expect(exportRichText({ definition, fragment: other.fragment })).toEqual(result)
  })

  test.each([
    { type: "paragraph" },
    { type: "doc", content: [{ type: "paragraph" }] },
    {
      type: "doc",
      content: [
        { type: "inlineBlock", content: [{ type: "text", text: "x", marks: [{ type: "bold" }] }] },
      ],
    },
    { type: "doc", content: [] },
    null,
  ])("rejects invalid inline import before writing: %j", (content) => {
    const definition = richText.inline()
    const { doc, fragment } = fixture()
    const before = Y.encodeStateVector(doc)
    expect(() => initializeRichText({ definition, fragment, content })).toThrow()
    expect(Y.encodeStateVector(doc)).toEqual(before)
    expect(fragment.length).toBe(0)
    initializeRichText({ definition, fragment, content: emptyContent("inlineBlock") })
  })

  test.each([
    { type: "heading", attrs: { level: 1 } },
    { type: "list", attrs: { kind: "ordered" }, content: [{ type: "paragraph" }] },
    { type: "list", attrs: { kind: "task" }, content: [{ type: "paragraph" }] },
    { type: "inlineBlock" },
  ])("rejects disabled block capabilities: %j", (child) => {
    const definition = richText.block({
      blocks: { paragraph: true, heading: { levels: [2] }, list: { bullet: true } },
    })
    const { fragment } = fixture()
    expect(() =>
      initializeRichText({ definition, fragment, content: { type: "doc", content: [child] } }),
    ).toThrow()
    expect(fragment.length).toBe(0)
  })

  test("rejects list configuration without enabled kinds", () => {
    expect(() => richText.block({ blocks: { paragraph: true, list: {} } })).toThrow("list kind")
  })

  test("remembers initialization after content is deleted and document is reopened", () => {
    const definition = richText.inline()
    const first = fixture()
    initializeRichText({
      definition,
      fragment: first.fragment,
      content: emptyContent("inlineBlock"),
    })
    first.fragment.delete(0, first.fragment.length)
    const second = fixture()
    Y.applyUpdate(second.doc, Y.encodeStateAsUpdate(first.doc))
    expect(() =>
      initializeRichText({
        definition,
        fragment: second.fragment,
        content: emptyContent("inlineBlock"),
      }),
    ).toThrow("already initialized")
    expect(second.fragment.length).toBe(0)
  })

  test("never overwrites existing fragment content without an initialization marker", () => {
    const { fragment } = fixture()
    fragment.insert(0, [new Y.XmlElement("inlineBlock")])
    expect(() =>
      initializeRichText({
        definition: richText.inline(),
        fragment,
        content: emptyContent("inlineBlock"),
      }),
    ).toThrow("already initialized")
    expect(fragment.length).toBe(1)
  })

  test("requires attached fragments and nonempty IDs", () => {
    const { doc } = fixture()
    expect(() => getRichTextFragment(doc, "")).toThrow()
    expect(() =>
      initializeRichText({
        definition: richText.inline(),
        fragment: new Y.XmlFragment(),
        content: emptyContent("inlineBlock"),
      }),
    ).toThrow("Attach")
  })
})

describe("collaborative editors", () => {
  test("creating and reopening editors does not write or reset fragment content", () => {
    const definition = richText.inline()
    const { doc, fragment, awareness } = fixture()
    initializeRichText({ definition, fragment, content: textContent("inlineBlock", "Existing") })
    const before = Y.encodeStateAsUpdate(doc)
    for (let i = 0; i < 2; i++) {
      const editor = createYjsRichTextEditor({ definition, id: "text", fragment, awareness })
      expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
      mount(editor)
      expect(exportRichText({ definition, fragment })).toEqual(
        textContent("inlineBlock", "Existing"),
      )
      editor.unmount()
    }
  })

  test("supports typing, bold, italic, and gap formatting", () => {
    const definition = richText.inline({ marks: { bold: true, italic: true, gap: true } })
    const { fragment, editor } = mountedFixture(definition)
    editor.view.dispatch(editor.state.tr.insertText("hello", 1))
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1, 6)))
    for (const type of ["bold", "italic", "gap"]) {
      expect(editor.exec(toggleMark({ type }))).toBe(true)
    }
    const text = exportRichText({ definition, fragment }).content?.[0]?.content?.[0]
    expect(text?.text).toBe("hello")
    expect(text?.marks?.map((mark) => mark.type).sort()).toEqual(["bold", "gap", "italic"])
  })

  test("rejects disabled heading levels and list kinds during editing", () => {
    const definition = richText.block({
      blocks: { paragraph: true, heading: { levels: [2] }, list: { bullet: true } },
    })
    const { editor } = mountedFixture(definition)
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(0, editor.schema.nodes.heading, { level: 1 }),
    )
    expect(editor.state.doc.firstChild?.type.name).toBe("paragraph")
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(0, editor.schema.nodes.heading, { level: 2 }),
    )
    expect(editor.state.doc.firstChild?.attrs.level).toBe(2)
    const list = editor.schema.nodes.list?.create(
      { kind: "task" },
      editor.schema.nodes.paragraph?.create(),
    )
    if (!list) throw new Error("Missing list node")
    editor.view.dispatch(editor.state.tr.replaceWith(0, editor.state.doc.content.size, list))
    expect(editor.state.doc.firstChild?.type.name).toBe("heading")
  })

  test("merges concurrent character edits across replicas using the same stable ID", () => {
    const definition = richText.inline()
    const first = fixture()
    initializeRichText({
      definition,
      fragment: first.fragment,
      content: textContent("inlineBlock", "Start"),
    })
    const second = fixture()
    Y.applyUpdate(second.doc, Y.encodeStateAsUpdate(first.doc))
    const a = createYjsRichTextEditor({ ...first, definition, id: "text" })
    const b = createYjsRichTextEditor({ ...second, definition, id: "text" })
    mount(a)
    mount(b)
    a.view.dispatch(a.state.tr.insertText("A", 1))
    b.view.dispatch(b.state.tr.insertText("B", 1))
    const aUpdate = Y.encodeStateAsUpdate(first.doc)
    const bUpdate = Y.encodeStateAsUpdate(second.doc)
    Y.applyUpdate(first.doc, bUpdate)
    Y.applyUpdate(second.doc, aUpdate)
    expect(a.state.doc.textContent).toBe(b.state.doc.textContent)
    expect(a.state.doc.textContent).toContain("A")
    expect(a.state.doc.textContent).toContain("B")
    expect(a.state.doc.textContent).toContain("Start")
    expect(exportRichText({ definition, fragment: first.fragment })).toEqual(
      exportRichText({ definition, fragment: second.fragment }),
    )
  })

  test("delivers view updates and releases mounted listeners on unmount", () => {
    const definition = richText.inline()
    const fixtureValue = fixture()
    initializeRichText({
      definition,
      fragment: fixtureValue.fragment,
      content: emptyContent("inlineBlock"),
    })
    let updates = 0
    const editor = createYjsRichTextEditor({
      ...fixtureValue,
      definition,
      id: "text",
      onViewUpdate: () => {
        updates++
      },
    })
    mount(editor)
    editor.view.dispatch(editor.state.tr.insertText("x", 1))
    expect(updates).toBeGreaterThan(0)
    editor.unmount()
    const before = updates
    fixtureValue.fragment.delete(0, fixtureValue.fragment.length)
    expect(updates).toBe(before)
    expect(editor.mounted).toBe(false)
  })

  test("requires matching fragment identity and awareness document", () => {
    const first = fixture()
    const second = fixture()
    expect(() =>
      createYjsRichTextEditor({ ...first, definition: richText.inline(), id: "wrong" }),
    ).toThrow("ID")
    expect(() =>
      createYjsRichTextEditor({
        ...first,
        definition: richText.inline(),
        id: "text",
        awareness: second.awareness,
      }),
    ).toThrow("same Y.Doc")
  })
})

test("awareness filters remote cursors by ID and preserves unrelated local state", () => {
  const first = fixture()
  const second = fixture()
  first.awareness.setLocalState({ user: { name: "Alice" } })
  second.awareness.setLocalState({ editorId: "other", cursor: { anchor: 1, head: 1 } })
  applyAwarenessUpdate(
    first.awareness,
    encodeAwarenessUpdate(second.awareness, [second.doc.clientID]),
    "test",
  )
  const text = createEditorAwareness("text", first.awareness)
  const other = createEditorAwareness("other", first.awareness)
  expect(text.getStates().size).toBe(0)
  expect(other.getStates().has(second.doc.clientID)).toBe(true)
  text.setLocalStateField("cursor", { anchor: 2, head: 2 })
  expect(text.getLocalState()?.user).toEqual({ name: "Alice" })
  expect(other.getLocalState()).toBeNull()
  other.setLocalStateField("cursor", null)
  expect(text.getLocalState()?.cursor).toEqual({ anchor: 2, head: 2 })
  other.setLocalStateField("cursor", { anchor: 3, head: 3 })
  expect(text.getLocalState()).toBeNull()
  expect(other.getLocalState()?.editorId).toBe("other")
  // Delegated event methods remain bound to the underlying awareness instance.
  let changes = 0
  const listener = () => {
    changes++
  }
  text.on("change", listener)
  text.setLocalStateField("cursor", null)
  expect(changes).toBe(0)
  other.setLocalStateField("cursor", null)
  expect(changes).toBe(1)
  text.off("change", listener)
})

function fixture() {
  const doc = new Y.Doc()
  const awareness = new Awareness(doc)
  cleanups.push(() => {
    awareness.destroy()
    doc.destroy()
  })
  return { doc, awareness, fragment: getRichTextFragment(doc, "text") }
}

function mountedFixture(definition: RichTextDefinition) {
  const value = fixture()
  initializeRichText({
    definition,
    fragment: value.fragment,
    content: emptyContent(definition.mode === "inline" ? "inlineBlock" : "paragraph"),
  })
  const editor = createYjsRichTextEditor({ ...value, definition, id: "text" })
  mount(editor)
  return { ...value, editor }
}

function mount(editor: Editor) {
  const element = window.document.createElement("div")
  window.document.body.append(element)
  // happy-dom's DOM interfaces intentionally differ from TypeScript's lib.dom.
  const host = document.getElementById((element.id = crypto.randomUUID()))
  if (!host) throw new Error("Missing editor host")
  editor.mount(host)
  cleanups.push(() => editor.unmount())
}

function emptyContent(type: string) {
  return { type: "doc", content: [{ type }] }
}

function textContent(type: string, text: string) {
  return { type: "doc", content: [{ type, content: [{ type: "text", text }] }] }
}
