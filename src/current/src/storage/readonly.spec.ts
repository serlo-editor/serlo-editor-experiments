import { expect, test } from "bun:test"

import { defineMarkSpec } from "prosekit/core"
import { EditorState, TextSelection } from "prosekit/pm/state"

import { richText as definition, type RichTextJSON } from "../rich-text/index.ts"
import { createDocument } from "../schema/document.ts"
import { array, object, optional, richText, string } from "../schema/index.ts"
import type { JSONValue } from "../utils/index.ts"
import { ReadonlyNodeStore } from "./index.ts"

const options = { definition: definition.inline({ marks: { gap: true } }) }
const content: RichTextJSON = {
  type: "doc",
  content: [{ type: "inlineBlock", content: [{ type: "text", text: "Initial" }] }],
}

test("read-only refs are nested frozen values, independent of caller-owned data", () => {
  const store = new ReadonlyNodeStore()
  const input = { nested: ["Initial"] }
  const root = store.root.getOrCreate(() => {
    const cell = store.cell.create(input)
    const items = store.array.create([cell, store.cell.create(false)])
    const map = store.map.create({ items })
    expect(store.map.get(map)).toBe(map)
    expect(Object.isFrozen(map)).toBe(true)
    expect(Object.isFrozen(items)).toBe(true)
    expect(Reflect.set(map, "added", true)).toBe(false)
    expect(Reflect.set(items, "0", "Changed")).toBe(false)
    return map
  })
  expect(store.cell.get(root)).toEqual({ items: [{ nested: ["Initial"] }, false] })

  // Reopening preserves the root and never invokes its initializer.
  expect(
    store.root.getOrCreate(() => {
      throw new Error("Must not initialize twice.")
    }),
  ).toBe(root)

  input.nested.push("Outside mutation")
  expect(store.cell.get(root)).toEqual({ items: [{ nested: ["Initial"] }, false] })
})

test.each<{ value: JSONValue }>([
  { value: null },
  { value: false },
  { value: 0 },
  { value: "" },
  { value: [] },
  { value: {} },
])("preserves an empty or falsy root: $value", ({ value }) => {
  const store = new ReadonlyNodeStore()
  const ref = store.root.getOrCreate(() => store.cell.create(value))
  expect(store.cell.get(ref)).toEqual(value)
  expect(store.root.getOrCreate(() => store.cell.create("Replacement"))).toBe(ref)
})

test("freezes nested cell JSON and copies array/map inputs", () => {
  const store = new ReadonlyNodeStore()
  store.root.getOrCreate(() => {
    const cell = store.cell.create({ nested: ["Initial"] })
    const items = [cell]
    const fields = { cell }
    const array = store.array.create(items)
    const map = store.map.create(fields)
    items.length = 0
    fields.cell = store.cell.create("Different")
    expect(store.array.get(array)).toBe(array)
    expect(store.cell.get(array)).toEqual([{ nested: ["Initial"] }])
    expect(store.cell.get(map)).toEqual({ cell: { nested: ["Initial"] } })
    expect(Object.isFrozen(cell)).toBe(true)
    const nested = Reflect.get(Object(cell), "nested")
    expect(Object.isFrozen(nested)).toBe(true)
    expect(Reflect.set(nested, "0", "Changed")).toBe(false)
    return map
  })
})

test("gets own map fields without losing falsy references", () => {
  const store = new ReadonlyNodeStore()
  const values = { null: null, false: false, zero: 0, empty: "" }
  const keys = ["", "世界 👋", "__proto__", "constructor", "toString", "hasOwnProperty"]
  store.root.getOrCreate(() => {
    const fields = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, store.cell.create(value)]),
    )
    const specialFields = Object.fromEntries(keys.map((key) => [key, store.cell.create(key)]))
    const map = store.map.create({})
    const root = store.map.create({ ...fields, ...specialFields, map })
    for (const [key, value] of Object.entries(values)) {
      expect<JSONValue | undefined>(store.map.getField(root, key)).toBe(value)
    }
    for (const key of keys) {
      expect<JSONValue | undefined>(store.map.getField(root, key)).toBe(key)
      expect(store.map.getField(map, key)).toBeUndefined()
    }
    expect(store.map.getField(root, "map")).toBe(map)
    expect(store.map.getField(root, "missing")).toBeUndefined()
    return root
  })
  expect(store.getRevision()).toBe(0)
})

