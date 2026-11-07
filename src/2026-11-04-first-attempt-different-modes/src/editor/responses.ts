import { FillInTheGapExercise, MultipleChoiceExercise } from "./blocks"
import { feedbackFields, feedbackText } from "./blocks/shared/feedback"
import { blockUnion, object, record } from "./schema"
import type { StoredValueOf } from "./schema/types"

const GapAnswer = FillInTheGapExercise.answer
const ChoiceAnswer = MultipleChoiceExercise.answer
const GapFeedback = FillInTheGapExercise.feedback
const ChoiceFeedback = MultipleChoiceExercise.feedback

// Record keys reference content block IDs; response block IDs identify responses themselves.
export const Answers = record(blockUnion([GapAnswer, ChoiceAnswer]))

export const Feedback = object({
  overall: feedbackFields.comment,
  exercises: record(blockUnion([GapFeedback, ChoiceFeedback])),
})

export function ensureExerciseFeedback(
  feedback: StoredValueOf<typeof Feedback>,
  exerciseId: string,
  kind: "gap-feedback" | "choice-feedback",
) {
  const exercises = feedback.field("exercises")
  let entry = exercises.get(exerciseId)
  if (!entry) {
    const definition = kind === "gap-feedback" ? GapFeedback : ChoiceFeedback
    exercises.set(
      exerciseId,
      definition.createSnapshot({
        comment: feedbackText(),
        result: "automatic",
        automaticResult: "unassessed",
      }),
    )
    entry = exercises.get(exerciseId)
  }
  if (entry?.type !== kind) throw new Error("Incompatible feedback type.")
  return entry
}
