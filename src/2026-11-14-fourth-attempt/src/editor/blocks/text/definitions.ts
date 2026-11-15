import { richText } from "@editor/rich-text"

export const inlineRichTextDefinition = richText.inline({ marks: { bold: true, italic: true } })

export const textContentRichTextDefinition = richText.block({
  marks: { bold: true, italic: true },
  blocks: { paragraph: true, heading: true, orderedList: true, bulletList: true },
})
