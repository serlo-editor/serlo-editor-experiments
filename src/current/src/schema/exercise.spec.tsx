import { expect, test } from "bun:test"

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
  const schema = exercise({
    unit: { type: "question", fields: { question: string() } },
    answer: { fields: { response: string() } },
    feedback: { fields: { comment: string() } },
    render: ({ unit, answer, feedback, mode }) => (
      <p>{`${unit.question.get()} / ${answer?.response.get() ?? ""} / ${feedback?.comment.get() ?? ""} / ${mode} / ${unit.id}`}</p>
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
    const unit = { ...schema.createSnapshot({ question: "What?" }), id: "task" }
    const worksheet = openWorksheet({
      mode: WorksheetMode.ViewingFeedback,
      store: getStore(),
      contentSchema: schema,
      answersSchema,
      feedbackSchema,
      initialSnapshot: { content: unit, answers, feedback },
    })
    return renderToStaticMarkup(
      <WorksheetContext.Provider value={worksheet}>
        <BlockView value={worksheet.content} />
      </WorksheetContext.Provider>,
    )
  }

  test("renders unit with matching answer, feedback, and worksheet mode", () => {
    const markup = renderExercise({
      answers: { task: { type: "question", response: "42" } },
      feedback: { task: { type: "question", comment: "Correct" } },
    })
    expect(markup).toBe("<p>What? / 42 / Correct / viewing-feedback / task</p>")
  })

  test("throws for answer with wrong type", () => {
    expect(() => renderExercise({ answers: { task: { type: "other", response: "42" } } })).toThrow(
      "Antwort passt nicht zur Aufgabe.",
    )
  })

  test("throws for feedback with wrong type", () => {
    expect(() =>
      renderExercise({ feedback: { task: { type: "other", comment: "Incorrect" } } }),
    ).toThrow("Feedback passt nicht zur Aufgabe.")
  })
})
