import { expect, test } from "bun:test"

import { boolean, object, record, string } from "./schema"
import { FlatNodeStore } from "./storage"
import { describeWithStores } from "./test-utils/test-with-stores"
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
  expect(answering.feedback.get("task")!.correct.get()).toBe(false)
  expect(() => answering.feedback.get("task")!.correct.set(true)).toThrow()

  const grading = openWorksheet({
    ...options,
    mode: WorksheetMode.GivingFeedback,
    store: new FlatNodeStore(),
  })
  grading.feedback.get("task")!.correct.set(true)
  expect(grading.feedback.snapshot()).toEqual({ task: { correct: true } })
  expect(() => grading.answers.get("task")!.set("Changed")).toThrow()
})

describeWithStores("worksheet root", (getStore) =>
  test("opens composite root with one writable document", () => {
    const worksheet = openWorksheet({
      mode: WorksheetMode.Answering,
      store: getStore(),
      contentSchema: string(),
      answersSchema: record(string()),
      feedbackSchema: record(string()),
      initialSnapshot: { content: "Question", answers: {}, feedback: {} },
    })
    worksheet.answers.set("task", "42")
    expect(worksheet.answers.snapshot()).toEqual({ task: "42" })
    expect(worksheet.content.snapshot()).toBe("Question")
    expect(() => worksheet.feedback.set("task", "No")).toThrow("read-only")
  }),
)

test("new store opens snapshots with only selected document writable", () => {
  const schemas = {
    contentSchema: object({ title: string() }),
    answersSchema: record(string()),
    feedbackSchema: record(string()),
  }
  const first = openWorksheet({
    ...schemas,
    mode: WorksheetMode.EditingContent,
    store: new FlatNodeStore(),
    initialSnapshot: { content: { title: "Before" }, answers: {}, feedback: {} },
  })
  first.content.title.set("After")
  const second = openWorksheet({
    ...schemas,
    mode: WorksheetMode.Answering,
    store: new FlatNodeStore(),
    initialSnapshot: {
      content: first.content.snapshot(),
      answers: first.answers.snapshot(),
      feedback: first.feedback.snapshot(),
    },
  })
  second.answers.set("task", "Answer")
  expect(second.content.title.get()).toBe("After")
  expect(() => second.content.title.set("Invalid")).toThrow("read-only")
  expect(first.answers.snapshot()).toEqual({})
  expect(second.answers.snapshot()).toEqual({ task: "Answer" })
})
