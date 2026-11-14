import { richText as definition } from "@editor/rich-text"
import { block, richText } from "@editor/schema"
import { WorksheetMode } from "@editor/worksheet"
import { useWorksheet } from "@editor/worksheet"

import { RichText } from "../../components/RichText"
import { StaticRichText } from "../../components/StaticRichText"

const textDefinition = definition.block({
  marks: { bold: true, italic: true },
  blocks: { paragraph: true, heading: true, orderedList: true, bulletList: true },
})

export const TextContent = block({
  type: "text",
  fields: { content: richText({ definition: textDefinition }) },
  render: function TextView({ value }) {
    const { mode } = useWorksheet()
    return (
      <div className="exercise--text">
        {mode === WorksheetMode.EditingContent ? (
          <RichText value={value.content} />
        ) : (
          <StaticRichText value={value.content} />
        )}
      </div>
    )
  },
})
