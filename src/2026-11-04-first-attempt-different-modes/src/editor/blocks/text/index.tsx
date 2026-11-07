import { RichText } from "../../components/RichText"
import { StaticRichText } from "../../components/StaticRichText"
import { richText as definition } from "../../rich-text"
import { block, richText } from "../../schema"
import { useWorksheet } from "../../worksheet-context"
import { WorksheetMode } from "../../worksheet-mode"

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
      <RichText value={value.field("content")} />
    ) : (
      <StaticRichText value={value.field("content")} />
    )
  },
})
