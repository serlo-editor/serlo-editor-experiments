import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test"

import { Window } from "happy-dom"
import { defineHistory } from "prosekit/core"
import { undo } from "prosekit/pm/history"
import { TextSelection } from "prosekit/pm/state"
import type { DecorationSet } from "prosekit/pm/view"
import { yCursorPluginKey } from "y-prosemirror"
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness"
import * as Y from "yjs"

import {
  richText as definition,
  type RichTextEditor,
  type RichTextJSON,
} from "../rich-text/index.ts"
import { createDocument } from "../schema/document.ts"
import { array, richText } from "../schema/index.ts"
import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { FlatNodeStore, YjsNodeStore } from "./index.ts"

const options = { definition: definition.inline({ marks: { bold: true } }) }

function content(text: string): RichTextJSON {
  return {
    type: "doc",
    content: [{ type: "inlineBlock", content: [{ type: "text", text }] }],
  }
}

describe("stored rich-text editors", () => {
  const window = new Window()
  const globals = new Map<string, PropertyDescriptor | undefined>()
  const editors: RichTextEditor[] = []
  const docs: Y.Doc[] = []
  const awarenessInstances: Awareness[] = []

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
    for (const editor of editors.splice(0)) editor.unmount()
    for (const awareness of awarenessInstances.splice(0)) awareness.destroy()
    for (const doc of docs.splice(0)) doc.destroy()
    document.body.replaceChildren()
  })

  afterAll(async () => {
    await window.happyDOM.close()
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  })

  test("flat editors notify for headless content changes, not selection changes", async () => {
    const store = new FlatNodeStore()
    const document = createDocument(store, richText(options), content("Initial"))
    const editor = document.root.getEditor()
    const observed: RichTextJSON[] = []
    const unsubscribe = store.subscribe(() => observed.push(document.snapshot()))
    const revision = store.getRevision()

    await Promise.resolve()
    expect(observed).toEqual([])
    expect(store.getRevision()).toBe(revision)

    editor.setContent(content("Intermediate"))
    editor.setContent(content("Changed"))
    expect(observed).toEqual([])
    await Promise.resolve()
    expect(document.snapshot()).toEqual(content("Changed"))
    expect(observed).toEqual([content("Changed")])
    expect(store.getRevision()).toBe(revision + 1)

    editor.setContent(content("Temporary"))
    editor.setContent(content("Changed"))
    await Promise.resolve()
    expect(observed).toEqual([content("Changed")])
    expect(store.getRevision()).toBe(revision + 1)

    editor.exec((state, dispatch) => {
      dispatch?.(state.tr.insertText("!", 1))
      return true
    })
    await Promise.resolve()
    expect(observed).toEqual([content("Changed"), content("!Changed")])

    editor.updateState(
      editor.state.apply(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2))),
    )
    await Promise.resolve()
    expect(observed).toHaveLength(2)

    unsubscribe()
    editor.setContent(content("After unsubscribe"))
    await Promise.resolve()
    expect(observed).toHaveLength(2)
    expect(store.getRevision()).toBe(revision + 3)
  })

  describeWithStores("mounted edits", (getStore) => {
    test("updates snapshots, marks, and subscriptions", async () => {
      const store = getStore()
      let updates = 0
      const schema = richText({
        ...options,
        onViewUpdate: () => {
          updates++
        },
      })
      const document = createDocument(store, schema, content("Initial"))
      const editor = mount(document.root.getEditor())
      const observed: RichTextJSON[] = []
      const unsubscribe = store.subscribe(() => observed.push(document.snapshot()))
      const revision = store.getRevision()
      updates = 0

      editor.view.dispatch(editor.state.tr.insertText("!", 1))
      await Promise.resolve()
      expect(document.snapshot()).toEqual(content("!Initial"))
      expect(observed).toEqual([content("!Initial")])
      expect(store.getRevision()).toBeGreaterThan(revision)
      expect(updates).toBeGreaterThan(0)

      const afterTyping = store.getRevision()
      editor.view.dispatch(
        editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1, 2)),
      )
      await Promise.resolve()
      expect(store.getRevision()).toBe(afterTyping)
      expect(observed).toHaveLength(1)

      const mark = editor.schema.marks.bold!.create()
      editor.view.dispatch(editor.state.tr.addMark(1, 2, mark))
      await Promise.resolve()
      expect(document.snapshot().content?.[0]?.content?.[0]?.marks).toEqual([{ type: "bold" }])
      expect(observed).toHaveLength(2)
      unsubscribe()
    })
  })

  test("flat storage keeps caller-supplied local history", async () => {
    const store = new FlatNodeStore()
    const document = createDocument(
      store,
      richText({ ...options, extensions: [defineHistory()] }),
      content("Initial"),
    )
    const editor = mount(document.root.getEditor())
    editor.view.dispatch(editor.state.tr.insertText("!", 1))
    expect(editor.exec(undo)).toBe(true)
    await Promise.resolve()
    expect(document.snapshot()).toEqual(content("Initial"))
  })

  test("Yjs peers share IDs and fragments, not editor instances", () => {
    const firstDoc = createDoc()
    const secondDoc = createDoc()
    const firstStore = createYjsStore(firstDoc)
    const secondStore = createYjsStore(secondDoc)
    const schema = richText(options)
    const first = createDocument(firstStore, schema, content("Shared"))
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    const second = createDocument(secondStore, schema, content("Ignored"))

    expect(second.root.id).toBe(first.root.id)
    expect(secondStore.getRoot()).not.toBe(firstStore.getRoot())
    expect(second.root.getEditor()).not.toBe(first.root.getEditor())
    const beforeLookup = Y.encodeStateVector(secondDoc)
    expect(second.snapshot()).toEqual(first.snapshot())
    expect(second.root.getEditor()).toBe(second.root.getEditor())
    expect(Y.encodeStateVector(secondDoc)).toEqual(beforeLookup)

    const reopened = createDocument(createYjsStore(secondDoc), schema, content("Ignored again"))
    expect(reopened.root.id).toBe(first.root.id)
    expect(reopened.snapshot()).toEqual(content("Shared"))
  })

  test("Yjs snapshots refresh unmounted cached editors after remote changes", () => {
    const firstDoc = createDoc()
    const secondDoc = createDoc()
    const firstStore = createYjsStore(firstDoc)
    const secondStore = createYjsStore(secondDoc)
    const schema = richText(options)
    const first = createDocument(firstStore, schema, content("Initial"))
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    const second = createDocument(secondStore, schema, content("Ignored"))
    const cached = second.root.getEditor()
    mount(cached).unmount()
    const source = mount(first.root.getEditor())
    source.view.dispatch(source.state.tr.insertText("!", 1))
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))

    const beforeSnapshot = Y.encodeStateVector(secondDoc)
    expect(second.snapshot()).toEqual(content("!Initial"))
    expect(second.root.getEditor()).toBe(cached)
    expect(Y.encodeStateVector(secondDoc)).toEqual(beforeSnapshot)

    mount(cached)
    expect(cached.getDocJSON()).toEqual(content("!Initial"))
    cached.view.dispatch(cached.state.tr.insertText("?", 1))
    Y.applyUpdate(firstDoc, Y.encodeStateAsUpdate(secondDoc))
    expect(first.snapshot()).toEqual(content("?!Initial"))
  })

  test("Yjs remote fragment edits notify without writing replicated revisions", async () => {
    const firstDoc = createDoc()
    const secondDoc = createDoc()
    const firstStore = createYjsStore(firstDoc)
    const secondStore = createYjsStore(secondDoc)
    const schema = richText(options)
    const first = createDocument(firstStore, schema, content("Initial"))
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    const second = createDocument(secondStore, schema, content("Ignored"))
    const source = mount(first.root.getEditor())
    const revision = secondStore.getRevision()
    const structuralRevisions = secondDoc.getArray("storage:revisions").length
    const observed: RichTextJSON[] = []
    const unsubscribe = secondStore.subscribe(() => observed.push(second.snapshot()))

    source.view.dispatch(source.state.tr.insertText("!", 1))
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    expect(observed).toEqual([content("!Initial")])
    expect(secondStore.getRevision()).toBeGreaterThan(revision)
    expect(secondDoc.getArray("storage:revisions").length).toBe(structuralRevisions)

    const afterRemoteEdit = secondStore.getRevision()
    expect(second.snapshot()).toEqual(content("!Initial"))
    await Promise.resolve()
    expect(observed).toEqual([content("!Initial")])
    expect(secondStore.getRevision()).toBe(afterRemoteEdit)

    unsubscribe()
    const beforeUnsubscribedEdit = secondStore.getRevision()
    source.view.dispatch(source.state.tr.insertText("?", 1))
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    expect(observed).toHaveLength(1)
    expect(secondStore.getRevision()).toBeGreaterThan(beforeUnsubscribedEdit)
  })

  test("Yjs concurrent character edits converge", () => {
    const firstDoc = createDoc()
    const secondDoc = createDoc()
    const schema = richText(options)
    const first = createDocument(createYjsStore(firstDoc), schema, content("Seed"))
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    const second = createDocument(createYjsStore(secondDoc), schema, content("Ignored"))
    const firstEditor = mount(first.root.getEditor())
    const secondEditor = mount(second.root.getEditor())

    firstEditor.view.dispatch(firstEditor.state.tr.insertText("A", 1))
    secondEditor.view.dispatch(secondEditor.state.tr.insertText("B", 1))
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    Y.applyUpdate(firstDoc, Y.encodeStateAsUpdate(secondDoc))

    expect(first.snapshot()).toEqual(second.snapshot())
    expect(firstEditor.state.doc.textContent).toContain("A")
    expect(firstEditor.state.doc.textContent).toContain("B")
    expect(firstEditor.state.doc.textContent).toContain("Seed")
  })

  test("Yjs initialization and typing propagate through prototype's origin filter", () => {
    const firstDoc = createDoc()
    const secondDoc = createDoc()
    firstDoc.on("update", (update, origin) => {
      if (origin != null) Y.applyUpdate(secondDoc, update)
    })
    secondDoc.on("update", (update, origin) => {
      if (origin != null) Y.applyUpdate(firstDoc, update)
    })
    const schema = richText(options)
    const first = createDocument(createYjsStore(firstDoc), schema, content("Initial"))
    const second = createDocument(createYjsStore(secondDoc), schema, content("Ignored"))
    const editor = mount(first.root.getEditor())
    editor.view.dispatch(editor.state.tr.insertText("!", 1))
    expect(second.snapshot()).toEqual(content("!Initial"))
  })

  test("Yjs opening an empty fragment does not seed shared content", () => {
    const doc = createDoc()
    const store = createYjsStore(doc)
    const document = createDocument(store, richText(options), content("Initial"))
    const fragment = doc.getXmlFragment(`storage:richText:${document.root.id}`)
    fragment.delete(0, fragment.length)
    const beforeLookup = Y.encodeStateVector(doc)
    expect(document.snapshot()).toEqual({ type: "doc", content: [{ type: "inlineBlock" }] })
    expect(fragment.length).toBe(0)
    expect(Y.encodeStateVector(doc)).toEqual(beforeLookup)
  })

  test("Yjs awareness publishes stable IDs and isolates sibling cursor cleanup", async () => {
    const doc = createDoc()
    const awareness = new Awareness(doc)
    const store = new YjsNodeStore({ doc, awareness })
    awarenessInstances.push(awareness)
    awareness.setLocalStateField("user", { name: "Local" })
    const document = createDocument(store, array(richText(options)), [
      content("First"),
      content("Second"),
    ])
    const [first, second] = document.root.children()
    if (!first || !second) throw new Error("Missing children.")
    const firstEditor = mount(first.getEditor())
    const secondEditor = mount(second.getEditor())

    firstEditor.focus()
    firstEditor.view.dispatch(
      firstEditor.state.tr.setSelection(TextSelection.create(firstEditor.state.doc, 2)),
    )
    expect(awareness.getLocalState()?.editorId).toBe(first.id)
    expect(awareness.getLocalState()?.cursor).toBeTruthy()

    secondEditor.focus()
    secondEditor.view.dispatch(
      secondEditor.state.tr.setSelection(TextSelection.create(secondEditor.state.doc, 2)),
    )
    const secondCursor = awareness.getLocalState()?.cursor
    expect(awareness.getLocalState()?.editorId).toBe(second.id)
    expect(secondCursor).toBeTruthy()

    firstEditor.unmount()
    expect(awareness.getLocalState()?.editorId).toBe(second.id)
    expect(awareness.getLocalState()?.cursor).toEqual(secondCursor)
    expect(awareness.getLocalState()?.user).toEqual({ name: "Local" })
    secondEditor.unmount()
    expect(awareness.getLocalState()?.cursor).toBeNull()
    // Flush y-prosemirror's queued cursor metadata after both views are gone.
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  test("remote cursors appear only in the corresponding rich-text editor", async () => {
    const sourceDoc = createDoc()
    const targetDoc = createDoc()
    const sourceAwareness = new Awareness(sourceDoc)
    const targetAwareness = new Awareness(targetDoc)
    const sourceStore = new YjsNodeStore({
      doc: sourceDoc,
      awareness: sourceAwareness,
    })
    const targetStore = new YjsNodeStore({
      doc: targetDoc,
      awareness: targetAwareness,
    })
    awarenessInstances.push(sourceAwareness, targetAwareness)
    const schema = array(richText(options))
    const source = createDocument(sourceStore, schema, [content("First"), content("Second")])
    Y.applyUpdate(targetDoc, Y.encodeStateAsUpdate(sourceDoc))
    const target = createDocument(targetStore, schema, [])
    const sourceEditor = mount(source.root.children()[0]!.getEditor())
    const matchingEditor = mount(target.root.children()[0]!.getEditor())
    const siblingEditor = mount(target.root.children()[1]!.getEditor())

    sourceEditor.focus()
    sourceEditor.view.dispatch(
      sourceEditor.state.tr.setSelection(TextSelection.create(sourceEditor.state.doc, 1, 3)),
    )
    applyAwarenessUpdate(
      targetAwareness,
      encodeAwarenessUpdate(sourceAwareness, [sourceAwareness.clientID]),
      "remote",
    )
    await new Promise((resolve) => setTimeout(resolve, 0))

    const matching: DecorationSet | undefined = yCursorPluginKey.getState(matchingEditor.state)
    const sibling: DecorationSet | undefined = yCursorPluginKey.getState(siblingEditor.state)
    expect(matching?.find().length).toBeGreaterThan(0)
    expect(sibling?.find()).toEqual([])
  })

  function createYjsStore(doc: Y.Doc): YjsNodeStore {
    const awareness = new Awareness(doc)
    awarenessInstances.push(awareness)
    return new YjsNodeStore({ doc, awareness })
  }

  function createDoc(): Y.Doc {
    const doc = new Y.Doc()
    docs.push(doc)
    return doc
  }

  function mount(editor: RichTextEditor): RichTextEditor {
    const host = document.createElement("div")
    document.body.append(host)
    editors.push(editor)
    editor.mount(host)
    return editor
  }
})
