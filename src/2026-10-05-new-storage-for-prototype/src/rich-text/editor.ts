import {
  createEditor,
  defineUpdateHandler,
  type Extension,
  type NodeJSON,
  type UpdateHandler,
  union,
} from "prosekit/core"

import {
  defineRichTextExtension,
  type RichTextDefinition,
  validateRichTextContent,
} from "./definition.ts"

/** Creates a ProseKit editor; collaboration is supplied through extensions. */
export function createRichTextEditor({
  definition,
  defaultContent,
  extensions = [],
  onViewUpdate,
}: {
  definition: RichTextDefinition
  defaultContent?: NodeJSON
  extensions?: readonly Extension[]
  onViewUpdate?: UpdateHandler
}) {
  const definitionExtension = defineRichTextExtension(definition)
  if (defaultContent !== undefined) {
    const schema = definitionExtension.schema
    if (!schema) throw new Error("Rich-text definition did not produce a schema.")
    validateRichTextContent(schema.nodeFromJSON(defaultContent), definition)
  }

  return createEditor({
    ...(defaultContent === undefined ? {} : { defaultContent }),
    extension: union(
      definitionExtension,
      ...extensions,
      ...(onViewUpdate ? [defineUpdateHandler(onViewUpdate)] : []),
    ),
  })
}
