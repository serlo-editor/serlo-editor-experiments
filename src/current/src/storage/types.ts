import type {
  RichTextEditor,
  RichTextEditorConfig,
  RichTextEditorOptions,
} from "../rich-text/index.ts"
import type { Branded, JSONValue } from "../utils/index.ts"

export type Ref = Branded<unknown, "Ref">

export interface NodeRefs {
  cell: Ref
  array: Ref
  map: Ref
}

export type NodeKind = keyof NodeRefs

export type RichTextId = `rich-text:${string}`

export function isRichTextId(value: unknown): value is RichTextId {
  return typeof value === "string" && value.startsWith("rich-text:") && value.length > 10
}

// TODO: Rename to "DocumentStore"?!
export interface NodeStore<Refs extends NodeRefs = NodeRefs> {
  // TODO: Idea: Distinguish "create" between initialization and subsequent writes.
  readonly cell: {
    create(value: JSONValue): Refs["cell"]
    get(ref: Refs["cell"]): JSONValue
  }
  readonly array: {
    create(items: readonly Refs[NodeKind][]): Refs["array"]
    get(ref: Refs["array"]): readonly Refs[NodeKind][]
  }
  readonly map: {
    create(fields: Readonly<Record<string, Refs[NodeKind]>>): Refs["map"]
    get(ref: Refs["map"]): Readonly<Record<string, Refs[NodeKind]>>
    getField(ref: Refs["map"], field: string): Refs[NodeKind] | undefined
  }
  readonly root: {
    /** Runs the initializer only when no root exists; writable stores use a transaction. */
    // TODO: This is only used in createDocument() to initialize the root. Consider
    // inlining it into createDocument() and removing it from the public API.
    getOrCreate(create: () => Refs[NodeKind]): Refs[NodeKind]
  }

  // TODO: Consider moving it into a separate RichTextStore interface.
  readonly editor: {
    create(options: RichTextEditorOptions): RichTextId
    /** Configuration is fixed when an editor is first created in this store. */
    get(id: RichTextId, config: RichTextEditorConfig): RichTextEditor
  }

  /**
   * Store-local invalidation version, advanced by content changes even without subscribers.
   * Empty transactions and reads leave it unchanged. Not persisted or comparable across stores.
   * Immutable stores treat initialization as setup and keep this version at zero.
   */
  getRevision(): number
  /** Notifies after changes become readable, coalescing nested structural transactions. */
  subscribe(listener: () => void): () => void
  /**
   * Writer is valid only during this synchronous callback, including nested transactions.
   * Errors propagate, but transaction changes are not rolled back.
   */
  // TODO: Add idempotent dispose() to release editors and store-owned listeners without destroying caller-owned resources.
  //
  // TODO: Because of this function a YjsStore is not assignable to a NodeStore which complicates the implementation => Find a solution to avoid this problem.
  transact<Result>(callback: (write: NodeWriter<Refs>) => Result): Result
}

export interface NodeWriter<Refs extends NodeRefs = NodeRefs> {
  readonly cell: {
    set(ref: Refs["cell"], value: JSONValue): void
  }
  readonly array: {
    remove(ref: Refs["array"], index: number): void
    insert(ref: Refs["array"], index: number, item: Refs[NodeKind]): void
  }
  readonly map: {
    set(ref: Refs["map"], field: string, item: Refs[NodeKind]): void
    remove(ref: Refs["map"], field: string): void
  }
  readonly root: {
    save(ref: Refs[NodeKind]): Refs[NodeKind]
  }
}
