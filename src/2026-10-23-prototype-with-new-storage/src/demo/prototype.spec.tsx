import { afterAll, beforeAll, describe, expect, test } from "bun:test"

import { Window } from "happy-dom"
import { TextSelection } from "prosekit/pm/state"
import type { DecorationSet } from "prosekit/pm/view"
import { StrictMode } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import { yCursorPluginKey } from "y-prosemirror"
import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { createDocument } from "../editor/schema/document.ts"
import { YjsNodeStore } from "../editor/storage/index.ts"
import { describeWithStores } from "../editor/test-utils/test-with-stores.ts"
import App, { SessionPane } from "./App.tsx"
import { exportContent, Prototype, TextUnit } from "./content.tsx"
import { initialContent } from "./initial-content.ts"
import { createPrototypeSessions } from "./session.ts"
import { syncCDRTs } from "./sync-cdrts.ts"

describeWithStores("prototype units", (getStore) => {
  test("preserves typed unit identity, fields, export, and reopening", () => {
    const store = getStore()
    const document = createDocument(store, Prototype, initialContent)
    expect(document.root.type).toBe("prototype")
    expect(document.snapshot().items.map((item) => item.type)).toEqual([
      "text",
      "fill-in-the-blank",
      "multiple-choice",
    ])
    expect(exportContent(document.snapshot())).toEqual(
      initialContent.items.map(({ id: _id, ...content }) => content),
    )
    const items = document.root.field("items")
    const original = items.children()[0]
    if (!original || original.type !== "text") throw new Error("Expected text unit.")
    const editorId = original.field("content").id
    items.insert(
      0,
      TextUnit.createUnit({ content: { type: "doc", content: [{ type: "paragraph" }] } }),
    )
    expect(items.children()[1]?.id).toBe(original.id)
    items.remove(0)
    const reopened = createDocument(store, Prototype, Prototype.createUnit({ items: [] }))
    expect(reopened.root.id).toBe(initialContent.id)
    const text = reopened.root.field("items").children()[0]
    if (!text || text.type !== "text") throw new Error("Expected text unit.")
    expect(text.field("content").id).toBe(editorId)
    expect(reopened.snapshot()).toEqual(document.snapshot())
  })
})

