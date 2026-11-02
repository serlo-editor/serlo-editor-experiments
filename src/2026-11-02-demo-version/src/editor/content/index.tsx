import { RichTextField } from "../components/RichText"
import { richText as definition } from "../rich-text"
import { childUnit, array, richText, unit } from "../schema"
import type { HandleOf, SnapshotOf } from "../schema/types"
import { DragAndDropBlanks, FillInTheBlank } from "./blanks"
import { MultipleChoice, SingleChoice } from "./choice"
import { FreeText } from "./free-text"
import { ImageDragAndDrop } from "./image-drag-and-drop"
import { TextInput } from "./text-input"

export { DragAndDropBlanks, FillInTheBlank } from "./blanks"
export { MultipleChoice, SingleChoice, type ChoiceHandle } from "./choice"
export { FreeText } from "./free-text"
export {
  ImageDragAndDrop,
  zoneRect,
  zoneStyle,
  type Rect,
  type ZoneHandle,
} from "./image-drag-and-drop"
export { TextInput } from "./text-input"

const textDefinition = definition.block({
  marks: { bold: true, italic: true },
  blocks: { paragraph: true, heading: true, orderedList: true, bulletList: true },
})

export const TextContent = unit({
  type: "text",
  fields: { content: richText({ definition: textDefinition }) },
  render: ({ handle }) => <RichTextField handle={handle.field("content")} />,
})

export const Root = array(
  childUnit([
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
export type RootHandle = HandleOf<typeof Root>
export type RootSnapshot = SnapshotOf<typeof Root>
export type ContentHandle = ReturnType<RootHandle["children"]>[number]
