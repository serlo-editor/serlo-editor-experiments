import { RichText, StaticRichText } from "@editor/blocks/shared/rich-text"
import { block, richText } from "@editor/schema"
import type { StoredBlock } from "@editor/schema"
import { WorksheetMode, useWorksheet } from "@editor/worksheet"

import { textContentRichTextDefinition } from "./definitions.ts"

const textFields = { content: richText({ definition: textContentRichTextDefinition }) }

export const TextContent = block({ type: "text", fields: textFields, render: TextView })

function TextView({ value }: { value: StoredBlock<"text", typeof textFields> }) {
  const { mode } = useWorksheet()
  return mode === WorksheetMode.EditingContent ? (
    <RichText value={value.content} />
  ) : (
    <StaticRichText value={value.content} />
  )
}
