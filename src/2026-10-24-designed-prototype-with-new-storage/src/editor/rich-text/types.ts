export enum RichTextFeature {
  Bold = "bold",
  Italic = "italic",
  Blank = "blank",
  Paragraph = "paragraph",
  Heading = "heading",
  List = "list",
}

const blockFeatures = [RichTextFeature.Paragraph, RichTextFeature.Heading, RichTextFeature.List]

export function isInline(features: RichTextFeature[]): boolean {
  return !features.some((feature) => blockFeatures.includes(feature))
}
