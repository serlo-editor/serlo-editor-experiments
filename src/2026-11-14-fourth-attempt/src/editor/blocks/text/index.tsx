import { RichText, StaticRichText } from "@editor/components"
import { richText as definition } from "@editor/rich-text"
import { block, richText } from "@editor/schema"
import type { StoredBlock } from "@editor/schema"
import { WorksheetMode, useWorksheet } from "@editor/worksheet"

const textDefinition = definition.block({
  marks: { bold: true, italic: true },
  blocks: { paragraph: true, heading: true, orderedList: true, bulletList: true },
})

const textFields = { content: richText({ definition: textDefinition }) }

export const TextContent = block({ type: "text", fields: textFields, render: TextView })

function TextView({ value }: { value: StoredBlock<"text", typeof textFields> }) {
  const { mode } = useWorksheet()
  return mode === WorksheetMode.EditingContent ? (
    <RichText value={value.content} />
  ) : (
    <StaticRichText value={value.content} />
  )
}
