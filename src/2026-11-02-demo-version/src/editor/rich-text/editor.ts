import {
  createEditor,
  defineUpdateHandler,
  type Extension,
  type NodeJSON,
  type UpdateHandler,
  union,
} from "prosekit/core"

import type { JSONValue } from "../utils/json-value.ts"
import { defineRichTextExtension, type RichTextDefinition } from "./definition.ts"

export interface RichTextEditorConfig {
  definition: RichTextDefinition
  extensions?: readonly Extension[]
  onViewUpdate?: UpdateHandler
}

export interface RichTextEditorOptions extends RichTextEditorConfig {
  defaultContent?: NodeJSON
}

/** Creates a ProseKit editor; collaboration is supplied through extensions. */
export function createRichTextEditor({
  definition,
  defaultContent,
  extensions = [],
  onViewUpdate,
}: RichTextEditorOptions) {
  return createEditor({
    ...(defaultContent === undefined ? {} : { defaultContent }),
    extension: union(
      defineRichTextExtension(definition),
      ...extensions,
      ...(onViewUpdate ? [defineUpdateHandler(onViewUpdate)] : []),
    ),
  })
}

export type RichTextEditor = ReturnType<typeof createRichTextEditor>
export type RichTextJSON = NodeJSON & JSONValue
