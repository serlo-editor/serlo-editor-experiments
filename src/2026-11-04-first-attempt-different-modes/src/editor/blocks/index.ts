import { array, blockUnion } from "../schema"
import type { SnapshotOf, StoredValueOf } from "../schema/types"
import { FillInTheGapExercise } from "./fill-in-the-gap"
import { MultipleChoiceExercise } from "./multiple-choice"
import { TextContent } from "./text"

export { FillInTheGapExercise } from "./fill-in-the-gap"
export { MultipleChoiceExercise } from "./multiple-choice"
export { TextContent } from "./text"

export const FillInTheBlank = FillInTheGapExercise.unit
export const MultipleChoice = MultipleChoiceExercise.unit
export const Root = array(blockUnion([TextContent, FillInTheBlank, MultipleChoice]))
export type RootValue = StoredValueOf<typeof Root>
export type RootSnapshot = SnapshotOf<typeof Root>
