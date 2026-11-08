import { expect, test } from "bun:test"

import { boolean, object, record, string } from "./schema"
import { FlatNodeStore } from "./storage"
import { openWorksheet, WorksheetMode } from "./worksheet"

test("opens worksheet with supplied answer and feedback schemas", () => {
  const options = {
    contentSchema: string(),
    answersSchema: record(string()),
    feedbackSchema: record(object({ correct: boolean() })),
    initialSnapshot: {
      content: "Question",
      answers: { task: "Original" },
      feedback: { task: { correct: false } },
    },
  }

  const answering = openWorksheet({
    ...options,
    mode: WorksheetMode.Answering,
    store: new FlatNodeStore(),
  })
  answering.answers.get("task")!.set("Updated")
  expect(answering.answers.snapshot()).toEqual({ task: "Updated" })
  expect(answering.feedback.get("task")!.field("correct").get()).toBe(false)
  expect(() => answering.feedback.get("task")!.field("correct").set(true)).toThrow()

  const grading = openWorksheet({
    ...options,
    mode: WorksheetMode.GivingFeedback,
    store: new FlatNodeStore(),
  })
  grading.feedback.get("task")!.field("correct").set(true)
  expect(grading.feedback.snapshot()).toEqual({ task: { correct: true } })
  expect(() => grading.answers.get("task")!.set("Changed")).toThrow()
})