test("rejects transactions without executing callbacks and creation outside initialization", () => {
  const store = new ReadonlyNodeStore()
  const forbidden = [
    () => store.cell.create("Added"),
    () => store.array.create([]),
    () => store.map.create({}),
    () => store.editor.create(options),
    () =>
      store.transact(() => {
        throw new Error("Callback must not run.")
      }),
  ]
  for (const operation of forbidden) expect(operation).toThrow("Storage is read-only.")
  store.root.getOrCreate(() => {
    expect(() => store.transact(() => {})).toThrow("Storage is read-only.")
    return store.cell.create("Initial")
  })
  for (const operation of forbidden) expect(operation).toThrow("Storage is read-only.")
})

test("closes failed initialization and permits retrying", () => {
  const store = new ReadonlyNodeStore()
  expect(() =>
    store.root.getOrCreate(() => {
      throw new Error("Failed")
    }),
  ).toThrow("Failed")
  expect(() => store.cell.create("Outside initialization")).toThrow("Storage is read-only.")
  const ref = store.root.getOrCreate(() => store.cell.create("Recovered"))
  expect(store.cell.get(ref)).toBe("Recovered")
})

test("schema stored values read snapshots but cannot mutate content", () => {
  const store = new ReadonlyNodeStore()
  const schema = object({ title: string(), items: array(string()), note: optional(string()) })
  const initial = { title: "Title", items: ["First"], note: "Note" }
  const document = createDocument(store, schema, initial)
  for (const operation of [
    () => document.root.field("title").set("Changed"),
    () => document.root.field("items").insert(0, "Added"),
    () => document.root.field("items").remove(0),
    () => document.root.setOptional("note", "Changed"),
    () => document.root.removeOptional("note"),
  ])
    expect(operation).toThrow("Storage is read-only.")
  const snapshot = document.snapshot()
  Reflect.set(snapshot.items, "0", "Outside mutation")
  expect(document.snapshot()).toEqual(initial)
  expect(createDocument(store, schema, { title: "Ignored", items: [] }).snapshot()).toEqual(initial)
})

test("immutable stores keep a constant revision and never notify", () => {
  const store = new ReadonlyNodeStore()
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications++
  })
  expect(store.getRevision()).toBe(0)
  const ref = store.root.getOrCreate(() => store.cell.create("Initial"))
  store.cell.get(ref)
  expect(() => store.transact(() => {})).toThrow("Storage is read-only.")
  unsubscribe()
  unsubscribe()
  expect(store.getRevision()).toBe(0)
  expect(notifications).toBe(0)
})

test("read-only rich text supports snapshots and selection, not headless content changes", () => {
  const store = new ReadonlyNodeStore()
  const document = createDocument(store, richText(options), content)
  const editor = document.root.getEditor()
  expect(editor).toBe(document.root.getEditor())
  expect(document.snapshot()).toEqual(content)
  expect(() => store.editor.get("rich-text:missing", options)).toThrow("Unknown rich-text ID")
  expect(() => editor.setContent(content)).toThrow("Storage is read-only.")
  expect(() =>
    editor.exec((state, dispatch) => {
      dispatch?.(state.tr.insertText("!", 1))
      return true
    }),
  ).toThrow("Storage is read-only.")
  const changed = EditorState.create({
    doc: editor.schema.nodeFromJSON({ type: "doc", content: [{ type: "inlineBlock" }] }),
    plugins: editor.state.plugins,
  })
  expect(() => editor.updateState(changed)).toThrow("Storage is read-only.")
  expect(() => editor.updateState(editor.state.reconfigure({ plugins: [] }))).toThrow(
    "Storage is read-only.",
  )
  editor.updateState(
    editor.state.apply(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2))),
  )
  expect(editor.state.selection.from).toBe(2)
  expect(document.snapshot()).toEqual(content)
})

test("rich-text JSON does not expose stored mark attributes", () => {
  const store = new ReadonlyNodeStore()
  const marked: RichTextJSON = {
    type: "doc",
    content: [
      {
        type: "inlineBlock",
        content: [
          { type: "text", text: "Marked", marks: [{ type: "tag", attrs: { id: "tag-id" } }] },
        ],
      },
    ],
  }
  const document = createDocument(
    store,
    richText({
      ...options,
      extensions: [defineMarkSpec({ name: "tag", attrs: { id: { default: "" } } })],
    }),
    marked,
  )
  const editor = document.root.getEditor()
  const before = document.snapshot()
  const attrs = editor.getDocJSON().content?.[0]?.content?.[0]?.marks?.[0]?.attrs
  if (!attrs) throw new Error("Missing mark attributes.")
  Reflect.set(attrs, "id", "Changed")
  expect(document.snapshot()).toEqual(before)
})
