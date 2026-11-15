import { richText as definition } from "@editor/rich-text"
import { block, richText } from "@editor/schema"

import { TextView } from "./view"

const textDefinition = definition.block({
  marks: { bold: true, italic: true },
  blocks: { paragraph: true, heading: true, orderedList: true, bulletList: true },
})

export const textFields = { content: richText({ definition: textDefinition }) }

export const TextContent = block({ type: "text", fields: textFields, render: TextView })
