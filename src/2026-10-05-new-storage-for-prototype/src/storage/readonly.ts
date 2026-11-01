import { defineMountHandler, definePlugin } from "prosekit/core"
import { Plugin, type EditorState } from "prosekit/pm/state"

import {
  createRichTextEditor,
  type RichTextEditor,
  type RichTextEditorConfig,
  type RichTextEditorOptions,
} from "../rich-text/index.ts"
import type { JSONValue } from "../utils/index.ts"
import type { NodeStore, NodeWriter, Ref, RichTextId } from "./types.ts"

type ReadonlyNodeRef = JSONValue & Ref

type ReadonlyNodeRefs = {
  cell: JSONValue & Ref
  array: readonly ReadonlyNodeRef[] & Ref
  map: Readonly<Record<string, ReadonlyNodeRef>> & Ref
}
type ReadonlyNodeStoreContract = NodeStore<ReadonlyNodeRefs>

// TODO: Add proper read-only storage types and read-only schema handles.
/** Immutable nested JSON; initialization is setup, not an observable change. */
export class ReadonlyNodeStore implements ReadonlyNodeStoreContract {
  private rootRef: ReadonlyNodeRef | undefined
  private initializing = false
  private readonly editors = new Map<RichTextId, RichTextEditor>()

  readonly cell: ReadonlyNodeStoreContract["cell"] = {
    create: (value) => this.create(structuredClone(value)),
    get: (ref) => ref,
  }

  readonly array: ReadonlyNodeStoreContract["array"] = {
    create: (items) => this.create([...items]),
    get: (ref) => ref,
  }

  readonly map: ReadonlyNodeStoreContract["map"] = {
    create: (fields) => this.create({ ...fields }),
    get: (ref) => ref,
  }

  readonly root: ReadonlyNodeStoreContract["root"] = {
    getOrCreate: (create) => {
      if (this.rootRef !== undefined) return this.rootRef
      if (this.initializing) throw new Error("Root initialization already in progress.")
      this.initializing = true
      try {
        return (this.rootRef = create())
      } finally {
        this.initializing = false
      }
    },
  }

  createRichText(options: RichTextEditorOptions): RichTextId {
    if (!this.initializing) return readOnlyError()
    const id: RichTextId = `rich-text:${crypto.randomUUID()}`
    this.editors.set(id, createReadonlyEditor(options))
    return id
  }

  // TODO: Add a lightweight read-only rich-text view with a smaller bundle than ProseMirror.
  getEditor(id: RichTextId, _config: RichTextEditorConfig): RichTextEditor {
    const editor = this.editors.get(id)
    if (!editor) throw new Error(`Unknown rich-text ID: ${id}.`)
    return editor
  }

  getRevision(): number {
    return 0
  }

  subscribe(_listener: () => void): () => void {
    return () => {}
  }

  transact<Result>(_callback: (write: NodeWriter<ReadonlyNodeRefs>) => Result): Result {
    return readOnlyError()
  }

  private create<Value extends JSONValue>(value: Value): Value & Ref {
    if (!this.initializing) return readOnlyError()
    // Branding only: refs are the frozen values themselves, including primitives.
    return freezeJSON(value) as Value & Ref
  }
}

function createReadonlyEditor(options: RichTextEditorOptions): RichTextEditor {
  const plugin = new Plugin({
    props: { editable: () => false },
    filterTransaction(transaction) {
      if (transaction.docChanged) return readOnlyError()
      return true
    },
  })
  const editor = createRichTextEditor({
    ...options,
    extensions: [
      ...(options.extensions ?? []),
      definePlugin(plugin),
      defineMountHandler((view) => {
        const updateState = view.updateState.bind(view)
        view.updateState = (state) => {
          checkState(state)
          updateState(state)
        }
        // setProps() also accepts a replacement state, bypassing updateState().
        const update = view.update.bind(view)
        view.update = (props) => {
          checkState(props.state)
          update(props)
        }
      }),
    ],
  })
  const doc = editor.state.doc
  doc.check()
  // ProseMirror JSON may share attribute objects with its document.
  const getDocJSON = editor.getDocJSON
  editor.getDocJSON = () => structuredClone(getDocJSON())
  const updateState = editor.updateState
  editor.updateState = (state) => {
    checkState(state)
    updateState(state)
  }
  // ProseKit setContent() creates a new state without applying transactions.
  editor.setContent = readOnlyError
  return editor

  function checkState(state: EditorState): void {
    if (!doc.eq(state.doc) || !state.plugins.includes(plugin)) readOnlyError()
  }
}

function freezeJSON<Value extends JSONValue>(value: Value): Value {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeJSON)
    Object.freeze(value)
  }
  return value
}

function readOnlyError(): never {
  throw new Error("Storage is read-only.")
}
