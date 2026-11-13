import { expect, test } from "bun:test"

import { boolean, object, record, string } from "@editor/schema"
import { FlatNodeStore } from "@editor/storage"

import { openWorksheet, WorksheetMode } from "./worksheet.ts"

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
    createStore: () => new FlatNodeStore(),
  })
  answering.answers.get("task")!.set("Updated")
  expect(answering.answers.snapshot()).toEqual({ task: "Updated" })
  expect(answering.feedback.get("task")!.correct.get()).toBe(false)
  expect(() => answering.feedback.get("task")!.correct.set(true)).toThrow()

  const grading = openWorksheet({
    ...options,
    mode: WorksheetMode.GivingFeedback,
    createStore: () => new FlatNodeStore(),
  })
  grading.feedback.get("task")!.correct.set(true)
  expect(grading.feedback.snapshot()).toEqual({ task: { correct: true } })
  expect(() => grading.answers.get("task")!.set("Changed")).toThrow()
})
