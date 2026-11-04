import type { RichTextEditor, RichTextEditorConfig, RichTextJSON } from "../rich-text/index.ts"
import { isRichTextId, type RichTextId } from "../storage/index.ts"
import type { JSONValue } from "../utils/index.ts"
import type { Schema, StoredValue } from "./types.ts"

export interface StoredRichText extends StoredValue<RichTextJSON> {
  readonly id: RichTextId
  getEditor(): RichTextEditor
}

/** Stores an editor ID in a cell; snapshots contain only ProseMirror JSON. */
export function richText(
  config: RichTextEditorConfig,
): Schema<RichTextJSON, StoredRichText, "cell"> {
  return {
    create(store, content) {
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