describe("prototype integration", () => {
  const window = new Window()
  const globals = new Map<string, PropertyDescriptor | undefined>()

  beforeAll(() => {
    for (const key of [
      "window",
      "document",
      "navigator",
      "Node",
      "Element",
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

  afterAll(async () => {
    await window.happyDOM.close()
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  })

  test("React reflects peer edits; local toolbars, selection, cursors, and exports stay current", async () => {
    const sessions = createPrototypeSessions()
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    const firstItems = sessions.first.document.root.field("items").children()
    const secondItems = sessions.second.document.root.field("items").children()
    const text = firstItems[0]
    const peerText = secondItems[0]
    const gap = firstItems[1]
    const choice = firstItems[2]
    if (
      !text ||
      text.type !== "text" ||
      !peerText ||
      peerText.type !== "text" ||
      !gap ||
      gap.type !== "fill-in-the-blank" ||
      !choice ||
      choice.type !== "multiple-choice"
    )
      throw new Error("Missing initial units.")
    const editor = text.field("content").getEditor()
    const peerEditor = peerText.field("content").getEditor()
    const gapEditor = gap.field("content").getEditor()
    try {
      flushSync(() =>
        root.render(
          <>
            <SessionPane session={sessions.first} />
            <SessionPane session={sessions.second} />
          </>,
        ),
      )
      await tick()
      const panes = host.querySelectorAll(".app__session")
      const firstPane = panes[0]
      const secondPane = panes[1]
      if (!firstPane || !secondPane) throw new Error("Missing panes.")
      expect(firstPane.querySelectorAll('[role="textbox"]')).toHaveLength(6)
      expect(firstPane.querySelectorAll('[aria-label="Gap"]')).toHaveLength(1)
      const peerInput = secondPane.querySelector<HTMLInputElement>(
        '[aria-label="Option 1 is correct"]',
      )
      const firstInput = firstPane.querySelector<HTMLInputElement>(
        '[aria-label="Option 1 is correct"]',
      )
      if (!peerInput || !firstInput) throw new Error("Missing checkboxes.")
      flushSync(() => firstInput.click())
      expect(choice.field("options").children()[0]?.field("isCorrect").get()).toBe(true)
      expect(peerInput.checked).toBe(true)

      const revision = sessions.first.store.getRevision()
      flushSync(() => {
        editor.focus()
        editor.view.dispatch(
          editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1, 5)),
        )
      })
      expect(sessions.first.store.getRevision()).toBe(revision)
      expect(firstPane.querySelector('[aria-label="Current selection"]')?.textContent).toContain(
        text.field("content").id,
      )
      const bold = firstPane.querySelector<HTMLButtonElement>(
        '[aria-label="Text content formatting"] [aria-label="Bold"]',
      )
      if (!bold) throw new Error("Missing toolbar.")
      flushSync(() => bold.click())
      expect(bold.getAttribute("aria-pressed")).toBe("true")
      expect(peerEditor.getDocJSON().content?.[0]?.content?.[0]?.marks).toEqual([{ type: "bold" }])
      flushSync(() => editor.view.dispatch(editor.state.tr.insertText("Shared!", 1, 5)))
      await tick()
      expect(peerEditor.state.doc.textContent).toContain("Shared!")
      expect(secondPane.querySelector('[aria-label="Document JSON"]')?.textContent).toContain(
        "Shared!",
      )
      expect(exportContent(sessions.second.document.snapshot())[0]).toEqual(
        exportContent(sessions.first.document.snapshot())[0],
      )
      const matching: DecorationSet | undefined = yCursorPluginKey.getState(peerEditor.state)
      const sibling: DecorationSet | undefined = yCursorPluginKey.getState(
        gap.field("content").getEditor().state,
      )
      expect(matching?.find().length).toBeGreaterThan(0)
      expect(sibling?.find()).toEqual([])
      expect(sessions.second.document.snapshot()).toEqual(sessions.first.document.snapshot())

      // Removing a sibling must not remount the surviving text editor.
      flushSync(() => sessions.first.document.root.field("items").remove(1))
      expect(text.field("content").getEditor()).toBe(editor)
      expect(firstPane.querySelectorAll('[role="textbox"]')).toHaveLength(5)
      expect(secondPane.querySelectorAll('[role="textbox"]')).toHaveLength(5)
      expect(gapEditor.mounted).toBe(false)
    } finally {
      flushSync(() => root.unmount())
      expect(editor.mounted).toBe(false)
      expect(peerEditor.mounted).toBe(false)
      sessions.destroy()
      host.remove()
      await tick()
    }
  })

  test("App initializes once per session and tears down under StrictMode", async () => {
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    try {
      flushSync(() =>
        root.render(
          <StrictMode>
            <App />
          </StrictMode>,
        ),
      )
      await tick()
      expect(host.querySelectorAll('[role="textbox"]')).toHaveLength(12)
      expect(host.querySelectorAll(".app__session")).toHaveLength(2)
    } finally {
      flushSync(() => root.unmount())
      await tick()
      expect(host.childElementCount).toBe(0)
      host.remove()
    }
  })

  test("offline rich-text edits converge and null-origin updates cross transport without echo", () => {
    const firstDoc = new Y.Doc()
    const secondDoc = new Y.Doc()
    const first = { doc: firstDoc, awareness: new Awareness(firstDoc) }
    const second = { doc: secondDoc, awareness: new Awareness(secondDoc) }
    const source = createDocument(new YjsNodeStore(first), Prototype, initialContent)
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    const target = createDocument(new YjsNodeStore(second), Prototype, initialContent)
    const sourceText = source.root.field("items").children()[0]
    const targetText = target.root.field("items").children()[0]
    if (!sourceText || sourceText.type !== "text" || !targetText || targetText.type !== "text")
      throw new Error("Missing text.")
    const firstEditor = sourceText.field("content").getEditor()
    const secondEditor = targetText.field("content").getEditor()
    const firstHost = document.createElement("div")
    const secondHost = document.createElement("div")
    document.body.append(firstHost, secondHost)
    let disconnect = () => {}
    try {
      firstEditor.mount(firstHost)
      secondEditor.mount(secondHost)
      firstEditor.view.dispatch(firstEditor.state.tr.insertText("Alice ", 1))
      secondEditor.view.dispatch(secondEditor.state.tr.insertText("Bob ", 1))
      disconnect = syncCDRTs(first, second)
      expect(source.snapshot()).toEqual(target.snapshot())
      expect(firstEditor.state.doc.textContent).toContain("Alice ")
      expect(firstEditor.state.doc.textContent).toContain("Bob ")
      let sourceUpdates = 0
      firstDoc.on("update", () => sourceUpdates++)
      firstDoc.getMap("transport-check").set("null-origin", true)
      expect(secondDoc.getMap("transport-check").get("null-origin")).toBe(true)
      expect(sourceUpdates).toBe(1)
      disconnect()
      firstDoc.getMap("transport-check").set("after-disconnect", true)
      expect(secondDoc.getMap("transport-check").has("after-disconnect")).toBe(false)
    } finally {
      firstEditor.unmount()
      secondEditor.unmount()
      disconnect()
      first.awareness.destroy()
      second.awareness.destroy()
      firstDoc.destroy()
      secondDoc.destroy()
      firstHost.remove()
      secondHost.remove()
    }
  })
})

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
