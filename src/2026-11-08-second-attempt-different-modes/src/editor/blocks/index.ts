import { array, discriminatedUnion } from "../schema"
import type { SnapshotOf, StoredValueOf } from "../schema/types"
import { FillInTheGapExercise } from "./fill-in-the-gap"
import { MultipleChoiceExercise } from "./multiple-choice"
import { TextContent } from "./text"

export { FillInTheGapExercise } from "./fill-in-the-gap"
export { MultipleChoiceExercise } from "./multiple-choice"
export { TextContent } from "./text"

export const FillInTheBlank = FillInTheGapExercise
export const MultipleChoice = MultipleChoiceExercise
export const Root = array(discriminatedUnion([TextContent, FillInTheBlank, MultipleChoice]))
export type RootValue = StoredValueOf<typeof Root>
export type RootSnapshot = SnapshotOf<typeof Root>
