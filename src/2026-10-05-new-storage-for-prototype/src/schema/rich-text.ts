import {
  createRichTextEditor,
  type RichTextEditor,
  type RichTextEditorConfig,
  type RichTextJSON,
} from "../rich-text/index.ts"
import { isRichTextId, type RichTextId } from "../storage/types.ts"
import { isObject } from "../utils/guard.ts"
import type { JSONValue } from "../utils/index.ts"
import type { Handle, Schema } from "./types.ts"

export interface RichTextHandle extends Handle<RichTextJSON> {
  readonly id: RichTextId
  getEditor(): RichTextEditor
}

/** Stores an editor ID in a cell; snapshots contain only ProseMirror JSON. */
export function richText(
  config: RichTextEditorConfig,
): Schema<RichTextJSON, RichTextHandle, "cell"> {
  let validationSchema: RichTextEditor["schema"] | undefined
  const validate = (content: unknown) => {
    if (!isObject(content) || typeof content.type !== "string") {
      throw new TypeError("Expected rich-text document.")
    }
    validationSchema ??= createRichTextEditor({
      ...config,
      defaultContent: { ...structuredClone(content), type: content.type },
    }).schema
    const doc = validationSchema.nodeFromJSON(content)
    if (doc.type !== validationSchema.topNodeType)
      throw new TypeError("Expected rich-text document.")
    doc.check()
  }

  return {
    validate,

    create(store, content) {
      validate(content)
      const editorId = store.createRichText({ ...config, defaultContent: content })
      return store.cell.create({ kind: "richText", editorId })
    },

    bind(store, ref) {
      const id = readRichTextId(store.cell.get(ref))
      const getEditor = () => store.getEditor(id, config)

      return {
        id,
        getEditor,
        snapshot: () => getEditor().getDocJSON() as RichTextJSON,
      }
    },
  }
}

function readRichTextId(value: JSONValue): RichTextId {
  if (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "richText" &&
    "editorId" in value &&
    isRichTextId(value.editorId)
  ) {
    return value.editorId
  }
  throw new TypeError("Expected rich-text cell.")
}
