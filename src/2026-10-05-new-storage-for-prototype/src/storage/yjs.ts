import { defineMountHandler } from "prosekit/core"
import { type Awareness, defineYjs } from "prosekit/extensions/yjs"
import { prosemirrorToYXmlFragment, yXmlFragmentToProseMirrorRootNode } from "y-prosemirror"
import * as Y from "yjs"

import {
  createRichTextEditor,
  type RichTextEditor,
  type RichTextEditorConfig,
  type RichTextEditorOptions,
} from "../rich-text/index.ts"
import type { JSONValue } from "../utils/index.ts"
import { ChangeTracker } from "./change-tracker.ts"
import { createEditorSpecificAwareness } from "./editor-awareness.ts"
import type { NodeKind, NodeStore, Ref, RichTextId } from "./types.ts"

type YArray = Y.Array<YjsNodeRef>
type YMap = Y.Map<YjsNodeRef>

type YjsNodeRefs = {
  cell: Y.Map<JSONValue> & Ref
  array: YArray & Ref
  map: YMap & Ref
}
type YjsNodeRef = YjsNodeRefs[NodeKind]

type YjsNodeStoreContract = NodeStore<YjsNodeRefs, Y.Transaction>

export class YjsNodeStore implements YjsNodeStoreContract {
  private readonly doc: Y.Doc
  private readonly awareness: Awareness
  private readonly editors = new Map<RichTextId, RichTextEditor>()
  private readonly changes = new ChangeTracker()

  constructor({ doc, awareness }: { awareness: Awareness; doc: Y.Doc }) {
    this.doc = doc
    this.awareness = awareness
    // Store follows document lifetime; track local and remote changes without subscribers.
    doc.on("afterTransaction", (transaction: Y.Transaction) => {
      if (this.hasStorageChanges(transaction)) this.changes.publish()
    })
  }

  readonly cell: YjsNodeStoreContract["cell"] = {
    create: (value) => {
      const cell = new Y.Map<JSONValue>()
      cell.set("value", value)
      return cell as YjsNodeRefs["cell"]
    },
    get: (ref) => {
      const value = ref.get("value")
      if (value === undefined) {
        throw new Error("Cell value absent.")
      }
      return value
    },
    edit: (ref, tx) => {
      this.assertActiveTransaction(tx)
      return {
        set: (value) => {
          if (!Object.is(ref.get("value"), value)) ref.set("value", value)
        },
      }
    },
  }

  readonly array: YjsNodeStoreContract["array"] = {
    create: (items) => {
      const array = new Y.Array<YjsNodeRef>()
      array.push(items as YjsNodeRef[])
      return array as YjsNodeRefs["array"]
    },
    get: (ref) => ref.toArray(),
    edit: (ref, tx) => {
      this.assertActiveTransaction(tx)
      return {
        remove: (index) => {
          ref.delete(index, 1)
        },
        insert: (index, item) => {
          ref.insert(index, [item])
        },
      }
    },
  }

  readonly map: YjsNodeStoreContract["map"] = {
    create: (fields) => new Y.Map<YjsNodeRef>(Object.entries(fields)) as YjsNodeRefs["map"],
    get: (ref) => Object.fromEntries(ref.entries()),
    edit: (ref, tx) => {
      this.assertActiveTransaction(tx)
      return {
        set: (field, item) => {
          if (ref.get(field) !== item) ref.set(field, item)
        },
        remove: (field) => {
          ref.delete(field)
        },
      }
    },
  }

  createRichText(options: RichTextEditorOptions): RichTextId {
    // Validate against the combined schema before writing anything to Yjs.
    const editor = createRichTextEditor({
      ...options,
      ...(options.defaultContent === undefined
        ? {}
        : { defaultContent: structuredClone(options.defaultContent) }),
    })
    editor.state.doc.check()
    const id: RichTextId = `rich-text:${crypto.randomUUID()}`
    this.transact(() => {
      prosemirrorToYXmlFragment(editor.state.doc, this.doc.getXmlFragment(this.fragmentName(id)))
    })
    return id
  }

  getEditor(id: RichTextId, config: RichTextEditorConfig): RichTextEditor {
    const name = this.fragmentName(id)
    if (!this.doc.share.has(name)) throw new Error(`Unknown rich-text ID: ${id}.`)
    const fragment = this.doc.getXmlFragment(name)
    let editor = this.editors.get(id)
    if (!editor) {
      editor = createRichTextEditor({
        ...config,
        extensions: [
          ...(config.extensions ?? []),
          defineYjs({
            doc: this.doc,
            fragment,
            awareness: createEditorSpecificAwareness(id, this.awareness),
          }),
          // y-prosemirror 1.3.7 can dispatch queued cursor metadata after teardown.
          defineMountHandler((view) => {
            const dispatch = view.dispatch.bind(view)
            view.dispatch = (transaction) => {
              if (!view.isDestroyed) dispatch(transaction)
            }
          }),
        ],
      })
      this.editors.set(id, editor)
    }

    // Yjs view bindings are inactive while unmounted. Refresh local state only;
    // opening/snapshotting must never initialize or overwrite the shared fragment.
    if (!editor.mounted) {
      const sharedDoc = yXmlFragmentToProseMirrorRootNode(fragment, editor.schema)
      const currentDoc =
        fragment.length === 0 ? editor.schema.topNodeType.createAndFill() : sharedDoc
      if (!currentDoc) throw new Error("Cannot create empty rich-text document.")
      currentDoc.check()
      if (!editor.state.doc.eq(currentDoc)) {
        editor.updateState(
          editor.state.apply(
            editor.state.tr.replaceWith(0, editor.state.doc.content.size, currentDoc.content),
          ),
        )
      }
    }
    return editor
  }

  readonly root: YjsNodeStoreContract["root"] = {
    getOrCreate: (create) =>
      this.transact(
        (tx) => this.doc.getMap<YjsNodeRef>("root").get("root") ?? this.root.save(create(), tx),
      ),
    save: (ref, tx) => {
      this.assertActiveTransaction(tx)
      const root = this.doc.getMap<YjsNodeRef>("root")
      if (root.get("root") !== ref) root.set("root", ref)
      return ref
    },
  }

  getRevision(): number {
    return this.changes.getRevision()
  }

  subscribe(listener: () => void): () => void {
    return this.changes.subscribe(listener)
  }

  transact<T>(callback: (tx: Y.Transaction) => T): T {
    return this.doc.transact(callback, this)
  }

  private fragmentName(id: RichTextId): string {
    return `storage:richText:${id}`
  }

  private hasStorageChanges(transaction: Y.Transaction): boolean {
    for (const [name, type] of this.doc.share) {
      if (
        (name === "root" || name.startsWith("storage:richText:")) &&
        (transaction.changed.has(type) || transaction.changedParentTypes.has(type))
      ) {
        return true
      }
    }
    return false
  }

  private assertActiveTransaction(tx: Y.Transaction): void {
    if (tx.doc !== this.doc || this.doc._transaction !== tx) {
      throw new Error("Invalid transaction.")
    }
  }
}
