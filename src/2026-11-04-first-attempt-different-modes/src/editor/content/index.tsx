import { RichText } from "../components/RichText"
import { StaticRichText } from "../components/StaticRichText"
import { richText as definition } from "../rich-text"
import { array, block, blockUnion, richText } from "../schema"
import type { SnapshotOf, StoredValueOf } from "../schema/types"
import { useWorksheet } from "../worksheet-context"
import { FillInTheGapExercise, MultipleChoiceExercise } from "./exercises"

export { FillInTheGapExercise, MultipleChoiceExercise } from "./exercises"

const textDefinition = definition.block({
  marks: { bold: true, italic: true },
  blocks: { paragraph: true, heading: true, orderedList: true, bulletList: true },
})

export const TextContent = block({
  type: "text",
  fields: { content: richText({ definition: textDefinition }) },
  render: function TextView({ value }) {
    const { mode } = useWorksheet()
    return mode === "authoring" ? (
      <RichText value={value.field("content")} />
    ) : (
      <StaticRichText value={value.field("content")} />
    )
  },
})

export const FillInTheBlank = FillInTheGapExercise.unit
export const MultipleChoice = MultipleChoiceExercise.unit
export const Root = array(blockUnion([TextContent, FillInTheBlank, MultipleChoice]))
export type RootValue = StoredValueOf<typeof Root>
export type RootSnapshot = SnapshotOf<typeof Root>
