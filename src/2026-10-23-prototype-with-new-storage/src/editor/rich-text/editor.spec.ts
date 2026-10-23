import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test"

import { Window } from "happy-dom"
import {
  defineCommands,
  defineHistory,
  defineNodeSpec,
  defineUpdateHandler,
  type Editor,
  type NodeJSON,
} from "prosekit/core"
import { undo } from "prosekit/pm/history"

import { createRichTextEditor, richText } from "./index.ts"

test.each([
  { name: "inline", definition: richText.inline(), child: "inlineBlock" },
  {
    name: "block",
    definition: richText.block({ blocks: { paragraph: true } }),
    child: "paragraph",
  },
])("creates an empty local $name editor without optional arguments", ({ definition, child }) => {
  const editor = createRichTextEditor({ definition })

  expect(editor.mounted).toBe(false)
  expect(editor.getDocJSON()).toEqual({ type: "doc", content: [{ type: child }] })
  expect(Object.keys(editor.schema.marks)).toEqual([])
})

test.each([
  { name: "inline", definition: richText.inline(), child: "inlineBlock" },
  {
    name: "block",
    definition: richText.block({ blocks: { paragraph: true } }),
    child: "paragraph",
  },
])("loads default content in a local $name editor", ({ definition, child }) => {
  const content = textContent(child, "Local")
  const editor = createRichTextEditor({ definition, defaultContent: content })

  expect(editor.getDocJSON()).toEqual(content)
})

test.each([
  { marks: { bold: true }, enabled: ["bold"] },
  { marks: { italic: true }, enabled: ["italic"] },
  { marks: { gap: true }, enabled: ["gap"] },
  { marks: { bold: true, italic: true, gap: true }, enabled: ["bold", "gap", "italic"] },
  { marks: { bold: false, italic: false, gap: false }, enabled: [] },
])("includes configured marks: $enabled", ({ marks, enabled }) => {
  const editor = createRichTextEditor({ definition: richText.inline({ marks }) })

  expect(Object.keys(editor.schema.marks).sort()).toEqual([...enabled])
})

test.each([
  {
    name: "no optional blocks",
    definition: richText.block({ blocks: { paragraph: true } }),
    heading: false,
    listKind: undefined,
  },
  {
    name: "disabled blocks",
    definition: richText.block({
      blocks: { paragraph: true, heading: false, orderedList: false, bulletList: false },
    }),
    heading: false,
    listKind: undefined,
  },
  {
    name: "headings",
    definition: richText.block({ blocks: { paragraph: true, heading: true } }),
    heading: true,
    listKind: undefined,
  },
  {
    name: "ordered lists",
    definition: richText.block({ blocks: { paragraph: true, orderedList: true } }),
    heading: false,
    listKind: "ordered",
  },
  {
    name: "bullet lists",
    definition: richText.block({ blocks: { paragraph: true, bulletList: true } }),
    heading: false,
    listKind: "bullet",
  },
  {
    name: "all blocks",
    definition: richText.block({
      blocks: { paragraph: true, heading: true, orderedList: true, bulletList: true },
    }),
    heading: true,
    listKind: "bullet",
  },
])("configures schema and default list kind for $name", ({ definition, heading, listKind }) => {
  const editor = createRichTextEditor({ definition })

  expect(editor.schema.nodes.paragraph).toBeDefined()
  expect(Boolean(editor.schema.nodes.heading)).toBe(heading)
  // ProseKit uses one list node with a kind attribute, not separate list nodes.
  expect(Boolean(editor.schema.nodes.list)).toBe(listKind !== undefined)
  expect(editor.schema.nodes.list?.createAndFill()?.attrs.kind).toBe(listKind)
})

test("loads marked default content", () => {
  const content: NodeJSON = {
    type: "doc",
    content: [
      { type: "inlineBlock", content: [{ type: "text", text: "Bold", marks: [{ type: "bold" }] }] },
    ],
  }
  const editor = createRichTextEditor({
    definition: richText.inline({ marks: { bold: true } }),
    defaultContent: content,
  })

  expect(editor.getDocJSON()).toEqual(content)
})

