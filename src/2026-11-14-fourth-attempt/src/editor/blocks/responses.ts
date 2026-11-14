import { discriminatedUnion, record } from "../schema"
import { FillInTheGapExercise, MultipleChoiceExercise } from "./index"
import { Overall, feedbackText, overallKey } from "./shared/feedback"

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
