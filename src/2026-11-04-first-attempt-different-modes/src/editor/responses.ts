import { block, blockUnion, boolean, object, record, string } from "./schema"
import type { StoredValueOf } from "./schema/types"

export const GapAnswer = block({
  type: "gap-answer",
  fields: { values: record(string()) },
  render: () => null,
})

export const ChoiceAnswer = block({
  type: "choice-answer",
  fields: { selected: record(boolean()) },
  render: () => null,
})

// Record keys reference content block IDs; response block IDs identify responses themselves.
export const Answers = record(blockUnion([GapAnswer, ChoiceAnswer]))

const feedbackFields = { comment: string(), result: string() }
export const GapFeedback = block({
  type: "gap-feedback",
  fields: feedbackFields,
  render: () => null,
})
export const ChoiceFeedback = block({
  type: "choice-feedback",
  fields: feedbackFields,
  render: () => null,
})

export const Feedback = object({
  overall: string(),
  exercises: record(blockUnion([GapFeedback, ChoiceFeedback])),
})

export function setGapAnswer(
  answers: StoredValueOf<typeof Answers>,
  exerciseId: string,
  gapId: string,
  text: string,
) {
  let answer = answers.get(exerciseId)
  if (!answer) {
    answers.set(exerciseId, GapAnswer.createSnapshot({ values: {} }))
    answer = answers.get(exerciseId)
  }
  if (answer?.type !== "gap-answer") throw new Error("Incompatible answer type.")
  answer.field("values").set(gapId, text)
}

export function setChoiceAnswer(
  answers: StoredValueOf<typeof Answers>,
  exerciseId: string,
  optionId: string,
  selected: boolean,
) {
  let answer = answers.get(exerciseId)
  if (!answer) {
    answers.set(exerciseId, ChoiceAnswer.createSnapshot({ selected: {} }))
    answer = answers.get(exerciseId)
  }
  if (answer?.type !== "choice-answer") throw new Error("Incompatible answer type.")
  answer.field("selected").set(optionId, selected)
}

export function setExerciseFeedback(
  feedback: StoredValueOf<typeof Feedback>,
  exerciseId: string,
  kind: "gap-feedback" | "choice-feedback",
  field: "comment" | "result",
  text: string,
) {
  const exercises = feedback.field("exercises")
  let entry = exercises.get(exerciseId)
  if (!entry) {
    const definition = kind === "gap-feedback" ? GapFeedback : ChoiceFeedback
    exercises.set(exerciseId, definition.createSnapshot({ comment: "", result: "unassessed" }))
    entry = exercises.get(exerciseId)
  }
  if (entry?.type !== kind) throw new Error("Incompatible feedback type.")
  entry.field(field).set(text)
}
