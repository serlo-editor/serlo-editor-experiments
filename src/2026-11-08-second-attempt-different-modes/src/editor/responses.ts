import { FillInTheGapExercise, MultipleChoiceExercise } from "./blocks"
import { feedbackFields } from "./blocks/shared/feedback"
import { discriminatedUnion, object, record } from "./schema"

export const Answers = record(
  discriminatedUnion([FillInTheGapExercise.answer, MultipleChoiceExercise.answer]),
)

export const Feedback = object({
  overall: feedbackFields.comment,
  exercises: record(
    discriminatedUnion([FillInTheGapExercise.feedback, MultipleChoiceExercise.feedback]),
  ),
})