test("loads custom-node default content using the combined extension schema", () => {
  const content = textContent("customBlock", "Custom")
  const extensions = Object.freeze([
    defineNodeSpec({ name: "customBlock", content: "inline*", group: "block" }),
  ])
  const editor = createRichTextEditor({
    definition: richText.block({ blocks: { paragraph: true } }),
    defaultContent: content,
    extensions,
  })

  expect(editor.schema.nodes.paragraph).toBeDefined()
  expect(editor.schema.nodes.customBlock).toBeDefined()
  expect(editor.getDocJSON()).toEqual(content)
  expect(extensions).toHaveLength(1)
})

test.each<NodeJSON>([
  { type: "doc", content: [{ type: "paragraph" }] },
  { type: "doc", content: [{ type: "unknown" }] },
  {
    type: "doc",
    content: [
      { type: "inlineBlock", content: [{ type: "text", text: "x", marks: [{ type: "bold" }] }] },
    ],
  },
])("rejects unknown nodes or marks in default content: %j", (defaultContent) => {
  expect(() => createRichTextEditor({ definition: richText.inline(), defaultContent })).toThrow()
})

test("keeps instances and caller-owned content independent", () => {
  const definition = richText.inline()
  const content = textContent("inlineBlock", "Initial")
  const before = structuredClone(content)
  const first = createRichTextEditor({ definition, defaultContent: content })
  const second = createRichTextEditor({ definition, defaultContent: content })

  first.setContent(textContent("inlineBlock", "Changed"))

  expect(first.getDocJSON()).toEqual(textContent("inlineBlock", "Changed"))
  expect(second.getDocJSON()).toEqual(before)
  expect(content).toEqual(before)
})

describe("mounted editors", () => {
  const window = new Window()
  const globals = new Map<string, PropertyDescriptor | undefined>()
  const editors: Editor[] = []

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
    for (const editor of editors) editor.unmount()
    editors.length = 0
    document.body.replaceChildren()
  })

  afterAll(async () => {
    await window.happyDOM.close()
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  })

  test("runs custom commands and local history without an update callback", () => {
    let commands = 0
    const editor = createRichTextEditor({
      definition: richText.inline(),
      extensions: [
        defineHistory(),
        defineCommands({
          custom: () => () => {
            commands++
            return true
          },
        }),
      ],
    })
    mount(editor)

    const command: unknown = Reflect.get(editor.commands, "custom")
    if (typeof command !== "function") throw new Error("Missing custom command")
    expect(command()).toBe(true)
    expect(commands).toBe(1)
    editor.view.dispatch(editor.state.tr.insertText("Typed", 1))
    expect(editor.state.doc.textContent).toBe("Typed")
    expect(editor.exec(undo)).toBe(true)
    expect(editor.state.doc.textContent).toBe("")
  })

  test("composes onViewUpdate with extension handlers and stops callbacks after unmount", () => {
    const updates: string[] = []
    const extensionUpdates: string[] = []
    const editor = createRichTextEditor({
      definition: richText.inline(),
      extensions: [
        defineUpdateHandler((view) => {
          extensionUpdates.push(view.state.doc.textContent)
        }),
      ],
      onViewUpdate(view) {
        updates.push(view.state.doc.textContent)
      },
    })
    mount(editor)
    updates.length = 0
    extensionUpdates.length = 0

    editor.view.dispatch(editor.state.tr.insertText("Typed", 1))

    expect(updates).toEqual(["Typed"])
    expect(extensionUpdates).toEqual(["Typed"])
    editor.unmount()
    editor.setContent(textContent("inlineBlock", "Unmounted"))
    expect(updates).toEqual(["Typed"])
    expect(extensionUpdates).toEqual(["Typed"])
    expect(editor.mounted).toBe(false)
  })

  function mount(editor: Editor) {
    const host = document.createElement("div")
    document.body.append(host)
    editors.push(editor)
    editor.mount(host)
  }
})

function textContent(type: string, text: string): NodeJSON {
  return { type: "doc", content: [{ type, content: [{ type: "text", text }] }] }
}
