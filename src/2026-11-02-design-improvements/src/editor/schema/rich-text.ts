import type { RichTextEditor, RichTextEditorConfig, RichTextJSON } from "../rich-text/index.ts"
import { isRichTextId, type RichTextId } from "../storage/types.ts"
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
