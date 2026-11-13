import { expect, test } from "bun:test"

import { boolean, object, record, string } from "@editor/schema"
import { FlatNodeStore } from "@editor/storage"

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
})
