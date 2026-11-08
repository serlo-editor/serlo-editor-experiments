import { expect, test } from "bun:test"

import { renderToStaticMarkup } from "react-dom/server"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { WorksheetContext } from "../worksheet-context.ts"
import { openWorksheet, WorksheetMode } from "../worksheet.ts"
import { blockUnion } from "./block-union.ts"
import { BlockView } from "./block-view.ts"
import { block } from "./block.ts"
import { exercise } from "./exercise.tsx"
import { string } from "./primitives.ts"
import { record } from "./record.ts"

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
  const otherAnswer = block({ type: "other-answer", fields: {}, render: () => null })
  const otherFeedback = block({ type: "other-feedback", fields: {}, render: () => null })
  return { choice, otherAnswer, otherFeedback }
}

describeWithStores("exercise", (getStore) => {
  test("renders co-located answer and feedback by unit ID with worksheet mode", () => {
    const { choice, otherAnswer, otherFeedback } = definitions()
    const unit = choice.unit.createSnapshot({ question: "Question" })
    const answer = choice.answer.createSnapshot({ response: "Response" })
    const feedback = choice.feedback.createSnapshot({ comment: "Comment" })
    const worksheet = openWorksheet({
      mode: WorksheetMode.ViewingFeedback,
      store: getStore(),
      contentSchema: choice.unit,
      answersSchema: record(blockUnion([choice.answer, otherAnswer])),
      feedbackSchema: record(blockUnion([choice.feedback, otherFeedback])),
      initialSnapshot: {
        content: unit,
        answers: { [unit.id]: answer, unrelated: otherAnswer.createSnapshot({}) },
        feedback: { [unit.id]: feedback, unrelated: otherFeedback.createSnapshot({}) },
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
      answersSchema: record(blockUnion([choice.answer, otherAnswer])),
      feedbackSchema: record(blockUnion([choice.feedback, otherFeedback])),
      initialSnapshot: { content: unit, answers: {}, feedback: {} },
    })
    const view = () =>
      renderToStaticMarkup(
        <WorksheetContext.Provider value={worksheet}>
          <BlockView value={worksheet.content} />
        </WorksheetContext.Provider>,
      )

    expect(view()).toBe("<p>Question:missing:missing:answering</p>")
    worksheet.answers.set(unit.id, otherAnswer.createSnapshot({}))
    expect(view()).toBe('<p role="alert">Antwort passt nicht zur Aufgabe.</p>')
    worksheet.answers.set(unit.id, choice.answer.createSnapshot({ response: "Response" }))
    // GivingFeedback is required to modify feedback; open separate writable worksheet below.
    const grading = openWorksheet({
      mode: WorksheetMode.GivingFeedback,
      store: getStore(),
      contentSchema: choice.unit,
      answersSchema: record(blockUnion([choice.answer, otherAnswer])),
      feedbackSchema: record(blockUnion([choice.feedback, otherFeedback])),
      initialSnapshot: { content: unit, answers: {}, feedback: {} },
    })
    grading.feedback.set(unit.id, otherFeedback.createSnapshot({}))
    expect(
      renderToStaticMarkup(
        <WorksheetContext.Provider value={grading}>
          <BlockView value={grading.content} />
        </WorksheetContext.Provider>,
      ),
    ).toBe('<p role="alert">Feedback passt nicht zur Aufgabe.</p>')
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
