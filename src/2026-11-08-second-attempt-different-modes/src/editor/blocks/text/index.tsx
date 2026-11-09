import { RichText } from "../../components/RichText"
import { StaticRichText } from "../../components/StaticRichText"
import { richText as definition } from "../../rich-text"
import { block, richText } from "../../schema"
import { WorksheetMode } from "../../worksheet"
import { useWorksheet } from "../../worksheet-context"

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
