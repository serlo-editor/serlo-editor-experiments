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

function definitions() {
  const choice = exercise({
    unit: { type: "choice", fields: { question: string() } },
    answer: { fields: { response: string() } },
    feedback: { fields: { comment: string() } },
    render: ({ unit, answer, feedback, mode }) => (
      <p>
        {unit.field("question").get()}:{answer?.field("response").get() ?? "missing"}:
        {feedback?.field("comment").get() ?? "missing"}:{mode}
      </p>
    ),
  })
  const otherAnswer = taggedObject({ type: "other-answer", fields: {} })
  const otherFeedback = taggedObject({ type: "other-feedback", fields: {} })
  return { choice, otherAnswer, otherFeedback }
}

describeWithStores("exercise", (getStore) => {
  test("renders co-located answer and feedback by unit ID with worksheet mode", () => {
    const { choice, otherAnswer, otherFeedback } = definitions()
    const unit = choice.unit.createSnapshot({ question: "Question" })
    const answer = { type: choice.answer.type, response: "Response" }
    const feedback = { type: choice.feedback.type, comment: "Comment" }
    const worksheet = openWorksheet({
      mode: WorksheetMode.ViewingFeedback,
      store: getStore(),
      contentSchema: choice.unit,
      answersSchema: record(discriminatedUnion([choice.answer, otherAnswer])),
      feedbackSchema: record(discriminatedUnion([choice.feedback, otherFeedback])),
      initialSnapshot: {
        content: unit,
        answers: { [unit.id]: answer, unrelated: { type: otherAnswer.type } },
        feedback: { [unit.id]: feedback, unrelated: { type: otherFeedback.type } },
      },
    })
    const view = () =>
      renderToStaticMarkup(
        <WorksheetContext.Provider value={worksheet}>
          <BlockView value={worksheet.content} />
        </WorksheetContext.Provider>,
      )

    expect(view()).toBe("<p>Question:Response:Comment:viewing-feedback</p>")
    expect(worksheet.answers.get(unit.id)?.type).toBe(unit.type)
    expect(worksheet.feedback.get(unit.id)?.type).toBe(unit.type)
  })

  test("handles absent responses and rejects mismatched definitions", () => {
    const { choice, otherAnswer, otherFeedback } = definitions()
    const unit = choice.unit.createSnapshot({ question: "Question" })
    const worksheet = openWorksheet({
      mode: WorksheetMode.Answering,
      store: getStore(),
      contentSchema: choice.unit,
      answersSchema: record(discriminatedUnion([choice.answer, otherAnswer])),
      feedbackSchema: record(discriminatedUnion([choice.feedback, otherFeedback])),
      initialSnapshot: { content: unit, answers: {}, feedback: {} },
    })
    const view = () =>
      renderToStaticMarkup(
        <WorksheetContext.Provider value={worksheet}>
          <BlockView value={worksheet.content} />
        </WorksheetContext.Provider>,
      )

    expect(view()).toBe("<p>Question:missing:missing:answering</p>")
    worksheet.answers.set(unit.id, { type: otherAnswer.type })
    expect(view()).toBe('<p role="alert">Antwort passt nicht zur Aufgabe.</p>')
    worksheet.answers.set(unit.id, { type: choice.answer.type, response: "Response" })
    // GivingFeedback is required to modify feedback; open separate writable worksheet below.
    const grading = openWorksheet({
      mode: WorksheetMode.GivingFeedback,
      store: getStore(),
      contentSchema: choice.unit,
      answersSchema: record(discriminatedUnion([choice.answer, otherAnswer])),
      feedbackSchema: record(discriminatedUnion([choice.feedback, otherFeedback])),
      initialSnapshot: { content: unit, answers: {}, feedback: {} },
    })
    grading.feedback.set(unit.id, { type: otherFeedback.type })
    expect(
      renderToStaticMarkup(
        <WorksheetContext.Provider value={grading}>
          <BlockView value={grading.content} />
        </WorksheetContext.Provider>,
      ),
    ).toBe('<p role="alert">Feedback passt nicht zur Aufgabe.</p>')
  })
  test("rejects a different answer schema even with matching type", () => {
    const { choice } = definitions()
    const unit = choice.unit.createSnapshot({ question: "Question" })
    const wrongAnswer = taggedObject({ type: "choice", fields: { other: string() } })
    const worksheet = openWorksheet({
      mode: WorksheetMode.Answering,
      store: getStore(),
      contentSchema: choice.unit,
      answersSchema: record(wrongAnswer),
      feedbackSchema: record(choice.feedback),
      initialSnapshot: {
        content: unit,
        answers: { [unit.id]: { type: "choice", other: "Wrong" } },
        feedback: {},
      },
    })
    expect(
      renderToStaticMarkup(
        <WorksheetContext.Provider value={worksheet}>
          <BlockView value={worksheet.content} />
        </WorksheetContext.Provider>,
      ),
    ).toBe('<p role="alert">Antwort passt nicht zur Aufgabe.</p>')
  })

  test("requires worksheet provider", () => {
    const { choice } = definitions()
    const unit = choice.unit.createSnapshot({ question: "Question" })
    const worksheet = openWorksheet({
      mode: WorksheetMode.Answering,
      store: getStore(),
      contentSchema: choice.unit,
      answersSchema: record(choice.answer),
      feedbackSchema: record(choice.feedback),
      initialSnapshot: { content: unit, answers: {}, feedback: {} },
    })
    expect(() => renderToStaticMarkup(<BlockView value={worksheet.content} />)).toThrow(
      "Worksheet provider missing.",
    )
  })
})
