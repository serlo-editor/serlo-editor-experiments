import { RichTextField } from "../components/RichText"
import { richText as definition } from "../rich-text"
import {
  array,
  block,
  discriminatedUnion,
  richText,
  type SnapshotOf,
  type StoredValueOf,
} from "../schema"
import { DragAndDropBlanks, FillInTheBlank } from "./blanks"
import { MultipleChoice, SingleChoice } from "./choice"
import { ImageDragAndDrop } from "./image-drag-and-drop"
import { FreeText, TextInput } from "./text"

export { DragAndDropBlanks, FillInTheBlank } from "./blanks"
export { MultipleChoice, SingleChoice, type ChoiceValue } from "./choice"
export { ImageDragAndDrop, zoneRect, zoneStyle, type ZoneHandle } from "./image-drag-and-drop"
export { FreeText, TextInput } from "./text"

export const TextContent = block({
  type: "text",
  fields: {
    content: richText({
      definition: definition.block({
        marks: { bold: true, italic: true },
        blocks: { paragraph: true, heading: true, orderedList: true, bulletList: true },
      }),
    }),
  },
  render: ({ value }) => <RichTextField handle={value.content} />,
})

export const Root = array(
  discriminatedUnion([
    TextContent,
    SingleChoice,
    MultipleChoice,
    TextInput,
    FillInTheBlank,
    DragAndDropBlanks,
    ImageDragAndDrop,
    FreeText,
  ]),
)
export type RootSnapshot = SnapshotOf<typeof Root>
export type ContentValue = ReturnType<StoredValueOf<typeof Root>["children"]>[number]
