import { expect, test } from "bun:test"

import { Window } from "happy-dom"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"

import { initialContent } from "../../demo/initial-content"
import { Root } from "../content"
import { bindDocument } from "../documents"
import { setExerciseFeedback } from "../responses"
import { FlatNodeStore } from "../storage"
import { createModeDocuments, createStudent, type Mode } from "../worksheet"
import { Editor } from "./Editor"

test("exercise renderers join response documents, retain input focus, and enforce mode controls", async () => {
  const window = new Window()
  const globals = new Map<string, PropertyDescriptor | undefined>()
  for (const key of ["window", "document", "navigator", "Node", "HTMLElement"]) {
    globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: Reflect.get(window, key),
    })
  }
  const host = document.createElement("div")
  document.body.append(host)
  const reactRoot = createRoot(host)
  try {
    const content = bindDocument(new FlatNodeStore(), Root, initialContent)
    const initial = content.document.snapshot()
    const student = createStudent("alice", "Alice")
    const render = (mode: Mode) => {
      const worksheet = createModeDocuments(mode, content, student)
      flushSync(() => reactRoot.render(<Editor key={mode} worksheet={worksheet} name="Alice" />))
    }
    render("answering")
    expect(host.querySelector(".ProseMirror")).toBeNull()
    expect(host.querySelectorAll(".exercise")).toHaveLength(2)
    // Rendering unanswered exercises must not allocate answer or feedback entries.
    expect(student.answers.document.snapshot()).toEqual({})
    expect(student.feedback.document.snapshot()).toEqual({ overall: "", exercises: {} })
    const gap = host.querySelector<HTMLInputElement>(".preview-gap")!
    gap.focus()
    flushSync(() => {
      gap.value = "Paris"
      const event = document.createEvent("Event")
      event.initEvent("input", true, false)
      gap.dispatchEvent(event)
    })
    expect(host.querySelector(".preview-gap")).toBe(gap)
    expect(document.activeElement).toBe(gap)
    expect(gap.value).toBe("Paris")
    const gapExercise = content.document.root
      .children()
      .find((value) => value.type === "fill-in-the-blank")!
    const answer = student.answers.document.root.get(gapExercise.id)
    if (answer?.type !== "gap-answer") throw new Error("Expected gap answer.")
    expect(answer.field("values").get("capital-france")?.get()).toBe("Paris")
    expect(content.document.snapshot()).toEqual(initial)

    render("feedback")
    expect(host.querySelector<HTMLInputElement>(".preview-gap")?.disabled).toBe(true)
    expect(host.querySelector<HTMLInputElement>(".preview-gap")?.value).toBe("Paris")
    expect(
      Array.from(host.querySelectorAll<HTMLInputElement>(".choice-card input")).every(
        (input) => input.disabled,
      ),
    ).toBe(true)
    expect(host.querySelectorAll("textarea")).toHaveLength(3)
    flushSync(() => {
      setExerciseFeedback(
        student.feedback.document.root,
        gapExercise.id,
        "gap-feedback",
        "comment",
        "Gut gemacht!",
      )
      student.feedback.document.root.field("overall").set("Weiter so.")
    })
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("Gut gemacht!")

    render("viewing")
    expect(host.querySelector("textarea")).toBeNull()
    expect(host.querySelector(".learner-content")?.textContent).toContain("Gut gemacht!")
    expect(host.querySelector(".learner-content")?.textContent).toContain("Weiter so.")
    expect(host.querySelector<HTMLInputElement>(".preview-gap")?.value).toBe("Paris")
    expect(host.querySelector<HTMLInputElement>(".preview-gap")?.disabled).toBe(true)
    render("answering")
    expect(host.querySelector<HTMLInputElement>(".preview-gap")?.disabled).toBe(false)
    expect(host.querySelector<HTMLInputElement>(".preview-gap")?.value).toBe("Paris")
    expect(content.document.snapshot()).toEqual(initial)
  } finally {
    flushSync(() => reactRoot.unmount())
    await window.happyDOM.close()
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
