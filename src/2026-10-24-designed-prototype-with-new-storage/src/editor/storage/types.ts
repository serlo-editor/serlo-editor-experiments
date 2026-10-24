import type {
  RichTextEditor,
  RichTextEditorConfig,
  RichTextEditorOptions,
} from "../rich-text/index.ts"
import type { Branded, JSONValue } from "../utils/index.ts"

export type RichTextId = `rich-text:${string}`

export type Ref = Branded<unknown, "Ref">

export interface NodeRefs {
  cell: Ref
  array: Ref
  map: Ref
}

export type NodeKind = keyof NodeRefs

export interface NodeStore<Refs extends NodeRefs = NodeRefs> {
  readonly cell: CellStore<Refs["cell"]>
  readonly array: ArrayStore<Refs[NodeKind], Refs["array"]>
  readonly map: MapStore<Refs[NodeKind], Refs["map"]>
  readonly root: RootStore<Refs[NodeKind]>

  createRichText(options: RichTextEditorOptions): RichTextId
  /** Configuration is fixed when an editor is first created in this store. */
  getEditor(id: RichTextId, config: RichTextEditorConfig): RichTextEditor

  /**
   * Store-local invalidation version, advanced by content changes even without subscribers.
   * Empty transactions and reads leave it unchanged. Not persisted or comparable across stores.
   */
  getRevision(): number
  /** Notifies after changes become readable, coalescing nested structural transactions. */
  subscribe(listener: () => void): () => void
  /**
   * Writer is valid only during this synchronous callback, including nested transactions.
   * Errors propagate, but transaction changes are not rolled back.
   */
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

export function isRichTextId(value: unknown): value is RichTextId {
  return typeof value === "string" && value.startsWith("rich-text:") && value.length > 10
}

interface RootStore<Ref> {
  /** Runs the initializer inside a transaction, only when no root exists. */
  getOrCreate(create: () => Ref): Ref
}

interface CellStore<Ref> {
  create(value: JSONValue): Ref
  get(ref: Ref): JSONValue
}

interface ArrayStore<ItemRef, ArrayRef> {
  create(items: readonly ItemRef[]): ArrayRef
  get(ref: ArrayRef): readonly ItemRef[]
}

interface MapStore<ItemRef, MapRef> {
  create(fields: Readonly<Record<string, ItemRef>>): MapRef
  get(ref: MapRef): Readonly<Record<string, ItemRef>>
}
