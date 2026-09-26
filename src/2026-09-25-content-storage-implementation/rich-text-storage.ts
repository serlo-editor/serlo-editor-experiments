import { createEditor, union, type Editor, type NodeJSON } from "prosekit/core"
import { defineYjsSyncPlugin } from "prosekit/extensions/yjs"
import type { Node } from "prosemirror-model"
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProseMirrorRootNode } from "y-prosemirror"
import * as Y from "yjs"

import type { RichTextValue } from "./content-storage.ts"
import type { RichTextSchema } from "./schema.ts"

export class LocalRichTextStore {
  private readonly entries = new Map<string, { node: Node; editor?: Editor }>()

  create(id: string, schema: RichTextSchema, snapshot: NodeJSON): void {
    this.entries.set(id, { node: schema.prosemirror.nodeFromJSON(snapshot) })
  }

  bind(id: string, schema: RichTextSchema): RichTextValue {
    const entry = () => {
      const value = this.entries.get(id)
      if (!value) throw new Error(`Cannot find rich text: ${id}`)
      return value
    }

    return {
      type: "richText",
      get: () => {
        const value = entry()
        return value.editor ? value.editor.getDocJSON() : value.node.toJSON()
      },
      editor: () => {
        const value = entry()
        value.editor ??= createEditor({
          extension: schema.extension,
          defaultContent: value.node.toJSON(),
        })
        return value.editor
      },
    }
  }

  dispose(): void {
    for (const value of this.entries.values()) value.editor?.unmount()
    this.entries.clear()
  }
}

export class YjsRichTextStore {
  private readonly editors = new Map<Y.XmlFragment, Editor>()

  initialize(fragment: Y.XmlFragment, schema: RichTextSchema, snapshot: NodeJSON): void {
    // Populate once, after integration. Never reseed content when opening an editor.
    prosemirrorJSONToYXmlFragment(schema.prosemirror, snapshot, fragment)
  }

  bind(fragment: Y.XmlFragment, schema: RichTextSchema): RichTextValue {
    const snapshot = (): NodeJSON =>
      yXmlFragmentToProseMirrorRootNode(fragment, schema.prosemirror).toJSON()

    return {
      type: "richText",
      get: snapshot,
      editor: () => {
        let editor = this.editors.get(fragment)
        if (!editor) {
          editor = createEditor({
            extension: union(schema.extension, defineYjsSyncPlugin({ fragment })),
            defaultContent: snapshot(),
          })
          this.editors.set(fragment, editor)
        }
        return editor
      },
    }
  }

  dispose(): void {
    for (const editor of this.editors.values()) editor.unmount()
    this.editors.clear()
  }
}
