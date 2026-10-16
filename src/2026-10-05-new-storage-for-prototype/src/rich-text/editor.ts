import {
  createEditor,
  defineUpdateHandler,
  type Extension,
  type NodeJSON,
  type UpdateHandler,
  union,
} from "prosekit/core"

import { defineRichTextExtension, type RichTextDefinition } from "./definition.ts"

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
  return createEditor({
    ...(defaultContent === undefined ? {} : { defaultContent }),
    extension: union(
      defineRichTextExtension(definition),
      ...extensions,
      ...(onViewUpdate ? [defineUpdateHandler(onViewUpdate)] : []),
    ),
  })
}
