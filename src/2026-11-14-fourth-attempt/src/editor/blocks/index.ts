import { array, discriminatedUnion } from "@editor/schema"
import type { SnapshotOf, StoredValueOf } from "@editor/schema"

import { FillInTheGapExercise } from "./fill-in-the-gap"
import { MultipleChoiceExercise } from "./multiple-choice"
import { TextContent } from "./text"

export { FillInTheGapExercise } from "./fill-in-the-gap"
export { MultipleChoiceExercise } from "./multiple-choice"
export { TextContent } from "./text"
export { Answers, Feedback } from "./responses"
export { ExerciseFeedback, feedbackFields } from "./shared/feedback"

export const FillInTheBlank = FillInTheGapExercise
export const MultipleChoice = MultipleChoiceExercise
export const Root = array(discriminatedUnion([TextContent, FillInTheBlank, MultipleChoice]), {
  defaultLength: 0,
})
export type RootValue = StoredValueOf<typeof Root>
export type RootSnapshot = SnapshotOf<typeof Root>
