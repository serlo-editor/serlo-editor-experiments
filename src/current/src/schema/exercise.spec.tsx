import { expect, mock, test } from "bun:test"

import { renderToStaticMarkup } from "react-dom/server"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { WorksheetContext } from "../worksheet-context.ts"
import { openWorksheet, WorksheetMode } from "../worksheet.ts"
import { BlockView } from "./block-view.ts"
import { discriminatedUnion } from "./discriminated-union.ts"
import { exercise } from "./exercise.tsx"
import { string } from "./primitives.ts"
import { record } from "./record.ts"
import { taggedObject } from "./tagged-object.ts"
import type { SnapshotOf } from "./types.ts"

describeWithStores("exercise renderer", (getStore) => {
  const render = mock(
    (
      question: string,
      answer: string | undefined,
      feedback: string | undefined,
      mode: WorksheetMode,
      id: string,
    ) => <p>{`${question} / ${answer ?? ""} / ${feedback ?? ""} / ${mode} / ${id}`}</p>,
  )
  const schema = exercise({
    unit: { type: "question", fields: { question: string() } },
    answer: { fields: { response: string() } },
    feedback: { fields: { comment: string() } },
    render: ({ unit, answer, feedback, mode }) =>
      render(
        unit.field("question").get(),
        answer?.field("response").get(),
        feedback?.field("comment").get(),
        mode,
        unit.id,
      ),
  })
  const otherAnswer = taggedObject({ type: "other", fields: { response: string() } })
  const otherFeedback = taggedObject({ type: "other", fields: { comment: string() } })
  const answersSchema = record(discriminatedUnion([schema.answer, otherAnswer]))
  const feedbackSchema = record(discriminatedUnion([schema.feedback, otherFeedback]))

  function renderExercise({
    answers = {},
    feedback = {},
  }: {
    answers?: Record<string, SnapshotOf<typeof schema.answer> | SnapshotOf<typeof otherAnswer>>
    feedback?: Record<string, SnapshotOf<typeof schema.feedback> | SnapshotOf<typeof otherFeedback>>
  } = {}) {
    render.mockClear()
    const unit = { ...schema.unit.createSnapshot({ question: "What?" }), id: "task" }
    const worksheet = openWorksheet({
      mode: WorksheetMode.ViewingFeedback,
      store: getStore(),
      contentSchema: schema.unit,
      answersSchema,
      feedbackSchema,
      initialSnapshot: { content: unit, answers, feedback },
    })
    const markup = renderToStaticMarkup(
      <WorksheetContext.Provider value={worksheet}>
        <BlockView value={worksheet.content} />
      </WorksheetContext.Provider>,
    )
    return { markup, unit }
  }

  test("renders unit with matching answer, feedback, and worksheet mode", () => {
    const { markup, unit } = renderExercise({
      answers: { task: { type: "question", response: "42" } },
      feedback: { task: { type: "question", comment: "Correct" } },
    })
    expect(markup).toBe("<p>What? / 42 / Correct / viewing-feedback / task</p>")
    expect(render).toHaveBeenCalledTimes(1)
    expect(render.mock.calls[0]![4]).toBe(unit.id)
  })

  test("alerts for answer with wrong type", () => {
    const { markup } = renderExercise({ answers: { task: { type: "other", response: "42" } } })
    expect(markup).toBe('<p role="alert">Antwort passt nicht zur Aufgabe.</p>')
    expect(render).not.toHaveBeenCalled()
  })

  test("alerts for feedback with wrong type", () => {
    const { markup } = renderExercise({
      feedback: { task: { type: "other", comment: "Incorrect" } },
    })
    expect(markup).toBe('<p role="alert">Feedback passt nicht zur Aufgabe.</p>')
    expect(render).not.toHaveBeenCalled()
  })
})
