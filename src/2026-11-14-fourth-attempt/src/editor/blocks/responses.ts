import { discriminatedUnion, record } from "../schema"
import { FillInTheGapExercise, MultipleChoiceExercise } from "./index"

export const Answers = record(
  discriminatedUnion([FillInTheGapExercise.answer, MultipleChoiceExercise.answer]),
)

export const Feedback = record(
  discriminatedUnion([FillInTheGapExercise.feedback, MultipleChoiceExercise.feedback]),
)
