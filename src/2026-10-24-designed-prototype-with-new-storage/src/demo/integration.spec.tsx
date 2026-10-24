import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from "bun:test"

import { Window } from "happy-dom"
import { TextSelection } from "prosekit/pm/state"
import type { DecorationSet } from "prosekit/pm/view"
import { act, StrictMode } from "react"
import { createRoot, type Root as ReactRoot } from "react-dom/client"
import { yCursorPluginKey } from "y-prosemirror"
import * as Y from "yjs"

import { createSession, Editor, importContent } from "../editor"
import type { RichTextEditor } from "../editor/rich-text"
import { richTextHandles } from "../editor/session"
import App from "./App"
import { initialContent } from "./initial-content"
import { Preview } from "./Preview"
import * as sessionModule from "./sessions"
import { syncCDRTs } from "./sync-cdrts"

describe("designed prototype integration", () => {
  const window = new Window()
  const globals = new Map<string, PropertyDescriptor | undefined>()
  const roots: ReactRoot[] = []
  const sessions: { destroy(): void }[] = []

  beforeAll(() => {
    for (const key of [
      "window",
      "document",
      "navigator",
      "Node",
      "HTMLElement",
      "MutationObserver",
      "getComputedStyle",
      "Event",
      "MouseEvent",
      "FocusEvent",
      "KeyboardEvent",
    ]) {
      globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
      Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value: Reflect.get(window, key),
      })
    }
    globals.set(
      "IS_REACT_ACT_ENVIRONMENT",
      Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT"),
    )
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    })
  })

  afterEach(async () => {
    await act(async () => {
      for (const root of roots.splice(0)) root.unmount()
    })
    for (const session of sessions.splice(0)) session.destroy()
    await settle()
    document.body.replaceChildren()
  })

  afterAll(async () => {
    await window.happyDOM.close()
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  })

  test("peer edits update authoring, preview, formatting, and scoped cursors without shared focus state", async () => {
    const pair = sessionModule.createDemoSessions(initialContent)
    sessions.push(pair)
    const host = createHost()
    const root = mountReact(host)
    await act(async () =>
      root.render(
        <>
          <Editor session={pair.first} />
          <Editor session={pair.second} />
          <Preview session={pair.first} />
        </>,
      ),
    )
    const firstEditors = richTextHandles(pair.first.document.root).map((handle) =>
      handle.getEditor(),
    )
    const secondEditors = richTextHandles(pair.second.document.root).map((handle) =>
      handle.getEditor(),
    )
    const source = firstEditors[0]!
    const matching = secondEditors[0]!
    const sibling = secondEditors[2]!
    const firstForm = host.querySelector("form[aria-label='Editor 1']")!
    const secondForm = host.querySelector("form[aria-label='Editor 2']")!
    const preview = host.querySelector(".learner-content")!
    const bold = button(firstForm, "Toggle Bold")
    const peerBold = button(secondForm, "Toggle Bold")
    expect(bold.disabled).toBe(true)
    expect(peerBold.disabled).toBe(true)
    const beforeFocus = Y.encodeStateVector(pair.first.doc)
    await act(async () => {
      source.focus()
      source.view.dispatch(
        source.state.tr.setSelection(TextSelection.create(source.state.doc, 1, 5)),
      )
      await settle()
    })
    expect(bold.disabled).toBe(false)
    expect(peerBold.disabled).toBe(true)
    expect(Y.encodeStateVector(pair.first.doc)).toEqual(beforeFocus)
    expect(pair.first.awareness.getLocalState()?.editorId).toBe(
      richTextHandles(pair.first.document.root)[0]!.id,
    )
    const matchingCursors: DecorationSet | undefined = yCursorPluginKey.getState(matching.state)
    const siblingCursors: DecorationSet | undefined = yCursorPluginKey.getState(sibling.state)
    expect(matchingCursors?.find().length).toBeGreaterThan(0)
    expect(siblingCursors?.find()).toEqual([])

    await act(async () => bold.click())
    expect(bold.getAttribute("aria-pressed")).toBe("true")
    expect(matching.getDocJSON()).toEqual(source.getDocJSON())
    expect(preview.querySelector("strong")).not.toBeNull()
    await act(async () => button(firstForm, "Italic").click())
    expect(preview.querySelector("em")).not.toBeNull()

    // A collapsed selection outside the marked range must refresh the toolbar locally.
    const beforeSelection = Y.encodeStateVector(pair.first.doc)
    await act(async () =>
      source.view.dispatch(
        source.state.tr.setSelection(TextSelection.create(source.state.doc, 10)),
      ),
    )
    expect(bold.getAttribute("aria-pressed")).toBe("false")
    expect(Y.encodeStateVector(pair.first.doc)).toEqual(beforeSelection)

    await act(async () => matching.view.dispatch(matching.state.tr.insertText("Peer ", 1)))
    expect(preview.textContent).toContain("Peer ")
    expect(pair.first.exportContent()).toEqual(pair.second.exportContent())
    const checkbox = firstForm.querySelector<HTMLInputElement>(".correctness input")!
    await act(async () => checkbox.click())
    expect(secondForm.querySelector<HTMLInputElement>(".correctness input")!.checked).toBe(true)
    expect(checkbox.closest("label")?.textContent).toBe("Richtig")

    const gap = firstEditors[1]!
    await act(async () => {
      gap.focus()
      gap.view.dispatch(gap.state.tr.setSelection(TextSelection.create(gap.state.doc, 1, 4)))
    })
    expect(firstForm.querySelector("button[aria-label='Gap']")).not.toBeNull()
    await act(async () => button(firstForm, "Gap").click())
    expect(preview.querySelectorAll(".preview-gap")).toHaveLength(2)
    expect(firstEditors.every((editor) => editor.mounted)).toBe(true)
    expect(pair.first.doc.share.has("metadata")).toBe(false)
    expect(pair.first.doc.share.has("schemaNames")).toBe(false)

    const viewBeforeInsert = source.view
    await act(async () =>
      pair.second.document.root.insert(0, importContent([initialContent[0]])[0]!),
    )
    expect(pair.first.document.root.length).toBe(4)
    expect(source.view).toBe(viewBeforeInsert)
    const inserted = richTextHandles(pair.first.document.root)[0]!.getEditor()
    expect(inserted.mounted).toBe(true)
    await act(async () => pair.second.document.root.remove(0))
    expect(pair.first.document.root.length).toBe(3)
    expect(inserted.mounted).toBe(false)
    expect(source.view).toBe(viewBeforeInsert)
    expect(pair.first.exportContent()).toEqual(pair.second.exportContent())
  })

  test("learner answers stay local, survive unrelated updates, and reset through App", async () => {
    const { factory, created } = captureSessions()
    try {
      const host = createHost()
      const root = mountReact(host)
      await act(async () => root.render(<App />))
      const pair = created[0]!
      const gap = host.querySelector<HTMLInputElement>(".preview-gap")!
      const learnerChoice = host.querySelector<HTMLInputElement>(".choice-card input")!
      const before = pair.first.exportContent()
      const vector = Y.encodeStateVector(pair.first.doc)
      gap.value = "Berlin"
      gap.dispatchEvent(new Event("input", { bubbles: true }))
      await act(async () => learnerChoice.click())
      expect(pair.first.exportContent()).toEqual(before)
      expect(Y.encodeStateVector(pair.first.doc)).toEqual(vector)
      await act(async () => {
        const choice = pair.second.document.root
          .children()
          .find((unit) => unit.type === "multiple-choice")!
        choice.field("options").children()[0]!.field("isCorrect").set(true)
      })
      expect(host.querySelector<HTMLInputElement>(".preview-gap")!.value).toBe("Berlin")
      expect(host.querySelector<HTMLInputElement>(".choice-card input")!.checked).toBe(true)
      await act(async () => button(host, "Vorschau zurücksetzen").click())
      expect(host.querySelector<HTMLInputElement>(".preview-gap")!.value).toBe("")
      expect(host.querySelector<HTMLInputElement>(".choice-card input")!.checked).toBe(false)
      const editor = richTextHandles(pair.second.document.root)[0]!.getEditor()
      await act(async () => textButton(host, "Zusammenarbeit").click())
      expect(host.querySelector<HTMLElement>("#right-pane-collaboration")!.hidden).toBe(false)
      await act(async () => textButton(host, "Vorschau").click())
      expect(editor.mounted).toBe(true)
      expect(host.querySelector<HTMLElement>("#right-pane-collaboration")!.hidden).toBe(true)
    } finally {
      factory.mockRestore()
    }
  })

  test("StrictMode seeds one root per live session and tears down documents and editor views", async () => {
    const { factory, created } = captureSessions()
    try {
      const host = createHost()
      const root = mountReact(host)
      await act(async () =>
        root.render(
          <StrictMode>
            <App />
          </StrictMode>,
        ),
      )
      expect(factory).toHaveBeenCalledTimes(2)
      const discarded = created[0]!
      const live = created[1]!
      expect(discarded.first.doc.isDestroyed).toBe(true)
      expect(discarded.second.doc.isDestroyed).toBe(true)
      expect(live.first.document.root.length).toBe(3)
      expect(live.first.document.snapshot()).toEqual(live.second.document.snapshot())
      expect(live.first.doc.getMap("root").size).toBe(1)
      const editors = [
        ...richTextHandles(live.first.document.root),
        ...richTextHandles(live.second.document.root),
      ].map((handle) => handle.getEditor())
      await act(async () => root.unmount())
      roots.splice(roots.indexOf(root), 1)
      expect(live.first.doc.isDestroyed).toBe(true)
      expect(live.second.doc.isDestroyed).toBe(true)
      expect(editors.every((editor) => !editor.mounted)).toBe(true)
      expect(live.first.awareness.getLocalState()).toBeNull()
      live.destroy()
    } finally {
      factory.mockRestore()
    }
  })

  test("transport forwards null-origin writes without echo and disconnects content and awareness listeners", () => {
    const first = createSession({ name: "First", color: "blue" }, importContent(initialContent))
    const second = createSession(
      { name: "Second", color: "red" },
      [],
      Y.encodeStateAsUpdate(first.doc),
    )
    sessions.push(first, second)
    const disconnect = syncCDRTs(first, second)
    expect(first.awareness.getStates().has(second.doc.clientID)).toBe(true)
    let firstUpdates = 0
    let secondUpdates = 0
    first.doc.on("update", () => firstUpdates++)
    second.doc.on("update", () => secondUpdates++)
    const choice = first.document.root.children().find((unit) => unit.type === "multiple-choice")!
    const correctness = choice.field("options").children()[0]!.field("isCorrect")
    first.doc.transact(() => correctness.set(true))
    expect(firstUpdates).toBe(1)
    expect(secondUpdates).toBe(1)
    expect(second.exportContent()).toEqual(first.exportContent())
    disconnect()
    correctness.set(false)
    first.awareness.setLocalStateField("probe", "disconnected")
    expect(secondUpdates).toBe(1)
    expect(second.exportContent()).not.toEqual(first.exportContent())
    expect(second.awareness.getStates().get(first.doc.clientID)?.probe).toBeUndefined()
  })

  test("offline concurrent rich-text edits converge through the actual demo transport", () => {
    const first = createSession({ name: "First", color: "blue" }, importContent(initialContent))
    const second = createSession(
      { name: "Second", color: "red" },
      [],
      Y.encodeStateAsUpdate(first.doc),
    )
    sessions.push(first, second)
    const source = mountEditor(richTextHandles(first.document.root)[0]!.getEditor())
    const target = mountEditor(richTextHandles(second.document.root)[0]!.getEditor())
    source.view.dispatch(source.state.tr.insertText("A", 1))
    target.view.dispatch(target.state.tr.insertText("B", 1))
    const disconnect = syncCDRTs(first, second)
    expect(first.exportContent()).toEqual(second.exportContent())
    expect(source.state.doc.textContent).toContain("A")
    expect(source.state.doc.textContent).toContain("B")
    disconnect()
  })

  function mountReact(host: HTMLElement) {
    const root = createRoot(host)
    roots.push(root)
    return root
  }

  function mountEditor(editor: RichTextEditor) {
    editor.mount(createHost())
    return editor
  }

  function createHost() {
    const host = document.createElement("div")
    document.body.append(host)
    return host
  }
})

function captureSessions() {
  const original = sessionModule.createDemoSessions
  const created: ReturnType<typeof original>[] = []
  const factory = spyOn(sessionModule, "createDemoSessions").mockImplementation((content) => {
    const pair = original(content)
    created.push(pair)
    return pair
  })
  return { factory, created }
}

function button(host: ParentNode, label: string): HTMLButtonElement {
  const result = host.querySelector<HTMLButtonElement>(`button[aria-label='${label}']`)
  if (!result) throw new Error(`Missing button: ${label}`)
  return result
}

function textButton(host: ParentNode, text: string): HTMLButtonElement {
  const result = [...host.querySelectorAll("button")].find((button) => button.textContent === text)
  if (!result) throw new Error(`Missing button: ${text}`)
  return result
}

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
