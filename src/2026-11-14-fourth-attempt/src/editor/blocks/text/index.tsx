import { RichText } from "@editor/components/RichText"
import { StaticRichText } from "@editor/components/StaticRichText"
import { richText as definition } from "@editor/rich-text"
import { block, richText } from "@editor/schema"
import { WorksheetMode, useWorksheet } from "@editor/worksheet"

const textDefinition = definition.block({
  marks: { bold: true, italic: true },
  blocks: { paragraph: true, heading: true, orderedList: true, bulletList: true },
})

export const TextContent = block({
  type: "text",
  fields: { content: richText({ definition: textDefinition }) },
  render: function TextView({ value }) {
    const { mode } = useWorksheet()
    return mode === WorksheetMode.EditingContent ? (
      <RichText value={value.content} />
    ) : (
      <StaticRichText value={value.content} />
    )
  },
})
