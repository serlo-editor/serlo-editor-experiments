import { expect, test } from "bun:test"

import { boolean, object, record, string } from "@editor/schema"
import { FlatNodeStore, YjsNodeStore } from "@editor/store"
import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { openWorksheet, WorksheetMode } from "./worksheet.ts"

test("opens worksheet with supplied answer and feedback schemas", () => {
  const options = {
    contentSchema: string(),
    answersSchema: record(string()),
    feedbacksSchema: record(object({ correct: boolean() })),
    initialSnapshot: {
      content: "Question",
      answers: { task: "Original" },
      feedbacks: { task: { correct: false } },
    },
  }

  const answering = openWorksheet({
    ...options,
    mode: WorksheetMode.Answering,
    createStore: () => new FlatNodeStore(),
  })
  answering.answers.getOrCreate("task", () => "").set("Updated")
  expect(answering.answers.snapshot()).toEqual({ task: "Updated" })
  expect(answering.feedbacks.getOrCreate("task", () => ({ correct: false })).correct.get()).toBe(
    false,
  )
  expect(() =>
    answering.feedbacks.getOrCreate("task", () => ({ correct: false })).correct.set(true),
  ).toThrow()

  const grading = openWorksheet({
    ...options,
    mode: WorksheetMode.GivingFeedback,
    createStore: () => new FlatNodeStore(),
  })
  grading.feedbacks.getOrCreate("task", () => ({ correct: false })).correct.set(true)
  expect(grading.feedbacks.snapshot()).toEqual({ task: { correct: true } })
  expect(() => grading.answers.getOrCreate("task", () => "").set("Changed")).toThrow()
  answering.dispose()
  grading.dispose()
})

test("worksheet factory composes stable editor identity and document kind for shared Y.Doc", () => {
  const doc = new Y.Doc()
  const awareness = new Awareness(doc)
  const kinds: string[] = []
  const options = {
    contentSchema: string(),
    answersSchema: record(string()),
    feedbacksSchema: record(string()),
    initialSnapshot: { content: "Initial", answers: { task: "A" }, feedbacks: {} },
    createStore: (kind: "content" | "answers" | "feedbacks") => {
      kinds.push(kind)
      return new YjsNodeStore({ doc, awareness, storeName: JSON.stringify(["worksheet-1", kind]) })
    },
  }
  try {
    const content = openWorksheet({ ...options, mode: WorksheetMode.EditingContent })
    const answers = openWorksheet({ ...options, mode: WorksheetMode.Answering })
    const feedbacks = openWorksheet({ ...options, mode: WorksheetMode.GivingFeedback })
    expect(kinds).toEqual(["content", "answers", "feedbacks"])
    expect(content.content.snapshot()).toBe("Initial")
    expect(answers.answers.snapshot()).toEqual({ task: "A" })
    expect(feedbacks.feedbacks.snapshot()).toEqual({})

    answers.answers.getOrCreate("task", () => "").set("Edited")
    expect(content.getRevision()).toBe(1)
    expect(feedbacks.getRevision()).toBe(1)

    const reopened = openWorksheet({ ...options, mode: WorksheetMode.Answering })
    expect(reopened.answers.snapshot()).toEqual({ task: "Edited" })
    expect(kinds).toEqual(["content", "answers", "feedbacks", "answers"])
    reopened.dispose()
    content.dispose()
    answers.dispose()
    feedbacks.dispose()
  } finally {
    awareness.destroy()
    doc.destroy()
  }
})
