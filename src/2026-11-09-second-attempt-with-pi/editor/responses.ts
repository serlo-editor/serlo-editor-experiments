import { FillInTheGapExercise, MultipleChoiceExercise } from "./blocks"
import { Overall, feedbackText, overallKey } from "./blocks/shared/feedback"
import { discriminatedUnion, record } from "./schema"

export const Answers = record(
  discriminatedUnion([FillInTheGapExercise.answer, MultipleChoiceExercise.answer]),
)

export const Feedback = record(
  discriminatedUnion([FillInTheGapExercise.feedback, MultipleChoiceExercise.feedback, Overall]),
)

export function initialFeedback() {
  return {
    [overallKey]: {
      ...Overall.defaultValue(),
      comment: feedbackText(),
      result: "automatic",
      automaticResult: "unassessed",
    },
  }
}
